/**
 * Authorization and contract tests for lists, follows and review ownership.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/lists/lists.repository");
jest.mock("../../modules/social/social.repository");
jest.mock("../../modules/reviews/reviews.repository");

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import * as lists from "../../modules/lists/lists.repository";
import * as social from "../../modules/social/social.repository";
import * as reviews from "../../modules/reviews/reviews.repository";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

beforeEach(() => jest.clearAllMocks());

describe("lists", () => {
  it("requires authentication to create a list and validates the title", async () => {
    expect((await request(app).post("/api/lists").send({ title: "Domingo" })).status).toBe(401);
    expect((await request(app).post("/api/lists").set(auth()).send({ title: "  " })).status).toBe(400);
  });

  it("creates a list for the authenticated user", async () => {
    (lists.createList as jest.Mock).mockResolvedValue(4);
    const res = await request(app).post("/api/lists").set(auth(7)).send({ title: "Domingo", isPublic: false });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ listId: 4 });
    expect(lists.createList).toHaveBeenCalledWith(7, "Domingo", undefined, false);
  });

  it("hides private lists from anyone but the owner", async () => {
    (lists.getListById as jest.Mock).mockResolvedValue({ id: 4, user_id: 7, is_public: 0 });
    (lists.getListItems as jest.Mock).mockResolvedValue([]);
    expect((await request(app).get("/api/lists/4")).status).toBe(403);
    expect((await request(app).get("/api/lists/4").set(auth(8))).status).toBe(403);
    expect((await request(app).get("/api/lists/4").set(auth(7))).status).toBe(200);
  });

  it("opens public lists without login", async () => {
    (lists.getListById as jest.Mock).mockResolvedValue({ id: 4, user_id: 7, is_public: 1 });
    (lists.getListItems as jest.Mock).mockResolvedValue([{ album_id: "a1" }]);
    const res = await request(app).get("/api/lists/4");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ album_id: "a1" }]);
  });

  it("only returns public lists of other users", async () => {
    (lists.getListsByUser as jest.Mock).mockResolvedValue([]);
    await request(app).get("/api/lists/user/7").set(auth(8));
    expect(lists.getListsByUser).toHaveBeenLastCalledWith(7, true);
    await request(app).get("/api/lists/user/7").set(auth(7));
    expect(lists.getListsByUser).toHaveBeenLastCalledWith(7, false);
  });

  it("does not let other users edit, delete or change items", async () => {
    (lists.updateList as jest.Mock).mockResolvedValue(false);
    (lists.deleteList as jest.Mock).mockResolvedValue(false);
    (lists.getListOwner as jest.Mock).mockResolvedValue(7);

    expect((await request(app).put("/api/lists/4").set(auth(8)).send({ title: "Meu" })).status).toBe(404);
    expect(lists.updateList).toHaveBeenCalledWith(4, 8, { title: "Meu" });
    expect((await request(app).delete("/api/lists/4").set(auth(8))).status).toBe(404);
    expect(lists.deleteList).toHaveBeenCalledWith(4, 8);
    expect((await request(app).post("/api/lists/4/items").set(auth(8)).send({ albumId: "a1" })).status).toBe(403);
    expect((await request(app).delete("/api/lists/4/items/a1").set(auth(8))).status).toBe(403);
    expect(lists.addListItem).not.toHaveBeenCalled();
    expect(lists.removeListItem).not.toHaveBeenCalled();
  });

  it("adds albums to own lists and rejects duplicates", async () => {
    (lists.getListOwner as jest.Mock).mockResolvedValue(7);
    (lists.addListItem as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await request(app).post("/api/lists/4/items").set(auth(7)).send({ albumId: "a1" })).status).toBe(201);
    expect((await request(app).post("/api/lists/4/items").set(auth(7)).send({ albumId: "a1" })).status).toBe(409);
  });

  it("returns 404 for unknown lists", async () => {
    (lists.getListById as jest.Mock).mockResolvedValue(null);
    (lists.getListOwner as jest.Mock).mockResolvedValue(null);
    expect((await request(app).get("/api/lists/99")).status).toBe(404);
    expect((await request(app).post("/api/lists/99/items").set(auth()).send({ albumId: "a1" })).status).toBe(404);
  });
});

describe("follows", () => {
  it("requires authentication", async () => {
    expect((await request(app).post("/api/social/follow/8")).status).toBe(401);
    expect((await request(app).delete("/api/social/follow/8")).status).toBe(401);
  });

  it("blocks following yourself", async () => {
    expect((await request(app).post("/api/social/follow/7").set(auth(7))).status).toBe(400);
    expect(social.followUser).not.toHaveBeenCalled();
  });

  it("follows, rejects duplicates and unfollows as the authenticated user", async () => {
    (social.followUser as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await request(app).post("/api/social/follow/8").set(auth(7))).status).toBe(201);
    expect(social.followUser).toHaveBeenCalledWith(7, 8);
    expect((await request(app).post("/api/social/follow/8").set(auth(7))).status).toBe(409);

    (social.unfollowUser as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await request(app).delete("/api/social/follow/8").set(auth(7))).status).toBe(204);
    expect((await request(app).delete("/api/social/follow/8").set(auth(7))).status).toBe(404);
  });

  it("lists followers with counts", async () => {
    (social.getFollowers as jest.Mock).mockResolvedValue([{ id: 7, username: "ana" }]);
    (social.getFollowCounts as jest.Mock).mockResolvedValue({ followers: 1, following: 0 });
    const res = await request(app).get("/api/social/8/followers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ followers: [{ id: 7, username: "ana" }], counts: { followers: 1, following: 0 } });
  });
});

describe("review ownership", () => {
  it("does not let other users edit or delete a review", async () => {
    (reviews.updateReview as jest.Mock).mockResolvedValue(false);
    (reviews.deleteReview as jest.Mock).mockResolvedValue(false);

    const edit = await request(app).put("/api/reviews/3/update").set(auth(8)).send({ rating: 1, text: "ruim" });
    expect(edit.status).toBe(404);
    expect(reviews.updateReview).toHaveBeenCalledWith(3, 8, 1, "ruim");

    const del = await request(app).delete("/api/reviews/3/delete").set(auth(8));
    expect(del.status).toBe(404);
    expect(reviews.deleteReview).toHaveBeenCalledWith(3, 8);
  });

  it("rejects a second review of the same album", async () => {
    (reviews.checkReview as jest.Mock).mockResolvedValue(true);
    const res = await request(app).post("/api/reviews/post-review").set(auth()).send({ albumId: "a1", rating: 4 });
    expect(res.status).toBe(409);
    expect(reviews.postReview).not.toHaveBeenCalled();
  });
});
