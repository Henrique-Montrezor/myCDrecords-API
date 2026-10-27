/**
 * Integration tests for the home endpoints: activity feed and recommendations.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/social/social.repository", () => ({
  getFollowingFeed: jest.fn(),
}));

jest.mock("../../modules/recommendations/recommendations.repository", () => ({
  getCollaborativeRecommendations: jest.fn(),
  getGenreRecommendations: jest.fn(),
  getPopularRecommendations: jest.fn(),
  getTasteProfile: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { cache } from "../../utils/cache";
import { getFollowingFeed } from "../../modules/social/social.repository";
import {
  getCollaborativeRecommendations,
  getGenreRecommendations,
  getPopularRecommendations,
  getTasteProfile,
} from "../../modules/recommendations/recommendations.repository";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

const rec = { album_id: "a1", album_title: "Album", album_artist: "Artist" };

beforeEach(() => {
  jest.clearAllMocks();
  cache.flushAll();
  (getTasteProfile as jest.Mock).mockResolvedValue({ reviews: 0, favorites: 0 });
  (getCollaborativeRecommendations as jest.Mock).mockResolvedValue([]);
  (getGenreRecommendations as jest.Mock).mockResolvedValue([]);
  (getPopularRecommendations as jest.Mock).mockResolvedValue([]);
});

describe("GET /api/social/feed", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/social/feed");
    expect(res.status).toBe(401);
  });

  it("defaults to everyone the user follows, first page", async () => {
    (getFollowingFeed as jest.Mock).mockResolvedValue([{ type: "review", id: 1 }]);
    const res = await request(app).get("/api/social/feed").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ type: "review", id: 1 }]);
    expect(getFollowingFeed).toHaveBeenCalledWith(7, 1, "following");
  });

  it("filters mutual friends", async () => {
    (getFollowingFeed as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get("/api/social/feed?scope=friends&page=2").set(auth());
    expect(res.status).toBe(200);
    expect(getFollowingFeed).toHaveBeenCalledWith(7, 2, "friends");
  });

  it("rejects an unknown scope", async () => {
    const res = await request(app).get("/api/social/feed?scope=everyone").set(auth());
    expect(res.status).toBe(400);
    expect(getFollowingFeed).not.toHaveBeenCalled();
  });
});

describe("GET /api/recommendations", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/recommendations");
    expect(res.status).toBe(401);
  });

  it("prefers collaborative recommendations and reports the taste profile", async () => {
    (getTasteProfile as jest.Mock).mockResolvedValue({ reviews: 3, favorites: 1 });
    (getCollaborativeRecommendations as jest.Mock).mockResolvedValue([rec]);
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tipo: "colaborativa", data: [rec], perfil: { reviews: 3, favorites: 1 } });
    expect(getGenreRecommendations).not.toHaveBeenCalled();
  });

  it("falls back to genre affinity, then to popular albums", async () => {
    (getGenreRecommendations as jest.Mock).mockResolvedValue([rec]);
    const byGenre = await request(app).get("/api/recommendations").set(auth(7));
    expect(byGenre.body.tipo).toBe("genero");

    (getGenreRecommendations as jest.Mock).mockResolvedValue([]);
    (getPopularRecommendations as jest.Mock).mockResolvedValue([rec]);
    const popular = await request(app).get("/api/recommendations").set(auth(8));
    expect(popular.body.tipo).toBe("popular");
  });

  it("returns an empty result with the profile when there is nothing to recommend", async () => {
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tipo: "vazio", data: [], perfil: { reviews: 0, favorites: 0 } });
  });

  it("serves cached suggestions but always refreshes the taste profile", async () => {
    (getCollaborativeRecommendations as jest.Mock).mockResolvedValue([rec]);
    await request(app).get("/api/recommendations").set(auth());
    (getTasteProfile as jest.Mock).mockResolvedValue({ reviews: 1, favorites: 0 });
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(getCollaborativeRecommendations).toHaveBeenCalledTimes(1);
    expect(res.body.perfil).toEqual({ reviews: 1, favorites: 0 });
  });
});
