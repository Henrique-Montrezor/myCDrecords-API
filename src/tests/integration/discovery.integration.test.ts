jest.mock("../../modules/musicbrainz/musicbrainz.service", () => ({
    fetchMusicBrainz: jest.fn(),
}));
jest.mock("../../modules/albums/album.catalog.repository");

import express from "express";
import request from "supertest";
import albumRoutes from "../../modules/albums/album.routes";
import { fetchMusicBrainz } from "../../modules/musicbrainz/musicbrainz.service";
import { errorHandler } from "../../middlewares/error.middleware";
import { saveCatalogAlbums } from "../../modules/albums/album.catalog.repository";

const app = express();
app.use("/api/albums", albumRoutes);
app.use(errorHandler);
const musicbrainz = jest.mocked(fetchMusicBrainz);
const id = "12a6363a-213c-3d21-aa59-8b2f0e7227b6";

beforeEach(() => {
    musicbrainz.mockReset();
    jest.mocked(saveCatalogAlbums).mockReset().mockResolvedValue(undefined);
});

describe("GET /api/albums/discover", () => {
    it("returns catalog albums with provenance and real pagination", async () => {
        musicbrainz.mockResolvedValue({
            count: 30,
            "release-groups": [{ id, title: "Disco de teste", "artist-credit": [{ name: "Banda de teste" }], "first-release-date": "2025-02-01" }],
        });
        const res = await request(app).get("/api/albums/discover?genre=gothic+rock&year=2025&type=ep&offset=12");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            source: "musicbrainz", total: 30, nextOffset: 24,
            items: [{ id, title: "Disco de teste", source: "musicbrainz" }],
        });
        expect(res.body.updatedAt).toEqual(expect.any(String));
        expect(musicbrainz).toHaveBeenCalledWith("release-group/", expect.objectContaining({
            query: 'primarytype:ep AND firstreleasedate:2025 AND tag:"gothic rock"',
            limit: 12, offset: 12,
        }));
        expect(saveCatalogAlbums).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id })]));
    });

    it("uses the current year by default and ends pagination from the provider total", async () => {
        musicbrainz.mockResolvedValue({ count: 0, "release-groups": [] });
        const res = await request(app).get("/api/albums/discover");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ items: [], total: 0, nextOffset: null });
        expect(musicbrainz).toHaveBeenCalledWith("release-group/", expect.objectContaining({
            query: `primarytype:album AND firstreleasedate:${new Date().getFullYear()}`,
        }));
    });

    it.each(["genre=unknown", "year=abc", "year=1800", "type=podcast", "offset=-1", "offset=1.5", "offset=1001", "genre=rock&genre=pop"])("rejects invalid filters: %s", async (query) => {
        const res = await request(app).get(`/api/albums/discover?${query}`);
        expect(res.status).toBe(400);
        expect(musicbrainz).not.toHaveBeenCalled();
    });

    it("reports provider failure instead of returning an empty success", async () => {
        musicbrainz.mockRejectedValue(new Error("provider unavailable"));
        expect((await request(app).get("/api/albums/discover")).status).toBe(502);
    });

    it("rejects malformed provider data as an upstream failure", async () => {
        musicbrainz.mockResolvedValue({ "release-groups": null });
        expect((await request(app).get("/api/albums/discover")).status).toBe(502);
    });

    it("reports local persistence failure without disguising it as a provider error", async () => {
        musicbrainz.mockResolvedValue({ count: 1, "release-groups": [{ id, title: "Disco" }] });
        jest.mocked(saveCatalogAlbums).mockRejectedValue(new Error("storage unavailable"));
        expect((await request(app).get("/api/albums/discover")).status).toBe(503);
    });
});
