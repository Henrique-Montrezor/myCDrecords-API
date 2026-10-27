/**
 * Integration tests for the health probes and the review comments endpoints.
 */

const mockPoolQuery = jest.fn();

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn(() => ({ query: mockPoolQuery })),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/reviews/comments.repository", () => ({
  COMMENTS_PAGE_SIZE: 20,
  reviewExists: jest.fn(),
  getCommentsByReviewId: jest.fn(),
  getCommentById: jest.fn(),
  postComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import {
  deleteComment,
  getCommentById,
  getCommentsByReviewId,
  postComment,
  reviewExists,
  updateComment,
} from "../../modules/reviews/comments.repository";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

describe("health probes", () => {
  it("GET /health responds without touching the database", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it("GET /ready is 200 when MySQL answers", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ 1: 1 }]]);
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", database: "up" });
  });

  it("GET /ready is 503 when MySQL fails", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("HANDSHAKE_SSL_ERROR"));
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body.database).toBe("down");
  });
});

describe("security headers and request id", () => {
  it("adds a request id, echoing only safe incoming ids", async () => {
    const generated = await request(app).get("/health");
    expect(generated.headers["x-request-id"]).toMatch(/^[\w-]{36}$/);

    const echoed = await request(app).get("/health").set("X-Request-Id", "proxy-abc-12345");
    expect(echoed.headers["x-request-id"]).toBe("proxy-abc-12345");

    const unsafe = await request(app).get("/health").set("X-Request-Id", "bad id <script>");
    expect(unsafe.headers["x-request-id"]).not.toContain("bad");
  });

  it("returns the request id in error bodies", async () => {
    const res = await request(app).post("/api/reviews/3/comments").set(auth()).set("X-Request-Id", "trace-12345678").send({ text: "" });
    expect(res.status).toBe(400);
    expect(res.body.requestId).toBe("trace-12345678");
  });

  it("sets helmet headers and lets the client origin read the request id", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-expose-headers"]).toContain("X-Request-Id");
  });

  it("does not allow unknown origins", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("review comments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires authentication", async () => {
    expect((await request(app).get("/api/reviews/1/comments")).status).toBe(401);
    expect((await request(app).post("/api/reviews/1/comments").send({ text: "oi" })).status).toBe(401);
    expect((await request(app).delete("/api/reviews/comments/1")).status).toBe(401);
  });

  it("lists comments of an existing review with pagination", async () => {
    (reviewExists as jest.Mock).mockResolvedValue(true);
    (getCommentsByReviewId as jest.Mock).mockResolvedValue([{ id: 1, text: "boa" }]);
    const res = await request(app).get("/api/reviews/3/comments?page=2").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, text: "boa" }]);
    expect(getCommentsByReviewId).toHaveBeenCalledWith(3, 2);
  });

  it("returns 404 when listing comments of a missing review", async () => {
    (reviewExists as jest.Mock).mockResolvedValue(false);
    const res = await request(app).get("/api/reviews/3/comments").set(auth());
    expect(res.status).toBe(404);
    expect(getCommentsByReviewId).not.toHaveBeenCalled();
  });

  it("creates a trimmed comment as the authenticated user", async () => {
    (postComment as jest.Mock).mockResolvedValue(11);
    (getCommentById as jest.Mock).mockResolvedValue({ id: 11, user_id: 7, text: "concordo" });
    const res = await request(app).post("/api/reviews/3/comments").set(auth(7)).send({ text: "  concordo  ", user_id: 99 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 11, user_id: 7 });
    expect(postComment).toHaveBeenCalledWith(7, 3, "concordo");
  });

  it("returns 404 when commenting on a missing review", async () => {
    (postComment as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post("/api/reviews/3/comments").set(auth()).send({ text: "oi" });
    expect(res.status).toBe(404);
  });

  it("rejects empty and too long text", async () => {
    expect((await request(app).post("/api/reviews/3/comments").set(auth()).send({ text: "   " })).status).toBe(400);
    expect((await request(app).post("/api/reviews/3/comments").set(auth()).send({ text: "a".repeat(1001) })).status).toBe(400);
    expect(postComment).not.toHaveBeenCalled();
  });

  it("only lets the author edit or delete a comment", async () => {
    (updateComment as jest.Mock).mockResolvedValue(false);
    const edit = await request(app).put("/api/reviews/comments/5").set(auth(8)).send({ text: "editado" });
    expect(edit.status).toBe(404);
    expect(updateComment).toHaveBeenCalledWith(5, 8, "editado");

    (deleteComment as jest.Mock).mockResolvedValue(false);
    const del = await request(app).delete("/api/reviews/comments/5").set(auth(8));
    expect(del.status).toBe(404);
    expect(deleteComment).toHaveBeenCalledWith(5, 8);
  });

  it("edits and deletes own comments", async () => {
    (updateComment as jest.Mock).mockResolvedValue(true);
    (getCommentById as jest.Mock).mockResolvedValue({ id: 5, text: "editado" });
    const edit = await request(app).put("/api/reviews/comments/5").set(auth()).send({ text: "editado" });
    expect(edit.status).toBe(200);
    expect(edit.body.text).toBe("editado");

    (deleteComment as jest.Mock).mockResolvedValue(true);
    expect((await request(app).delete("/api/reviews/comments/5").set(auth())).status).toBe(204);
  });
});
