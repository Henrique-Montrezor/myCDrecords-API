/**
 * Integration tests for user search, public profile and the reviews endpoints that depend on the viewer.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/users/user.repository", () => ({
  searchUsersByUsername: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findByIdForResponse: jest.fn(),
  createUser: jest.fn(),
}));

jest.mock("../../modules/profile/profile.repository", () => ({
  getPublicProfile: jest.fn(),
  createOrUpdateProfile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../modules/reviews/reviews.repository", () => ({
  getReviewsByAlbumId: jest.fn(),
  getUserReviewForAlbum: jest.fn(),
  getAlbumRatingCounts: jest.fn(),
  getReviewsByUserId: jest.fn(),
  postReview: jest.fn(),
  deleteReview: jest.fn(),
  updateReview: jest.fn(),
  checkReview: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { searchUsersByUsername } from "../../modules/users/user.repository";
import { createOrUpdateProfile, getPublicProfile } from "../../modules/profile/profile.repository";
import { getReviewsByAlbumId, getUserReviewForAlbum } from "../../modules/reviews/reviews.repository";
import { profileUpsertSchema } from "../../modules/profile/profile.schema";

const token = (userId = 7) => jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" });
const auth = (userId?: number) => ({ Authorization: `Bearer ${token(userId)}` });

describe("GET /api/user/search-users", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/user/search-users?username=ana");
    expect(res.status).toBe(401);
    expect(searchUsersByUsername).not.toHaveBeenCalled();
  });

  it("rejects too short terms", async () => {
    const res = await request(app).get("/api/user/search-users?username=a").set(auth());
    expect(res.status).toBe(400);
  });

  it("returns only the public fields from the repository", async () => {
    (searchUsersByUsername as jest.Mock).mockResolvedValue([{ id: 1, username: "ana", avatar_url: null }]);
    const res = await request(app).get("/api/user/search-users?username=an").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, username: "ana", avatar_url: null }]);
    expect(searchUsersByUsername).toHaveBeenCalledWith("an");
  });
});

describe("GET /api/profile/get-profile/:username", () => {
  it("returns the public profile for the viewer", async () => {
    (getPublicProfile as jest.Mock).mockResolvedValue({ id: 1, username: "ana", is_following: true });
    const res = await request(app).get("/api/profile/get-profile/ana").set(auth(7));
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("ana");
    expect(getPublicProfile).toHaveBeenCalledWith("ana", 7);
  });

  it("returns 404 for unknown users", async () => {
    (getPublicProfile as jest.Mock).mockResolvedValue(null);
    const res = await request(app).get("/api/profile/get-profile/ghost").set(auth());
    expect(res.status).toBe(404);
  });
});

describe("POST /api/profile/create-or-update-profile", () => {
  it("accepts an empty bio and avatar", async () => {
    const res = await request(app).post("/api/profile/create-or-update-profile").set(auth()).send({});
    expect(res.status).toBe(200);
    expect(createOrUpdateProfile).toHaveBeenCalledWith(7, expect.objectContaining({ bio: "", avatar_url: null }), null);
  });
});

describe("profileUpsertSchema", () => {
  it("only accepts http(s) avatar URLs", () => {
    expect(profileUpsertSchema.safeParse({ avatar_url: "https://example.com/a.png" }).success).toBe(true);
    expect(profileUpsertSchema.safeParse({ avatar_url: "javascript:alert(1)" }).success).toBe(false);
    expect(profileUpsertSchema.safeParse({ avatar_url: "ftp://example.com/a.png" }).success).toBe(false);
  });
});

describe("reviews depending on the viewer", () => {
  it("passes the viewer id when listing album reviews", async () => {
    (getReviewsByAlbumId as jest.Mock).mockResolvedValue([{ id: 1, score: 2, user_vote: 1 }]);
    const res = await request(app).get("/api/reviews/albums/abc/reviews?page=2").set(auth(9));
    expect(res.status).toBe(200);
    expect(getReviewsByAlbumId).toHaveBeenCalledWith("abc", 2, 9);
  });

  it("returns the viewer's own review or null", async () => {
    (getUserReviewForAlbum as jest.Mock).mockResolvedValueOnce({ id: 3, user_id: 9 });
    const found = await request(app).get("/api/reviews/albums/abc/mine").set(auth(9));
    expect(found.body).toMatchObject({ id: 3 });
    expect(getUserReviewForAlbum).toHaveBeenCalledWith(9, "abc");

    (getUserReviewForAlbum as jest.Mock).mockResolvedValueOnce(null);
    const none = await request(app).get("/api/reviews/albums/abc/mine").set(auth(9));
    expect(none.status).toBe(200);
    expect(none.body).toBeNull();
  });

  it("requires authentication for /mine", async () => {
    expect((await request(app).get("/api/reviews/albums/abc/mine")).status).toBe(401);
  });
});
