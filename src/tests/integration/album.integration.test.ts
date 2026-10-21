/**
 * Integration tests for GET /api/albums/:id and GET /api/reviews/albums/:albumId/summary.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/spotify/spotify.service", () => ({
  fetchAlbumFromSpotify: jest.fn(),
  searchSpotifyAlbum: jest.fn(),
  searchSpotify: jest.fn(),
}));

jest.mock("../../modules/musicbrainz/musicbrainz.service", () => ({
  fetchMusicBrainz: jest.fn(),
}));

jest.mock("../../modules/reviews/reviews.repository", () => ({
  getAlbumRatingCounts: jest.fn(),
  getReviewsByAlbumId: jest.fn(),
  getReviewsByUserId: jest.fn(),
  postReview: jest.fn(),
  deleteReview: jest.fn(),
  updateReview: jest.fn(),
  checkReview: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { fetchAlbumFromSpotify } from "../../modules/spotify/spotify.service";
import { fetchMusicBrainz } from "../../modules/musicbrainz/musicbrainz.service";
import { getAlbumRatingCounts } from "../../modules/reviews/reviews.repository";

const mockedSpotify = fetchAlbumFromSpotify as jest.Mock;
const mockedMusicBrainz = fetchMusicBrainz as jest.Mock;
const mockedCounts = getAlbumRatingCounts as jest.Mock;

const MBID = "12a6363a-213c-3d21-aa59-8b2f0e7227b6";

describe("GET /api/albums/:id", () => {
  const originalId = process.env.SPOTIFY_CLIENT_ID;
  const originalSecret = process.env.SPOTIFY_CLIENT_SECRET;

  beforeEach(() => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
  });

  afterAll(() => {
    if (originalId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
    else process.env.SPOTIFY_CLIENT_SECRET = originalSecret;
  });

  it("returns Spotify albums in the unified shape", async () => {
    mockedSpotify.mockResolvedValue({ id: "abc", name: "Patient Zero", artists: [{ name: "Taylor Swift" }], tracks: { items: [] } });

    const res = await request(app).get("/api/albums/abc");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "abc", source: "spotify", title: "Patient Zero", artists: [{ name: "Taylor Swift" }], tracks: [] });
  });

  it("resolves a MusicBrainz MBID without calling Spotify", async () => {
    mockedMusicBrainz.mockImplementation(async (endpoint: string) =>
      endpoint.startsWith("release-group/")
        ? { id: MBID, title: "Nevermind", "artist-credit": [{ name: "Nirvana" }], releases: [{ id: "rel1", status: "Official", date: "1991-09-24" }] }
        : { media: [{ position: 1, tracks: [{ id: "t1", position: 1, title: "Breed", length: 183000 }] }] }
    );

    const res = await request(app).get(`/api/albums/${MBID}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ source: "musicbrainz", title: "Nevermind", totalTracks: 1 });
    expect(mockedSpotify).not.toHaveBeenCalled();
  });

  it("keeps the album when only the MusicBrainz tracklist fails", async () => {
    mockedMusicBrainz.mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith("release-group/")) return { id: MBID, title: "Nevermind", releases: [{ id: "rel1" }] };
      throw { status: 503, message: "busy" };
    });

    const res = await request(app).get(`/api/albums/${MBID}`);

    expect(res.status).toBe(200);
    expect(res.body.tracks).toEqual([]);
  });

  it("returns 404 when the provider does not know the album", async () => {
    mockedMusicBrainz.mockRejectedValue({ status: 404, message: "Not Found" });
    expect((await request(app).get(`/api/albums/${MBID}`)).status).toBe(404);

    mockedSpotify.mockRejectedValue({ response: { status: 400 } });
    expect((await request(app).get("/api/albums/not-a-real-id")).status).toBe(404);
  });

  it("returns 502 when the provider fails", async () => {
    mockedSpotify.mockRejectedValue({ response: { status: 500 } });
    expect((await request(app).get("/api/albums/abc")).status).toBe(502);
  });

  it("returns 404 for Spotify-style IDs when Spotify is not configured", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    const res = await request(app).get("/api/albums/abc");
    expect(res.status).toBe(404);
    expect(mockedSpotify).not.toHaveBeenCalled();
  });
});

describe("GET /api/reviews/albums/:albumId/summary", () => {
  const token = () => jwt.sign({ user_id: 1, email: "a@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/reviews/albums/abc/summary");
    expect(res.status).toBe(401);
    expect(mockedCounts).not.toHaveBeenCalled();
  });

  it("returns average, count and distribution", async () => {
    mockedCounts.mockResolvedValue([{ rating: 5, count: 3 }, { rating: 4, count: 1 }]);

    const res = await request(app).get("/api/reviews/albums/abc/summary").set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ average: 4.8, count: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 3 } });
    expect(mockedCounts).toHaveBeenCalledWith("abc");
  });

  it("returns a null average when the album has no reviews", async () => {
    mockedCounts.mockResolvedValue([]);
    const res = await request(app).get("/api/reviews/albums/abc/summary").set("Authorization", `Bearer ${token()}`);
    expect(res.body).toMatchObject({ average: null, count: 0 });
  });
});
