/**
 * Integration tests for profile favorites and activity endpoints.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/profile/profile.repository", () => ({
  getPublicProfile: jest.fn(),
  createOrUpdateProfile: jest.fn(),
  getFavorites: jest.fn(),
  replaceFavorites: jest.fn(),
  getUserActivity: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { getFavorites, getUserActivity, replaceFavorites } from "../../modules/profile/profile.repository";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

const album = (id: string) => ({ albumId: id, albumTitle: `Album ${id}`, albumArtist: "Artist" });

beforeEach(() => jest.clearAllMocks());

describe("GET /api/profile/users/:userId/favorites", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/profile/users/3/favorites");
    expect(res.status).toBe(401);
  });

  it("returns the favorites of the requested user", async () => {
    (getFavorites as jest.Mock).mockResolvedValue([{ position: 1, album_id: "a" }]);
    const res = await request(app).get("/api/profile/users/3/favorites").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ position: 1, album_id: "a" }]);
    expect(getFavorites).toHaveBeenCalledWith(3);
  });

  it("rejects an invalid user id", async () => {
    const res = await request(app).get("/api/profile/users/abc/favorites").set(auth());
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/profile/favorites", () => {
  it("requires authentication", async () => {
    const res = await request(app).put("/api/profile/favorites").send({ albums: [] });
    expect(res.status).toBe(401);
  });

  it("saves the favorites for the authenticated user only", async () => {
    (getFavorites as jest.Mock).mockResolvedValue([]);
    const res = await request(app).put("/api/profile/favorites").set(auth(7)).send({ albums: [album("a"), album("b")] });
    expect(res.status).toBe(200);
    expect(replaceFavorites).toHaveBeenCalledWith(7, [album("a"), album("b")]);
  });

  it("rejects more than four albums", async () => {
    const res = await request(app).put("/api/profile/favorites").set(auth()).send({ albums: ["a", "b", "c", "d", "e"].map(album) });
    expect(res.status).toBe(400);
    expect(replaceFavorites).not.toHaveBeenCalled();
  });

  it("rejects duplicated albums", async () => {
    const res = await request(app).put("/api/profile/favorites").set(auth()).send({ albums: [album("a"), album("a")] });
    expect(res.status).toBe(400);
    expect(replaceFavorites).not.toHaveBeenCalled();
  });
});

describe("GET /api/profile/users/:userId/activity", () => {
  it("returns the activity page", async () => {
    (getUserActivity as jest.Mock).mockResolvedValue([{ type: "like", review_id: 1 }]);
    const res = await request(app).get("/api/profile/users/3/activity?page=2").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(getUserActivity).toHaveBeenCalledWith(3, 2);
  });

  it("rejects an invalid page", async () => {
    const res = await request(app).get("/api/profile/users/3/activity?page=0").set(auth());
    expect(res.status).toBe(400);
  });
});
