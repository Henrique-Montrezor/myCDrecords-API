jest.mock("../../modules/albums/album.catalog.repository");
jest.mock("../../modules/musicbrainz/musicbrainz.service", () => ({ fetchMusicBrainz: jest.fn() }));
jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn().mockResolvedValue({ execute: jest.fn() }),
}));

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2";
import request from "supertest";
import albumRoutes from "../../modules/albums/album.routes";
import adminRoutes from "../../modules/admin/admin.routes";
import { errorHandler } from "../../middlewares/error.middleware";
import { initDatabase } from "../../mysql2/init.database";
import { getEditorialSelection, publishEditorialSelection, saveCatalogAlbums } from "../../modules/albums/album.catalog.repository";
import { fetchMusicBrainz } from "../../modules/musicbrainz/musicbrainz.service";

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/albums", albumRoutes);
app.use("/api/admin", adminRoutes);
app.use(errorHandler);
const id = "12a6363a-213c-3d21-aa59-8b2f0e7227b6";
const adminRow: RowDataPacket = { user_id: 7, constructor: { name: "RowDataPacket" } };
const auth = () => `Bearer ${jwt.sign({ user_id: 7, email: "editor@example.com" }, process.env.JWT_SECRET as string)}`;

beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(saveCatalogAlbums).mockReset().mockResolvedValue(undefined);
    jest.mocked(fetchMusicBrainz).mockReset();
    const connection = await initDatabase();
    jest.mocked(connection.execute).mockResolvedValue([[], []]);
});

describe("admin catalog import", () => {
    it("rejects anonymous and non-admin imports before querying the provider", async () => {
        expect((await request(app).post(`/api/admin/discovery/catalog/${id}`)).status).toBe(401);
        expect((await request(app).post(`/api/admin/discovery/catalog/${id}`).set("Authorization", auth())).status).toBe(403);
        expect(fetchMusicBrainz).not.toHaveBeenCalled();
        expect(saveCatalogAlbums).not.toHaveBeenCalled();
    });

    it("imports a verified release-group without automatically publishing it", async () => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        jest.mocked(fetchMusicBrainz).mockResolvedValue({ id, title: "Disco para importar", "artist-credit": [{ name: "Banda" }] });
        const res = await request(app).post(`/api/admin/discovery/catalog/${id.toUpperCase()}`).set("Authorization", auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ albumId: id, source: "musicbrainz" });
        expect(fetchMusicBrainz).toHaveBeenCalledWith(`release-group/${id}`, { inc: "artist-credits+tags+genres" });
        expect(saveCatalogAlbums).toHaveBeenCalledWith([expect.objectContaining({ id, title: "Disco para importar" })]);
        expect(publishEditorialSelection).not.toHaveBeenCalled();
    });

    it("rejects malformed IDs before making an upstream request", async () => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        const res = await request(app).post("/api/admin/discovery/catalog/spotify-id").set("Authorization", auth());
        expect(res.status).toBe(400);
        expect(fetchMusicBrainz).not.toHaveBeenCalled();
    });

    it.each([
        { id: "00000000-0000-4000-8000-000000000000", title: "Outro disco" },
        { id, title: null },
    ])("does not save a mismatched or invalid provider response", async (payload) => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        jest.mocked(fetchMusicBrainz).mockResolvedValue(payload);
        expect((await request(app).post(`/api/admin/discovery/catalog/${id}`).set("Authorization", auth())).status).toBe(502);
        expect(saveCatalogAlbums).not.toHaveBeenCalled();
    });

    it.each([404, 429, 500])("exposes provider status %i without inventing a catalog entry", async (status) => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        jest.mocked(fetchMusicBrainz).mockRejectedValue({ status });
        const res = await request(app).post(`/api/admin/discovery/catalog/${id}`).set("Authorization", auth());
        expect(res.status).toBe(status === 404 ? 404 : 502);
        expect(saveCatalogAlbums).not.toHaveBeenCalled();
    });

    it("distinguishes storage failure from a missing upstream album", async () => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        jest.mocked(fetchMusicBrainz).mockResolvedValue({ id, title: "Disco" });
        jest.mocked(saveCatalogAlbums).mockRejectedValue(new Error("storage down"));
        expect((await request(app).post(`/api/admin/discovery/catalog/${id}`).set("Authorization", auth())).status).toBe(503);
    });
});

describe("editorial discovery selection", () => {
    it("reads a real empty selection without authentication or invented picks", async () => {
        jest.mocked(getEditorialSelection).mockResolvedValue({
            sectionId: "editorial", kind: "editorial", title: "Escolhas da curadoria",
            source: "mycdrecords", revision: 0, updatedAt: null, curator: null, items: [],
        });
        const res = await request(app).get("/api/albums/discover/selection");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "empty", revision: 0, items: [] });
    });

    it("exposes a failed read as unavailable, not an empty success", async () => {
        jest.mocked(getEditorialSelection).mockRejectedValue(new Error("database down"));
        expect((await request(app).get("/api/albums/discover/selection")).status).toBe(503);
    });

    it("requires authentication and existing admin permission for publication", async () => {
        expect((await request(app).put("/api/admin/discovery/selection").send({ revision: 0, items: [] })).status).toBe(401);
        expect((await request(app).put("/api/admin/discovery/selection").set("Authorization", auth()).send({ revision: 0, items: [] })).status).toBe(403);
        expect(publishEditorialSelection).not.toHaveBeenCalled();
    });

    it("publishes only validated MusicBrainz IDs with notes for the authenticated admin", async () => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        jest.mocked(publishEditorialSelection).mockResolvedValue(1);
        const payload = { revision: 0, items: [{ albumId: id, note: "Uma escolha para explorar outro caminho." }] };
        const res = await request(app).put("/api/admin/discovery/selection").set("Authorization", auth()).send(payload);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ revision: 1 });
        expect(publishEditorialSelection).toHaveBeenCalledWith(7, payload);
    });

    it.each([
        { revision: 0, items: [{ albumId: "spotify-id", note: "Escolha" }] },
        { revision: 0, items: [{ albumId: id, note: "  " }] },
        { revision: 0, items: [{ albumId: id, note: "A" }, { albumId: id, note: "B" }] },
        { revision: -1, items: [] },
        { items: [] },
        { revision: 0, items: Array.from({ length: 7 }, () => ({ albumId: id, note: "Escolha" })) },
    ])("rejects malformed or duplicate selections", async (payload) => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        const res = await request(app).put("/api/admin/discovery/selection").set("Authorization", auth()).send(payload);
        expect(res.status).toBe(400);
        expect(publishEditorialSelection).not.toHaveBeenCalled();
    });

    it("preserves revision conflicts instead of silently overwriting another curator", async () => {
        const connection = await initDatabase();
        jest.mocked(connection.execute).mockResolvedValue([[adminRow], []]);
        jest.mocked(publishEditorialSelection).mockRejectedValue(Object.assign(new Error("Seleção alterada. Recarregue antes de publicar."), { status: 409 }));
        const res = await request(app).put("/api/admin/discovery/selection").set("Authorization", auth()).send({ revision: 0, items: [] });
        expect(res.status).toBe(409);
    });
});
