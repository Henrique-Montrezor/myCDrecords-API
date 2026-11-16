jest.mock("../../mysql2/init.database", () => ({
    getPool: jest.fn(() => ({ getConnection: jest.fn(async () => mockConnection) })),
}));
import { applyPilotOperation } from "../../modules/recommendations/recommendations.pilot.operations";
import { parsePilotOperation } from "../../modules/recommendations/recommendations.pilot.manage.cli";
import { pilotNotice } from "../../modules/recommendations/recommendations.pilot.collection";
import { migrateMlPilotCollection } from "../../mysql2/migrations/009-ml-pilot-collection";

const mockConnection = {
    query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
const env = { ...process.env };
let closed: boolean;
beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    closed = false;
    process.env.ML_PILOT_COLLECTION_ENABLED = "true";
    process.env.ML_PILOT_NOTICE_APPROVED_VERSION = pilotNotice.version;
    mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM ml_pilot_state")) return [[{ generation: "1", closed_at: closed ? new Date() : null }], []];
        if (sql.includes("SELECT id FROM users")) return [[{ id: 7 }], []];
        if (sql.includes("FROM ml_pilot_album_eligibility")) return [[], []];
        if (sql.includes("information_schema")) return [[], []];
        if (sql.includes("FROM ml_pilot_notice_versions")) return [[{ notice_json: JSON.stringify(pilotNotice) }], []];
        if (/^(INSERT|UPDATE|DELETE|ALTER|CREATE)/.test(sql.trim())) return [{ affectedRows: 1 }, []];
        throw new Error("Unexpected synthetic SQL.");
    });
});
afterEach(() => { process.env = { ...env }; });

it("creates invitations without fabricating acceptance", async () => {
    expect(await applyPilotOperation({ action: "invite", "user-id": 7 })).toEqual({ invited: true });
    const insert = mockConnection.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO ml_pilot_participants"));
    expect(insert?.[0]).not.toMatch(/accepted_at|notice_version/);
});

it("requires explicit independent-core attestation and rejects extra source fields", () => {
    expect(() => parsePilotOperation(["album", "--album-id", "00000000-0000-4000-8000-000000000002"])).toThrow();
    expect(() => parsePilotOperation(["invite", "--user-id", "7", "--confirm-end"])).toThrow();
    expect(() => parsePilotOperation(["close"])).toThrow();
});

it("ends the pilot persistently, removes events and preserves withdrawal receipts for expiry", async () => {
    expect(await applyPilotOperation({ action: "close", "confirm-end": true })).toEqual({ closed: true });
    const statements = mockConnection.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain("DELETE FROM ml_pilot_rating_events");
    expect(statements).toContain("SET closed_at = UTC_TIMESTAMP(6)");
    expect(statements).toContain("SET withdrawn_at = UTC_TIMESTAMP(6) WHERE withdrawn_at IS NULL");
    expect(statements).toContain("generation = generation + 1");
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

it("cannot invite after closure and does not reset closure/withdrawal times on repeated closure", async () => {
    closed = true;
    await expect(applyPilotOperation({ action: "invite", "user-id": 7 })).rejects.toThrow("encerrado");
    mockConnection.query.mockClear();
    await applyPilotOperation({ action: "close", "confirm-end": true });
    expect(mockConnection.query.mock.calls).toHaveLength(1);
});

it("revokes eligibility and its events in the same transaction, including while collection is off", async () => {
    process.env.ML_PILOT_COLLECTION_ENABLED = "false";
    await applyPilotOperation({ action: "revoke-album", "album-id": "00000000-0000-4000-8000-000000000002" });
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("DELETE FROM ml_pilot_album_eligibility"))).toBe(true);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("generation = generation + 1"))).toBe(true);
});

it("provides external retention cleanup even when enrollment/collection are disabled", async () => {
    process.env.ML_PILOT_COLLECTION_ENABLED = "false";
    expect(await applyPilotOperation({ action: "purge" })).toEqual({ purgedEvents: 1, purgedReceipts: 1 });
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

it("upgrades the prepared schema additively and is repeatable", async () => {
    await migrateMlPilotCollection(mockConnection);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("ADD COLUMN closed_at"))).toBe(true);
    const original = mockConnection.query.getMockImplementation();
    mockConnection.query.mockClear().mockImplementation(async (...args) => {
        if (args[0].includes("information_schema")) return [[{ COLUMN_NAME: "closed_at" }], []];
        if (!original) throw new Error("Missing synthetic SQL handler.");
        return original(...args);
    });
    await migrateMlPilotCollection(mockConnection);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("ADD COLUMN closed_at"))).toBe(false);
});

it("refuses to rewrite the notice archive under an already accepted version", async () => {
    const original = mockConnection.query.getMockImplementation();
    mockConnection.query.mockImplementation(async (...args) => {
        if (args[0].includes("FROM ml_pilot_notice_versions")) return [[{ notice_json: '{"text":"different"}' }], []];
        if (!original) throw new Error("Missing synthetic SQL handler.");
        return original(...args);
    });
    await expect(migrateMlPilotCollection(mockConnection)).rejects.toThrow("nova versão");
});

it("registers eligibility only from the explicit private independent-core declaration", async () => {
    expect(await applyPilotOperation({
        action: "album", "album-id": "00000000-0000-4000-8000-000000000002",
        evidence: "synthetic-license-evidence", "first-available-at": "2026-11-01T00:00:00Z",
        "confirm-independent-core-cc0": true,
    })).toEqual({ eligible: true });
    const insert = mockConnection.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO ml_pilot_album_eligibility"));
    expect(insert?.[0]).toContain("'musicbrainz-core', 'CC0-1.0'");
    expect(insert?.[1]).toEqual([
        "00000000-0000-4000-8000-000000000002", "synthetic-license-evidence",
        "2026-11-01 00:00:00.000", "2026-11-01 00:00:00.000",
    ]);
});

it("never silently overwrites eligibility or erases feedback when registering an existing album", async () => {
    const original = mockConnection.query.getMockImplementation();
    mockConnection.query.mockImplementation(async (...args) => {
        if (args[0].includes("FROM ml_pilot_album_eligibility")) return [[{ album_id: "fixture" }], []];
        if (!original) throw new Error("Missing synthetic SQL handler.");
        return original(...args);
    });
    await expect(applyPilotOperation({
        action: "album", "album-id": "00000000-0000-4000-8000-000000000002",
        evidence: "synthetic-license-evidence", "first-available-at": "2026-11-01T00:00:00Z",
        "confirm-independent-core-cc0": true,
    })).rejects.toThrow("revogação explícita");
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.trim().startsWith("DELETE"))).toBe(false);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
});
