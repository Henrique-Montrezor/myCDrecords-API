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

jest.mock("../../modules/recommendations/recommendations.ml.repository", () => ({
  getMLTaste: jest.fn(),
  getMLCatalog: jest.fn(),
}));

jest.mock("../../modules/recommendations/recommendations.repository", () => ({
  ...jest.requireActual("../../modules/recommendations/recommendations.repository"),
  getTasteProfile: jest.fn(),
  getUserTaste: jest.fn(),
  getCatalogAlbums: jest.fn(),
  getTagCandidates: jest.fn(),
  getCollaborativeCandidates: jest.fn(),
  getCommunityStats: jest.fn(),
  getPopularCandidates: jest.fn(),
  getRecommendationPreferences: jest.fn(),
  getPreferenceCandidates: jest.fn(),
  getDismissedRecommendations: jest.fn(),
  saveRecommendationPreferences: jest.fn(),
  addDismissal: jest.fn(),
  removeDismissal: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { cache } from "../../utils/cache";
import { getFollowingFeed } from "../../modules/social/social.repository";
import { getMLCatalog, getMLTaste } from "../../modules/recommendations/recommendations.ml.repository";
import * as mlModel from "../../modules/recommendations/recommendations.ml";
import {
  addDismissal,
  getCatalogAlbums,
  getCollaborativeCandidates,
  getCommunityStats,
  getDismissedRecommendations,
  getPreferenceCandidates,
  getPopularCandidates,
  getRecommendationPreferences,
  getTagCandidates,
  getTasteProfile,
  getUserTaste,
  removeDismissal,
  saveRecommendationPreferences,
} from "../../modules/recommendations/recommendations.repository";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

const mbid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const album = (n: number, artist: string, tags: string[]) => ({ albumId: mbid(n), title: `Album ${n}`, artists: [artist], releaseDate: "1981", tags });
const seeds = [album(1, "Seed", ["gothic rock"]), album(2, "Seed", ["gothic rock"]), album(3, "Seed", ["gothic rock"])];

beforeEach(() => {
  jest.clearAllMocks();
  cache.flushAll();
  (getTasteProfile as jest.Mock).mockResolvedValue({ reviews: 0, favorites: 0 });
  (getUserTaste as jest.Mock).mockResolvedValue({ ratings: new Map(), excluded: new Set() });
  (getCatalogAlbums as jest.Mock).mockResolvedValue([]);
  (getTagCandidates as jest.Mock).mockResolvedValue([]);
  (getCollaborativeCandidates as jest.Mock).mockResolvedValue(new Map());
  (getCommunityStats as jest.Mock).mockResolvedValue(new Map());
  (getPopularCandidates as jest.Mock).mockResolvedValue([]);
  (getRecommendationPreferences as jest.Mock).mockResolvedValue({ genres: [], artists: [] });
  (getPreferenceCandidates as jest.Mock).mockResolvedValue([]);
  (getDismissedRecommendations as jest.Mock).mockResolvedValue({ total: 0, data: [] });
});

function lovesGothicRock(candidates: ReturnType<typeof album>[]) {
  (getTasteProfile as jest.Mock).mockResolvedValue({ reviews: 3, favorites: 0 });
  (getUserTaste as jest.Mock).mockResolvedValue({ ratings: new Map(seeds.map((seed) => [seed.albumId, 5])), excluded: new Set(seeds.map((seed) => seed.albumId)) });
  (getCatalogAlbums as jest.Mock).mockImplementation(async (ids: string[]) => seeds.filter((seed) => ids.includes(seed.albumId)));
  (getTagCandidates as jest.Mock).mockResolvedValue(candidates);
}

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
  it("serves published ML for the authenticated actor only, never caching their vector/ranking", async () => {
    (getMLCatalog as jest.Mock).mockResolvedValue([
      { ...album(201, "Bauhaus", []), source: "musicbrainz" },
      { ...album(202, "John Coltrane", []), source: "musicbrainz" },
      { ...album(203, "The Cure", []), source: "musicbrainz" },
      { ...album(204, "Bauhaus", []), source: "musicbrainz" },
    ]);
    (getMLTaste as jest.Mock).mockImplementation(async (id: number) => ({
      signals: [{ artist: id === 7 ? "The Cure" : "Miles Davis", weight: 1 }],
      excluded: new Set([mbid(203)]),
    }));
    const goth = await request(app).get("/api/recommendations?engine=ml&userId=8&limit=1").set(auth(7));
    const jazz = await request(app).get("/api/recommendations?engine=ml&limit=1").set(auth(8));
    expect(goth.status).toBe(200);
    expect(goth.body).toMatchObject({
      version: "artist-bpr-fictional-v1", evidence: { signals: 1, required: 1 },
      ml: { status: "active", trainedOn: "fictional-profiles" }, nextOffset: expect.anything(),
    });
    expect(goth.body.data[0].album_artist).toBe("Bauhaus");
    expect(goth.body.data[0].reasons).toEqual([{ type: "ml" }]);
    expect(jazz.body.data[0].album_artist).toBe("John Coltrane");
    expect(goth.headers["cache-control"]).toBe("private, no-store");
    expect(getMLTaste).toHaveBeenNthCalledWith(1, 7);
    expect(getMLTaste).toHaveBeenNthCalledWith(2, 8);
    expect(getUserTaste).not.toHaveBeenCalled();
    expect(cache.keys().some((key) => key.startsWith("recommendations_"))).toBe(false);
    const next = await request(app).get("/api/recommendations?engine=ml&limit=1&offset=1").set(auth(7));
    expect(next.body.data.every((item: { album_id: string }) => item.album_id !== mbid(203))).toBe(true);
    expect(getMLTaste).toHaveBeenCalledTimes(3);
  });

  it("identifies insufficient model coverage as an original-engine fallback", async () => {
    (getMLCatalog as jest.Mock).mockResolvedValue([]);
    (getMLTaste as jest.Mock).mockResolvedValue({ signals: [], excluded: new Set() });
    const res = await request(app).get("/api/recommendations?engine=ml").set(auth());
    expect(res.body).toMatchObject({ version: "f11b-v1", ml: { status: "cold_start" } });
    expect(getUserTaste).toHaveBeenCalledWith(7);
  });

  it("reports model failure explicitly and rejects an unknown engine", async () => {
    const spy = jest.spyOn(mlModel, "getArtistModel").mockImplementationOnce(() => { throw new Error("ML_CHECKSUM_MISMATCH"); });
    const res = await request(app).get("/api/recommendations?engine=ml").set(auth());
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("ML_UNAVAILABLE");
    expect(getUserTaste).not.toHaveBeenCalled();
    spy.mockRestore();
    expect((await request(app).get("/api/recommendations?engine=unknown").set(auth())).status).toBe(400);
    expect((await request(app).get("/api/recommendations?engine=ml")).status).toBe(401);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/recommendations");
    expect(res.status).toBe(401);
  });

  it("returns personalized items with per-item reasons, version and evidence", async () => {
    lovesGothicRock([album(10, "Bauhaus", ["gothic rock", "post-punk"])]);
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toEqual({
      tipo: "personalizada",
      version: "f11b-v1",
      evidence: { signals: 3, required: 3 },
      perfil: { reviews: 3, favorites: 0 },
      total: 1,
      offset: 0,
      limit: 12,
      nextOffset: null,
      data: [{
        album_id: mbid(10),
        album_title: "Album 10",
        album_artist: "Bauhaus",
        album_image: `https://coverartarchive.org/release-group/${mbid(10)}/front-250`,
        release_date: "1981",
        source: "musicbrainz",
        reasons: [{ type: "tags", tags: ["gothic rock"] }],
      }],
    });
    expect(getTagCandidates).toHaveBeenCalledWith(expect.arrayContaining(["gothic rock", "darkwave", "gothic metal"]), seeds.map((seed) => seed.albumId));
  });

  it("labels insufficient evidence as community picks", async () => {
    (getPopularCandidates as jest.Mock).mockResolvedValue([{ candidate: album(20, "The Cure", ["post-punk"]), people: 3 }]);
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(res.body.tipo).toBe("popular");
    expect(res.body.evidence).toEqual({ signals: 0, required: 3 });
    expect(res.body.data[0].reasons).toEqual([{ type: "community", people: 3 }]);
  });

  it("personalizes from explicit preferences and explains the matched choices", async () => {
    (getRecommendationPreferences as jest.Mock).mockResolvedValue({ genres: ["ambient", "drone", "minimal"], artists: ["Bauhaus"] });
    (getPreferenceCandidates as jest.Mock).mockResolvedValue([album(21, "Bauhaus", ["ambient"])]);
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(res.body).toMatchObject({ tipo: "personalizada", evidence: { signals: 4, required: 3 } });
    expect(res.body.data[0].reasons).toEqual([{ type: "preferences", genres: ["ambient"], artists: ["Bauhaus"] }]);
    expect(getPreferenceCandidates).toHaveBeenCalledWith({ genres: ["ambient", "drone", "minimal"], artists: ["Bauhaus"] }, []);
  });

  it("returns an empty result with the profile when there is nothing to recommend", async () => {
    const res = await request(app).get("/api/recommendations").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tipo: "vazio", data: [], total: 0, nextOffset: null, perfil: { reviews: 0, favorites: 0 } });
  });

  it("pages a stable cached ranking and always refreshes the taste profile", async () => {
    lovesGothicRock(Array.from({ length: 5 }, (_, index) => album(30 + index, `Artist ${index}`, ["gothic rock"])));
    const first = await request(app).get("/api/recommendations?limit=2").set(auth());
    expect(first.body).toMatchObject({ total: 5, offset: 0, limit: 2, nextOffset: 2 });
    (getTasteProfile as jest.Mock).mockResolvedValue({ reviews: 4, favorites: 0 });
    const last = await request(app).get("/api/recommendations?limit=2&offset=4").set(auth());
    expect(last.body).toMatchObject({ offset: 4, nextOffset: null, perfil: { reviews: 4, favorites: 0 } });
    expect(last.body.data).toHaveLength(1);
    const ids = [...first.body.data, ...last.body.data].map((item: { album_id: string }) => item.album_id);
    expect(new Set(ids).size).toBe(3);
    expect(getTagCandidates).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid paging", async () => {
    for (const query of ["limit=0", "limit=49", "offset=-1", "offset=121", "limit=abc"]) {
      const res = await request(app).get(`/api/recommendations?${query}`).set(auth());
      expect(res.status).toBe(400);
    }
  });
});

describe("recommendation dismissals", () => {
  it("requires authentication", async () => {
    const res = await request(app).put(`/api/recommendations/dismissed/${mbid(1)}`);
    expect(res.status).toBe(401);
  });

  it("only accepts MusicBrainz IDs", async () => {
    const res = await request(app).put("/api/recommendations/dismissed/3EB8m11r5Rls7NtOU7mkx5").set(auth());
    expect(res.status).toBe(400);
    expect(addDismissal).not.toHaveBeenCalled();
  });

  it("dismisses idempotently, undoes, and invalidates the cached ranking", async () => {
    lovesGothicRock([album(40, "Bauhaus", ["gothic rock"])]);
    await request(app).get("/api/recommendations").set(auth());
    const dismissed = await request(app).put(`/api/recommendations/dismissed/${mbid(40).toUpperCase()}`).set(auth());
    expect(dismissed.status).toBe(204);
    expect(addDismissal).toHaveBeenCalledWith(7, mbid(40));
    await request(app).get("/api/recommendations").set(auth());
    expect(getTagCandidates).toHaveBeenCalledTimes(2);

    const undone = await request(app).delete(`/api/recommendations/dismissed/${mbid(40)}`).set(auth());
    expect(undone.status).toBe(204);
    expect(removeDismissal).toHaveBeenCalledWith(7, mbid(40));
  });
});

describe("recommendation preferences and dismissed list", () => {
  it("reads preferences for the authenticated user without shared caching", async () => {
    (getRecommendationPreferences as jest.Mock).mockResolvedValue({ genres: ["ambient"], artists: ["Bauhaus"] });
    const res = await request(app).get("/api/recommendations/preferences").set(auth(8));
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toEqual({ genres: ["ambient"], artists: ["Bauhaus"] });
    expect(getRecommendationPreferences).toHaveBeenCalledWith(8);
  });

  it("normalizes and saves preferences, while rejecting duplicates", async () => {
    await request(app).get("/api/recommendations").set(auth());
    const saved = await request(app).put("/api/recommendations/preferences").set(auth()).send({ genres: ["  Ambient "], artists: ["Bauhaus"] });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ genres: ["ambient"], artists: ["Bauhaus"] });
    expect(saveRecommendationPreferences).toHaveBeenCalledWith(7, { genres: ["ambient"], artists: ["Bauhaus"] });

    const duplicate = await request(app).put("/api/recommendations/preferences").set(auth()).send({ genres: ["Ambient", "ambient"], artists: [] });
    expect(duplicate.status).toBe(400);
    expect(saveRecommendationPreferences).toHaveBeenCalledTimes(1);
    await request(app).get("/api/recommendations").set(auth());
    expect(getRecommendationPreferences).toHaveBeenCalledTimes(2);
  });

  it("returns only the authenticated user's dismissed page", async () => {
    (getDismissedRecommendations as jest.Mock).mockResolvedValue({ total: 1, data: [{ album_id: mbid(5), album_title: "Album 5", album_artist: "Bauhaus", source: "musicbrainz" }] });
    const res = await request(app).get("/api/recommendations/dismissed?limit=1&offset=0").set(auth(9));
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toMatchObject({ total: 1, offset: 0, limit: 1, nextOffset: null });
    expect(getDismissedRecommendations).toHaveBeenCalledWith(9, 1, 0);
  });
});
