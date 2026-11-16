jest.mock("../../mysql2/init.database", () => ({
    getPool: jest.fn(() => ({ getConnection: jest.fn(async () => mockConnection) })),
    initDatabase: jest.fn(async () => mockConnection),
}));

import * as pilot from "../../modules/recommendations/recommendations.pilot.collection";
import {
    enrollInPilot, withdrawFromPilot, recordPilotRatingEvent, purgeExpiredPilotEvents, assertPilotGeneration,
} from "../../modules/recommendations/recommendations.pilot.controls";
import { getPool } from "../../mysql2/init.database";
import { migrateMlPilotControls } from "../../mysql2/migrations/008-ml-pilot-controls";
import { withTransaction } from "../../utils/withTransaction";

const mockConnection = {
    query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
const notice = { accepted: true, noticeVersion: pilot.pilotNotice.version };
const event = {
    mutationId: "00000000-0000-4000-8000-000000000001",
    userId: 7, albumId: "00000000-0000-4000-8000-000000000002", rating: 5,
};
let participant: { accepted_at: Date | null; withdrawn_at: Date | null; notice_version: string | null } | null;
let eligible: boolean;
let existingEvent: { user_id: number; album_id: string; rating: number | null } | null;
let generation: string;
let consentRecorded: boolean;

beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    participant = { accepted_at: null, withdrawn_at: null, notice_version: null };
    eligible = true;
    existingEvent = null;
    generation = "4";
    consentRecorded = true;
    mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM ml_pilot_state")) return [[{ generation }], []];
        if (sql.trim().startsWith("SELECT") && sql.includes("FROM ml_pilot_participants")) return [participant ? [{ ...participant, consent_recorded: consentRecorded ? 1 : 0 }] : [], []];
        if (sql.trim().startsWith("SELECT") && sql.includes("FROM ml_pilot_album_eligibility")) return [eligible ? [{ album_id: event.albumId }] : [], []];
        if (sql.trim().startsWith("SELECT") && sql.includes("FROM ml_pilot_rating_events")) return [existingEvent ? [existingEvent] : [], []];
        if (/^(INSERT|UPDATE|DELETE)/.test(sql.trim())) return [{ affectedRows: 1 }, []];
        throw new Error("Unexpected synthetic SQL.");
    });
});
afterEach(() => jest.restoreAllMocks());

function enableOnlyInThisTest() {
    jest.spyOn(pilot, "inspectPilotCollection").mockReturnValue({ configured: true, collectionAllowed: true, blockers: [] });
}

it("refuses enrollment and skips capture explicitly while the real gate is blocked, without database access", async () => {
    await expect(enrollInPilot(7, notice)).rejects.toMatchObject({ status: 503 });
    expect(await recordPilotRatingEvent(mockConnection, event)).toEqual({ captured: false, reason: "pilot_disabled" });
    expect(getPool).not.toHaveBeenCalled();
    expect(mockConnection.query).not.toHaveBeenCalled();
});

it("requires a private invitation and never treats the registration notice as ML consent", async () => {
    enableOnlyInThisTest();
    await expect(enrollInPilot(7, { accepted: true, noticeVersion: "public-reviews-v1" })).rejects.toThrow();
    participant = null;
    await expect(enrollInPilot(7, notice)).rejects.toMatchObject({ status: 403 });
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("UPDATE ml_pilot_participants"))).toBe(false);
});

it("records acknowledgement using server time and leaves repeated active enrollment unchanged", async () => {
    enableOnlyInThisTest();
    await expect(enrollInPilot(7, notice)).resolves.toEqual({ participating: true, noticeVersion: notice.noticeVersion });
    const update = mockConnection.query.mock.calls.find(([sql]) => sql.includes("UPDATE ml_pilot_participants"));
    expect(update?.[0]).toContain("accepted_at = UTC_TIMESTAMP(6)");
    expect(update?.[1]).toEqual([notice.noticeVersion, 7]);
    participant = { accepted_at: new Date(), withdrawn_at: null, notice_version: notice.noticeVersion };
    mockConnection.query.mockClear();
    await enrollInPilot(7, notice);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("UPDATE ml_pilot_participants"))).toBe(false);
});

it("rolls back enrollment if the immutable consent receipt cannot be saved", async () => {
    enableOnlyInThisTest();
    const original = mockConnection.query.getMockImplementation();
    mockConnection.query.mockImplementation(async (...args) => {
        if (args[0].includes("INSERT INTO ml_pilot_consent_receipts")) throw new Error("Synthetic receipt failure.");
        if (!original) throw new Error("Missing synthetic SQL handler.");
        return original(...args);
    });
    await expect(enrollInPilot(7, notice)).rejects.toThrow("Synthetic receipt failure.");
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("retains prior withdrawn receipts when a participant explicitly rejoins", async () => {
    enableOnlyInThisTest();
    participant = { accepted_at: new Date(), withdrawn_at: new Date(), notice_version: notice.noticeVersion };
    await enrollInPilot(7, notice);
    const statements = mockConnection.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain("INSERT INTO ml_pilot_consent_receipts");
    expect(statements).not.toContain("DELETE FROM ml_pilot_consent_receipts");
    expect(statements).toContain("WHERE user_id = ? AND withdrawn_at IS NULL");
});

it("never authorizes collection from legacy participation fields without a matching unwithdrawn receipt", async () => {
    enableOnlyInThisTest();
    participant = { accepted_at: new Date(), withdrawn_at: null, notice_version: notice.noticeVersion };
    consentRecorded = false;
    expect(await recordPilotRatingEvent(mockConnection, event)).toEqual({ captured: false, reason: "not_participating" });
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO ml_pilot_rating_events"))).toBe(false);
});

it.each([
    null,
    { accepted_at: null, withdrawn_at: null, notice_version: null },
    { accepted_at: new Date(), withdrawn_at: new Date(), notice_version: "ml-pilot-v1" },
    { accepted_at: new Date(), withdrawn_at: null, notice_version: "outdated" },
])("does not capture for nonparticipants or withdrawn/outdated consent: %j", async (row) => {
    enableOnlyInThisTest();
    participant = row;
    expect(await recordPilotRatingEvent(mockConnection, event)).toEqual({ captured: false, reason: "not_participating" });
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO ml_pilot_rating_events"))).toBe(false);
});

it("requires independent catalog eligibility, not just a valid album UUID", async () => {
    enableOnlyInThisTest();
    participant = { accepted_at: new Date(), withdrawn_at: null, notice_version: notice.noticeVersion };
    eligible = false;
    expect(await recordPilotRatingEvent(mockConnection, event)).toEqual({ captured: false, reason: "album_not_eligible" });
    const [sql] = mockConnection.query.mock.calls.find(([query]) => query.includes("FROM ml_pilot_album_eligibility")) ?? [];
    expect(sql).toContain("source = 'musicbrainz-core'");
    expect(sql).toContain("license = 'CC0-1.0'");
});

it.each([1, 5, null])("writes only minimized prospective ratings (%j) with 30-day expiry on the caller's transaction", async (rating) => {
    enableOnlyInThisTest();
    participant = { accepted_at: new Date(), withdrawn_at: null, notice_version: notice.noticeVersion };
    expect(await withTransaction((connection) => recordPilotRatingEvent(connection, { ...event, rating }))).toEqual({ captured: true, reason: "recorded" });
    const insert = mockConnection.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO ml_pilot_rating_events"));
    expect(insert?.[0]).toContain("UTC_TIMESTAMP(6)");
    expect(insert?.[0]).toContain("INTERVAL 30 DAY");
    expect(insert?.[1]).toEqual([event.mutationId, 7, event.albumId, rating]);
    expect(insert?.[0]).not.toMatch(/text|email|tags|title|image/);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

it("deduplicates a mutation but rejects reuse of its identity for a different rating", async () => {
    enableOnlyInThisTest();
    participant = { accepted_at: new Date(), withdrawn_at: null, notice_version: notice.noticeVersion };
    existingEvent = { user_id: 7, album_id: event.albumId, rating: 5 };
    expect(await recordPilotRatingEvent(mockConnection, event)).toEqual({ captured: false, reason: "duplicate" });
    await expect(recordPilotRatingEvent(mockConnection, { ...event, rating: 1 })).rejects.toMatchObject({ status: 409 });
});

it("rolls back the event when the local rating write fails on the same transaction", async () => {
    enableOnlyInThisTest();
    participant = { accepted_at: new Date(), withdrawn_at: null, notice_version: notice.noticeVersion };
    await expect(withTransaction(async (connection) => {
        await recordPilotRatingEvent(connection, event);
        throw new Error("Synthetic local rating failure.");
    })).rejects.toThrow("Synthetic local rating failure.");
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO ml_pilot_rating_events"))).toBe(true);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it.each([{ text: "not permitted" }, { occurredAt: "2020-01-01" }, { source: "spotify" }])(
    "rejects unapproved event inputs rather than exporting them: %j", async (extra) => {
        await expect(recordPilotRatingEvent(mockConnection, { ...event, ...extra })).rejects.toThrow();
        expect(mockConnection.query).not.toHaveBeenCalled();
    },
);

it("withdraws even when enrollment is blocked, erasing events and invalidating prior generations atomically", async () => {
    expect(await withdrawFromPilot(7)).toEqual({ participating: false });
    const statements = mockConnection.query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toContain("FOR UPDATE");
    expect(statements.some((sql) => sql.includes("DELETE FROM ml_pilot_rating_events WHERE user_id = ?"))).toBe(true);
    expect(statements.some((sql) => sql.includes("generation = generation + 1"))).toBe(true);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    generation = "5";
    await expect(assertPilotGeneration(mockConnection, "4")).rejects.toMatchObject({ status: 409 });
});

it("does not renew withdrawn state or invalidate again for an already empty withdrawal", async () => {
    mockConnection.query.mockImplementation(async (sql: string) => sql.includes("FROM ml_pilot_state")
        ? [[{ generation }], []] : [{ affectedRows: 0 }, []]);
    await withdrawFromPilot(7);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("generation = generation + 1"))).toBe(false);
});

it("purges expired events and invalidates derived generations under the same lock", async () => {
    expect(await purgeExpiredPilotEvents()).toEqual({ purgedEvents: 1, purgedReceipts: 1 });
    expect(mockConnection.query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("expires_at <= UTC_TIMESTAMP(6)"))).toBe(true);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("generation = generation + 1"))).toBe(true);
});

it("does not invalidate when expiry cleanup removes no events", async () => {
    mockConnection.query.mockImplementation(async (sql: string) => sql.includes("FROM ml_pilot_state")
        ? [[{ generation }], []] : [{ affectedRows: 0 }, []]);
    expect(await purgeExpiredPilotEvents()).toEqual({ purgedEvents: 0, purgedReceipts: 0 });
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("generation = generation + 1"))).toBe(false);
});

it("fails closed if the invalidation state is absent instead of erasing events without a valid generation", async () => {
    mockConnection.query.mockResolvedValue([[], []]);
    await expect(withdrawFromPilot(7)).rejects.toMatchObject({ status: 503 });
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
});

it("compares generations without losing BIGINT precision", async () => {
    generation = "9007199254740993";
    await expect(assertPilotGeneration(mockConnection, generation)).resolves.toBeUndefined();
    await expect(assertPilotGeneration(mockConnection, "9007199254740992")).rejects.toMatchObject({ status: 409 });
});

it("rolls back withdrawal if invalidation cannot be persisted", async () => {
    const original = mockConnection.query.getMockImplementation();
    mockConnection.query.mockImplementation(async (...args) => {
        if (args[0].includes("generation = generation + 1")) throw new Error("Synthetic invalidation failure.");
        if (!original) throw new Error("Missing synthetic SQL handler.");
        return original(...args);
    });
    await expect(withdrawFromPilot(7)).rejects.toThrow("Synthetic invalidation failure.");
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("prepares additive tables without auto-enrolling users or copying existing reviews", async () => {
    mockConnection.query.mockResolvedValue([[], []]);
    await migrateMlPilotControls(mockConnection);
    const statements = mockConnection.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain("CREATE TABLE IF NOT EXISTS ml_pilot_participants");
    expect(statements).toContain("CREATE TABLE IF NOT EXISTS ml_pilot_rating_events");
    expect(statements).toContain("CREATE TABLE IF NOT EXISTS ml_pilot_album_eligibility");
    expect(statements).not.toMatch(/FROM reviews|INSERT INTO ml_pilot_participants|UPDATE users|DROP /);
});
