jest.mock("../../mysql2/init.database", () => ({
    getPool: jest.fn(() => ({ getConnection: jest.fn(async () => mockConnection) })),
    initDatabase: jest.fn(async () => mockConnection),
}));

import { postReview, updateReview, deleteReview } from "../../modules/reviews/reviews.repository";
import { deleteReview as moderateReview, banUser } from "../../modules/admin/admin.repository";
import { pilotNotice, markPilotStorageReady, markPilotRetentionHealthy } from "../../modules/recommendations/recommendations.pilot.collection";

const mockConnection = {
    query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
const albumId = "abcdef00-0000-4000-8000-000000000002";
let reviewAlbumId: string;
let optedIn: boolean;
let eligible: boolean;
let tracked: boolean;
let ownsReview: boolean;
let failEvent: boolean;
let pilotClosed: boolean;
const env = { ...process.env };

beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    process.env.ML_PILOT_COLLECTION_ENABLED = "true";
    process.env.ML_PILOT_NOTICE_APPROVED_VERSION = pilotNotice.version;
    process.env.ML_PILOT_DURABLE_RETENTION_CONFIRMED = "true";
    markPilotStorageReady(true);
    markPilotRetentionHealthy(true);
    optedIn = false; eligible = true; tracked = false; ownsReview = true; failEvent = false; pilotClosed = false;
    reviewAlbumId = albumId;
    mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM ml_pilot_state")) return [[{ generation: "1", closed_at: pilotClosed ? new Date() : null }], []];
        if (sql.includes("FROM ml_pilot_participants")) return [optedIn ? [{
            accepted_at: new Date(), withdrawn_at: null, notice_version: pilotNotice.version, consent_recorded: 1,
        }] : [], []];
        if (sql.includes("FROM ml_pilot_album_eligibility")) return [eligible ? [{ album_id: albumId }] : [], []];
        if (sql.includes("FROM ml_pilot_rating_events e")) return [tracked ? [{ mutation_id: "fixture" }] : [], []];
        if (sql.includes("SELECT") && sql.includes("FROM ml_pilot_rating_events")) return [[], []];
        if (sql.includes("FROM reviews WHERE user_id = ? AND album_id = ?")) return [[], []];
        if (sql.includes("SELECT") && sql.includes("FROM reviews")) return [ownsReview ? [{ id: 11, user_id: 7, album_id: reviewAlbumId, rating: 4 }] : [], []];
        if (sql.includes("INSERT INTO ml_pilot_rating_events") && failEvent) throw new Error("Synthetic event failure.");
        if (/^(INSERT|UPDATE|DELETE)/.test(sql.trim())) return [{ affectedRows: 1, insertId: 11 }, []];
        throw new Error("Unexpected synthetic SQL.");
    });
});
afterEach(() => { process.env = { ...env }; markPilotStorageReady(false); markPilotRetentionHealthy(false); });

const post = (id = albumId) => postReview(7, id, "Synthetic album", "", "Synthetic artist", "", 5, "Private review text");
const eventCalls = () => mockConnection.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO ml_pilot_rating_events"));

it("writes a normal review without enrolling or capturing a nonparticipant", async () => {
    expect(await post()).toBe(11);
    expect(eventCalls()).toHaveLength(0);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

it("captures only the independent rating, atomically with the new review", async () => {
    optedIn = true;
    await post();
    expect(eventCalls()).toHaveLength(1);
    expect(JSON.stringify(eventCalls())).not.toMatch(/Private review text|Synthetic album|Synthetic artist/);
    expect(eventCalls()[0][1].slice(1)).toEqual([7, albumId, 5]);
    expect(mockConnection.query.mock.calls[0][0]).toContain("FOR UPDATE");
});

it.each(["noneligible", "provider-id"])("excludes %s albums despite consent", async (kind) => {
    optedIn = true;
    eligible = kind !== "noneligible";
    await post(kind === "provider-id" ? "synthetic-provider-id" : albumId);
    expect(eventCalls()).toHaveLength(0);
});

it("rolls back the review if event persistence fails", async () => {
    optedIn = true; failEvent = true;
    await expect(post()).rejects.toThrow("Synthetic event failure.");
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("keeps normal reviews working without capturing after persistent pilot closure", async () => {
    optedIn = true; pilotClosed = true;
    expect(await post()).toBe(11);
    expect(eventCalls()).toHaveLength(0);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

it("does not backfill a pre-enrollment review when its rating changes", async () => {
    optedIn = true;
    await updateReview(11, 7, 5, "Changed text");
    expect(eventCalls()).toHaveLength(0);
});

it("removes stale collected ratings when editing during a collection pause", async () => {
    process.env.ML_PILOT_COLLECTION_ENABLED = "false";
    await updateReview(11, 7, 5, "Changed text");
    expect(eventCalls()).toHaveLength(0);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("DELETE FROM ml_pilot_rating_events WHERE user_id = ? AND album_id = ?"))).toBe(true);
});

it("rechecks duplicates under the same lock rather than admitting concurrent duplicate reviews", async () => {
    const original = mockConnection.query.getMockImplementation();
    mockConnection.query.mockImplementation(async (...args) => {
        if (args[0].includes("FROM reviews WHERE user_id = ? AND album_id = ?")) return [[{ id: 11 }], []];
        if (!original) throw new Error("Missing synthetic SQL handler.");
        return original(...args);
    });
    await expect(post()).rejects.toMatchObject({ status: 409 });
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO reviews"))).toBe(false);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
});

it("records changed ratings of a tracked prospective review but not text-only edits", async () => {
    optedIn = true; tracked = true;
    await updateReview(11, 7, 5, "Changed text");
    expect(eventCalls()).toHaveLength(1);
    mockConnection.query.mockClear();
    await updateReview(11, 7, 4, "Only text changed");
    expect(eventCalls()).toHaveLength(0);
});

it("normalizes UUID case consistently for updates and erasure in the binary-collated ML ledger", async () => {
    optedIn = true; tracked = true; reviewAlbumId = albumId.toUpperCase();
    await updateReview(11, 7, 5, "Changed text");
    const tracking = mockConnection.query.mock.calls.find(([sql]) => sql.includes("FROM ml_pilot_rating_events e"));
    expect(tracking?.[1]).toEqual([7, albumId]);
    await deleteReview(11, 7);
    const deletion = mockConnection.query.mock.calls.find(([sql]) => sql.includes("DELETE FROM ml_pilot_rating_events WHERE user_id = ? AND album_id = ?"));
    expect(deletion?.[1]).toEqual([7, albumId]);
});

it("never touches another user's review, comments or pilot events", async () => {
    ownsReview = false;
    expect(await deleteReview(11, 8)).toBe(false);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.trim().startsWith("DELETE"))).toBe(false);
});

it.each(["owner", "moderator"])("erases review events and invalidates derivatives on %s deletion even while paused", async (actor) => {
    process.env.ML_PILOT_COLLECTION_ENABLED = "false";
    if (actor === "owner") await deleteReview(11, 7);
    else await moderateReview(11);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("DELETE FROM ml_pilot_rating_events WHERE user_id = ? AND album_id = ?"))).toBe(true);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("generation = generation + 1"))).toBe(true);
});

it("withdraws a banned user within the ban transaction instead of resuming collection on unban", async () => {
    await banUser(7, 1, "Synthetic moderation");
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("DELETE FROM ml_pilot_rating_events WHERE user_id = ?"))).toBe(true);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("withdrawn_at = UTC_TIMESTAMP(6)"))).toBe(true);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});
