jest.mock("../../mysql2/init.database", () => ({
    getPool: jest.fn(() => ({ getConnection: jest.fn(async () => mockConnection) })),
    initDatabase: jest.fn(async () => mockConnection),
}));

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { getPool } from "../../mysql2/init.database";
import recommendationsRouter from "../../modules/recommendations/recommendations.routes";
import { errorHandler } from "../../middlewares/error.middleware";
import * as pilot from "../../modules/recommendations/recommendations.pilot.collection";

const mockConnection = {
    query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
const app = express();
app.use(express.json());
app.use("/api/recommendations", recommendationsRouter);
app.use(errorHandler);
const token = jwt.sign({ user_id: 7, email: "fixture@example.invalid" }, process.env.JWT_SECRET ?? "");
const path = "/api/recommendations/pilot/participation";

beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    mockConnection.query.mockImplementation(async (sql: string) => sql.includes("FROM ml_pilot_state")
        ? [[{ generation: "4" }], []] : [{ affectedRows: 1 }, []]);
});
afterEach(() => jest.restoreAllMocks());

it.each(["get", "put", "delete"] as const)("requires authentication for %s", async (method) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(getPool).not.toHaveBeenCalled();
});

it("publishes the independent notice without authentication or database access", async () => {
    const response = await request(app).get("/api/recommendations/pilot/notice");
    expect(response.status).toBe(200);
    expect(response.body.version).toBe(pilot.pilotNotice.version);
    expect(response.body.contact).toBe("Contato@MyCDRecords.com");
    expect(getPool).not.toHaveBeenCalled();
});

it("never auto-enrolls an authenticated account without an invitation", async () => {
    jest.spyOn(pilot, "inspectPilotCollection").mockReturnValue({ configured: true, collectionAllowed: true, blockers: [] });
    const response = await request(app).put(path).auth(token, { type: "bearer" }).send({
        accepted: true, noticeVersion: pilot.pilotNotice.version,
    });
    expect(response.status).toBe(403);
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("UPDATE ml_pilot_participants"))).toBe(false);
});

it.each([
    { accepted: false, noticeVersion: "ml-pilot-v1" },
    { accepted: true, noticeVersion: "ml-pilot-v1" },
    { accepted: true, noticeVersion: "ml-pilot-draft-v1" },
    { publicReviewNotice: { accepted: true, version: "public-reviews-v1" } },
])("rejects refused, draft or registration-only permission: %j", async (body) => {
    jest.spyOn(pilot, "inspectPilotCollection").mockReturnValue({ configured: true, collectionAllowed: true, blockers: [] });
    const response = await request(app).put(path).auth(token, { type: "bearer" }).send(body);
    expect(response.status).toBe(400);
    expect(getPool).not.toHaveBeenCalled();
});

it("enrolls an invited subject using only the authenticated identity and published notice", async () => {
    jest.spyOn(pilot, "inspectPilotCollection").mockReturnValue({ configured: true, collectionAllowed: true, blockers: [] });
    mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM ml_pilot_state")) return [[{ generation: "1", closed_at: null }], []];
        if (sql.trim().startsWith("SELECT") && sql.includes("FROM ml_pilot_participants")) return [[{ accepted_at: null, withdrawn_at: null, notice_version: null }], []];
        return [{ affectedRows: 1 }, []];
    });
    const response = await request(app).put(path).auth(token, { type: "bearer" }).send({
        accepted: true, noticeVersion: pilot.pilotNotice.version,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ participating: true, noticeVersion: pilot.pilotNotice.version });
    const update = mockConnection.query.mock.calls.find(([sql]) => sql.includes("UPDATE ml_pilot_participants"));
    expect(update?.[1]).toEqual([pilot.pilotNotice.version, 7]);
});

it("refuses enrollment with a machine-readable blocker and does not initialize storage", async () => {
    const response = await request(app).put(path).auth(token, { type: "bearer" }).send({
        accepted: true, noticeVersion: "ml-pilot-v1",
    });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("ML_PILOT_BLOCKED");
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(getPool).not.toHaveBeenCalled();
});

it("does not read participation storage while the real gate is blocked", async () => {
    const response = await request(app).get(path).auth(token, { type: "bearer" });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("ML_PILOT_BLOCKED");
    expect(getPool).not.toHaveBeenCalled();
});

it("refuses identity injection into enrollment before opening a database connection", async () => {
    jest.spyOn(pilot, "inspectPilotCollection").mockReturnValue({ configured: true, collectionAllowed: true, blockers: [] });
    const response = await request(app).put(path).auth(token, { type: "bearer" }).send({
        accepted: true, noticeVersion: pilot.pilotNotice.version, userId: 99,
    });
    expect(response.status).toBe(400);
    expect(getPool).not.toHaveBeenCalled();
});

it("allows only the authenticated subject to withdraw, even with collection disabled", async () => {
    const response = await request(app).delete(path).auth(token, { type: "bearer" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ participating: false });
    const deletions = mockConnection.query.mock.calls.filter(([sql]) => sql.includes("DELETE FROM ml_pilot_rating_events"));
    expect(deletions.map(([, parameters]) => parameters)).toEqual([[7]]);
});

it("rejects a client-supplied user identity before any withdrawal", async () => {
    const response = await request(app).delete(path).auth(token, { type: "bearer" }).send({ userId: 99 });
    expect(response.status).toBe(400);
    expect(getPool).not.toHaveBeenCalled();
});
