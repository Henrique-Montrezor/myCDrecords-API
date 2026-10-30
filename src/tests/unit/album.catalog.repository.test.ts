jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn(async () => ({ query: mockConnection.query })),
    getPool: jest.fn(() => ({ getConnection: jest.fn(async () => mockConnection) })),
}));

import { getEditorialSelection, publishEditorialSelection, saveCatalogAlbums } from "../../modules/albums/album.catalog.repository";
import { catalogAlbumSchema, editorialSelectionSchema } from "../../modules/albums/album.catalog";
import { migrateDiscoveryCatalog } from "../../mysql2/migrations/001-discovery";
import { initDatabase } from "../../mysql2/init.database";

const mockConnection = {
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
};
const id = "12a6363a-213c-3d21-aa59-8b2f0e7227b6";
const input = { revision: 3, items: [{ albumId: id, note: "Uma escolha com motivo." }] };

beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    mockConnection.query.mockResolvedValue([[], []]);
});

describe("persistent discovery catalog", () => {
    it("normalizes source identity and tags without merging titles across identities", async () => {
        const album = catalogAlbumSchema.parse({
            id: id.toUpperCase(), title: "Mesmo título",
            "artist-credit": [{ artist: { name: "Banda" } }],
            tags: [{ name: " Gothic Rock " }, { name: "gothic rock" }],
        });
        await saveCatalogAlbums([album]);
        const [sql, [values]] = mockConnection.query.mock.calls[0];
        expect(sql).toContain("ON DUPLICATE KEY UPDATE");
        expect(sql).not.toContain("external_id = VALUES");
        expect(values).toEqual([["musicbrainz", id, "Mesmo título", '[{"name":"Banda"}]', null, null, '["gothic rock"]', `https://musicbrainz.org/release-group/${id}`]]);
    });

    it("does not write a synthetic album for empty results", async () => {
        await saveCatalogAlbums([]);
        expect(mockConnection.query).not.toHaveBeenCalled();
    });

    it("reads JSON columns and preserves curator order and publication provenance", async () => {
        mockConnection.query.mockResolvedValue([[
            { revision: 3, updated_at: new Date("2026-10-29T12:00:00Z"), curator: "editora", external_id: id, title: "Disco",
                artists: '[{"name":"Banda"}]', release_date: "2025", note: "Escolha real" },
        ], []]);
        const result = await getEditorialSelection();
        expect(result).toMatchObject({
            revision: 3, curator: "editora", updatedAt: "2026-10-29T12:00:00.000Z",
            items: [{ album: { id, source: "musicbrainz", title: "Disco", artistCredit: [{ name: "Banda" }] }, note: "Escolha real" }],
        });
        expect(mockConnection.query.mock.calls[0][0]).toContain("ORDER BY i.position ASC");
    });

    it("fails explicitly if the migration has not initialized the singleton", async () => {
        await expect(getEditorialSelection()).rejects.toThrow("not initialized");
    });

    it("reads an unpublished selection without interpreting it as an error", async () => {
        mockConnection.query.mockResolvedValue([[
            { revision: 0, updated_at: null, curator: null, external_id: null, title: null, artists: null, release_date: null, note: null },
        ], []]);
        expect(await getEditorialSelection()).toMatchObject({ revision: 0, updatedAt: null, items: [] });
    });
});

describe("atomic editorial publication", () => {
    it("accepts exactly six distinct albums and 800-character notes, preserving request order", async () => {
        const ids = Array.from({ length: 6 }, (_, index) => `12a6363a-213c-3d21-aa59-${String(index + 1).padStart(12, "0")}`);
        const payload = editorialSelectionSchema.parse({ revision: 3, items: ids.map((albumId) => ({ albumId, note: "x".repeat(800) })) });
        mockConnection.query
            .mockResolvedValueOnce([{ affectedRows: 1 }, []])
            .mockResolvedValueOnce([ids.map((external_id, index) => ({ id: index + 10, external_id })).reverse(), []]);
        expect(await publishEditorialSelection(7, payload)).toBe(4);
        expect(mockConnection.query.mock.calls[3][1][0]).toEqual(ids.map((_, index) => [index + 1, index + 10, "x".repeat(800)]));
        expect(editorialSelectionSchema.safeParse({ ...payload, items: [...payload.items, { albumId: id, note: "Sétimo" }] }).success).toBe(false);
        expect(editorialSelectionSchema.safeParse({ revision: 3, items: [{ albumId: id, note: "x".repeat(801) }] }).success).toBe(false);
    });

    it("publishes ordered entries and increments revision in one transaction", async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ affectedRows: 1 }, []])
            .mockResolvedValueOnce([[{ id: 11, external_id: id }], []]);
        expect(await publishEditorialSelection(7, input)).toBe(4);
        expect(mockConnection.query.mock.calls[3][1]).toEqual([[[1, 11, "Uma escolha com motivo."]]]);
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it("rolls back a revision conflict before replacing entries", async () => {
        mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
        await expect(publishEditorialSelection(7, input)).rejects.toMatchObject({ status: 409 });
        expect(mockConnection.query).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it("rolls back when a requested album is not known", async () => {
        mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        await expect(publishEditorialSelection(7, input)).rejects.toMatchObject({ status: 404 });
        expect(mockConnection.query.mock.calls.some(([sql]) => sql.includes("DELETE"))).toBe(false);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    });

    it("does not leave a half-empty selection if inserting fails", async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ affectedRows: 1 }, []])
            .mockResolvedValueOnce([[{ id: 11, external_id: id }], []])
            .mockResolvedValueOnce([{}, []])
            .mockRejectedValueOnce(new Error("storage error"));
        await expect(publishEditorialSelection(7, input)).rejects.toThrow("storage error");
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it("can explicitly unpublish all entries with revision protection", async () => {
        mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        expect(await publishEditorialSelection(7, { revision: 3, items: [] })).toBe(4);
        expect(mockConnection.query.mock.calls[1][0]).toBe("DELETE FROM discovery_selection_items");
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });
});

it("uses repeatable additive DDL without dropping tables or resetting published state", async () => {
    const connection = await initDatabase();
    await migrateDiscoveryCatalog(connection);
    await migrateDiscoveryCatalog(connection);
    const statements = mockConnection.query.mock.calls.map(([sql]) => sql);
    expect(statements.every((sql) => sql.includes("CREATE TABLE IF NOT EXISTS") || sql.includes("INSERT IGNORE"))).toBe(true);
    expect(statements).toHaveLength(8);
});
