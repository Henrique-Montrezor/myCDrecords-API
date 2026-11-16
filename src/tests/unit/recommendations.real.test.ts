import { buildRealExchange, verifyRealSnapshot } from "../../modules/recommendations/recommendations.real";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const row = {
    sequence: "9007199254740993", user_id: 7, album_id: "00000000-0000-4000-8000-000000000001",
    rating: 5, occurred_at: "2026-11-10T00:00:00.123456Z", observed_at: "2026-11-10T00:00:00.123456Z",
    expires_at: "2026-12-10T00:00:00.123456Z", available_at: "2026-11-01T00:00:00.000000Z",
};
const snapshot = {
    generation: "9007199254740993", capturedAt: "2026-11-16T00:00:00.000000Z",
    rows: [
        row,
        { ...row, sequence: "9007199254740994", occurred_at: "2026-11-12T00:00:00.123456Z", observed_at: "2026-11-12T00:00:00.123456Z" },
        { ...row, sequence: "9007199254740995", occurred_at: "2026-11-15T00:00:00.123456Z", observed_at: "2026-11-15T00:00:00.123456Z" },
    ],
};

it("pseudonymizes both identity domains per run without rounding sequence or microseconds", () => {
    const first = buildRealExchange(snapshot);
    const second = buildRealExchange(snapshot);
    expect(first.noticeVersion).toBe("ml-pilot-v2");
    expect(first.events[0].sequence).toBe(row.sequence);
    expect(first.events[0].occurred_at).toBe(row.occurred_at);
    expect(first.events[0].user_id).toMatch(/^[a-f0-9]{64}$/);
    expect(first.events[0].user_id).not.toBe(second.events[0].user_id);
    expect(JSON.stringify(first)).not.toContain(row.album_id);
    expect(first.albums[0].id).toBe(first.events[0].album_id);
});

it("uses chronological cuts instead of randomized rating rows and rejects empty exports", () => {
    const exchange = buildRealExchange(snapshot);
    expect(exchange.cuts[0] < exchange.cuts[1] && exchange.cuts[1] < exchange.cuts[2]).toBe(true);
    expect(exchange.cuts[2]).toBe(snapshot.rows[2].observed_at);
    expect(() => buildRealExchange({ ...snapshot, rows: [] })).toThrow("NO_ELIGIBLE_EVENTS");
});

it("invalidates even unchanged generations when account deletion, expiry or receipt changes remove rows", () => {
    expect(() => verifyRealSnapshot(snapshot, snapshot)).not.toThrow();
    expect(() => verifyRealSnapshot(snapshot, { ...snapshot, generation: "9007199254740994" })).toThrow("DATASET_INVALIDATED");
    expect(() => verifyRealSnapshot(snapshot, { ...snapshot, rows: snapshot.rows.slice(1) })).toThrow("DATASET_INVALIDATED");
    expect(() => verifyRealSnapshot(snapshot, { ...snapshot, rows: [{ ...row, rating: 1 }] })).toThrow("DATASET_INVALIDATED");
});

it("opens CLI help without loading .env, connecting to SQL or requiring Python", () => {
    const cwd = resolve(__dirname, "../../..");
    const result = spawnSync(process.execPath, [
        "-r", "ts-node/register", "src/modules/recommendations/recommendations.real.cli.ts", "--help",
    ], { cwd, encoding: "utf8", timeout: 30000 });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("mysql:");
    expect(result.stdout).not.toContain("injected env");
});
