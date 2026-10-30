jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn(async () => mockConnection),
    getPool: jest.fn(() => ({ getConnection: async () => mockConnection })),
}));
import sharp from "sharp";
import { prepareListImage } from "../../modules/lists/lists.images";
import { moveListItem, readListImage, saveListImage } from "../../modules/lists/lists.identity.repository";
import { addListItem, removeListItem } from "../../modules/lists/lists.repository";
import { migrateListIdentity } from "../../mysql2/migrations/003-list-identity";
import { initDatabase } from "../../mysql2/init.database";

const mockConnection = {
    query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    mockConnection.query.mockResolvedValue([[], []]);
});
const owned = { user_id: 7, order_revision: 3 };

it.each(["thumbnail", "banner"] as const)("decodes and re-encodes %s with exact dimensions and without source metadata", async (kind) => {
    const source = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#123456" } }).png().withMetadata().toBuffer();
    const output = await prepareListImage(source, kind);
    const metadata = await sharp(output).metadata();
    expect([metadata.width, metadata.height]).toEqual(kind === "thumbnail" ? [512, 512] : [1600, 480]);
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(output.length).toBeLessThanOrEqual(2 * 1024 * 1024);
});

it("rejects oversized, disguised, truncated and undersized files explicitly", async () => {
    await expect(prepareListImage(Buffer.alloc(2 * 1024 * 1024 + 1), "banner")).rejects.toMatchObject({ status: 413 });
    await expect(prepareListImage(Buffer.from("<svg></svg>"), "thumbnail")).rejects.toMatchObject({ status: 415 });
    await expect(prepareListImage(Buffer.from([0xff, 0xd8, 0xff]), "thumbnail")).rejects.toMatchObject({ status: 422 });
    const tiny = await sharp({ create: { width: 63, height: 100, channels: 3, background: "#000000" } }).png().toBuffer();
    await expect(prepareListImage(tiny, "banner")).rejects.toMatchObject({ status: 422 });
    const huge = await sharp({ create: { width: 4100, height: 4000, channels: 3, background: "#000000" } }).png().toBuffer();
    await expect(prepareListImage(huge, "banner")).rejects.toMatchObject({ status: 422 });
});

it.each([[[], 404], [[{ user_id: 8 }], 403]])("rolls back image mutations for missing or non-owned lists", async (rows, status) => {
    mockConnection.query.mockResolvedValueOnce([rows, []]);
    await expect(saveListImage(4, 7, "banner", Buffer.from("safe"))).rejects.toMatchObject({ status });
    expect(mockConnection.rollback).toHaveBeenCalled();
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
});

it("stores only sanitized bytes under the parent lock and rolls back if revision update fails", async () => {
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]).mockRejectedValueOnce(new Error("db failure"));
    await expect(saveListImage(4, 7, "thumbnail", Buffer.from("safe"))).rejects.toThrow("db failure");
    expect(mockConnection.query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(mockConnection.query.mock.calls[1][1]).toEqual([4, "thumbnail", Buffer.from("safe")]);
    expect(mockConnection.rollback).toHaveBeenCalled();
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("checks file visibility in SQL, denies private bytes and returns only allowed content", async () => {
    mockConnection.query.mockResolvedValueOnce([[{ user_id: 7, is_public: 0, content: null }], []]);
    await expect(readListImage(4, "banner")).rejects.toMatchObject({ status: 403 });
    expect(mockConnection.query.mock.calls[0][0]).toContain("CASE WHEN l.is_public = TRUE OR l.user_id = ? THEN image.content ELSE NULL");
    mockConnection.query.mockResolvedValueOnce([[{ user_id: 7, is_public: 0, content: Buffer.from("safe") }], []]);
    expect(await readListImage(4, "banner", 7)).toEqual(Buffer.from("safe"));
    mockConnection.query.mockResolvedValueOnce([[{ user_id: 7, is_public: 1, content: null }], []]);
    await expect(readListImage(4, "banner")).rejects.toMatchObject({ status: 404 });
});

it("moves across pages with a single atomic position rewrite, stable legacy order and no duplicate IDs", async () => {
    const items = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 }));
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([items, []]);
    expect(await moveListItem(4, 7, { revision: 3, itemId: 1, toPosition: 1000 })).toEqual({ revision: 4, page: 42 });
    expect(mockConnection.query.mock.calls[1][0]).toContain("ORDER BY COALESCE(position, 0), created_at, id FOR UPDATE");
    const [sql, params] = mockConnection.query.mock.calls[2];
    expect(sql).toContain("UPDATE list_items SET position = CASE id");
    expect(params.slice(0, 4)).toEqual([2, 0, 3, 1]);
    expect(params.slice(-3)).toEqual([1, 999, 4]);
    expect(new Set(params.slice(0, -1).filter((_value: number, index: number) => index % 2 === 0)).size).toBe(1000);
    expect(mockConnection.query.mock.calls[3][0]).toContain("order_revision = order_revision + 1");
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
});

it("rejects stale order before reading items and rolls back invalid destinations", async () => {
    mockConnection.query.mockResolvedValueOnce([[owned], []]);
    await expect(moveListItem(4, 7, { revision: 2, itemId: 1, toPosition: 2 })).rejects.toMatchObject({ status: 409 });
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([[{ id: 1 }], []]);
    await expect(moveListItem(4, 7, { revision: 3, itemId: 1, toPosition: 2 })).rejects.toMatchObject({ status: 400 });
    expect(mockConnection.rollback).toHaveBeenCalledTimes(2);
});

it("rolls back all positions when the revision write fails", async () => {
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []])
        .mockResolvedValueOnce([{ affectedRows: 2 }, []]).mockRejectedValueOnce(new Error("revision failure"));
    await expect(moveListItem(4, 7, { revision: 3, itemId: 1, toPosition: 2 })).rejects.toThrow("revision failure");
    expect(mockConnection.rollback).toHaveBeenCalled();
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("preserves revision for a no-op and rejects an item outside the list without writing", async () => {
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []]);
    expect(await moveListItem(4, 7, { revision: 3, itemId: 1, toPosition: 1 })).toEqual({ revision: 3, page: 1 });
    expect(mockConnection.query).toHaveBeenCalledTimes(2);
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([[{ id: 1 }], []]);
    await expect(moveListItem(4, 7, { revision: 3, itemId: 99, toPosition: 1 })).rejects.toMatchObject({ status: 404 });
    expect(mockConnection.query).toHaveBeenCalledTimes(4);
});

it("appends new albums under the same lock and advances the revision", async () => {
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ next_position: 25 }], []]).mockResolvedValueOnce([{ affectedRows: 1, insertId: 100 }, []]);
    expect(await addListItem(4, { albumId: "mbid" }, 7)).toBe(true);
    expect(mockConnection.query.mock.calls[3][1].at(-1)).toBe(25);
    expect(mockConnection.query.mock.calls[4][0]).toContain("order_revision = order_revision + 1");
});

it("does not advance the revision on duplicate albums and advances on actual removal", async () => {
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([[{ id: 1 }], []]);
    expect(await addListItem(4, { albumId: "mbid" }, 7)).toBe(false);
    expect(mockConnection.query).toHaveBeenCalledTimes(2);
    mockConnection.query.mockResolvedValueOnce([[owned], []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    expect(await removeListItem(4, "mbid", 7)).toBe(true);
    expect(mockConnection.query.mock.calls[4][0]).toContain("order_revision = order_revision + 1");
});

it("migrates only missing revision fields and an additive cascading image table, safely on repeat", async () => {
    mockConnection.query.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[], []]).mockResolvedValueOnce([{}, []]);
    await migrateListIdentity(await initDatabase());
    expect(mockConnection.query.mock.calls.filter(([sql]) => sql.startsWith("ALTER TABLE"))).toHaveLength(2);
    expect(mockConnection.query.mock.calls.at(-1)?.[0]).toContain("REFERENCES lists(id) ON DELETE CASCADE");
    mockConnection.query.mockClear();
    mockConnection.query.mockResolvedValue([[{ COLUMN_NAME: "present" }], []]);
    await migrateListIdentity(await initDatabase());
    expect(mockConnection.query.mock.calls.some(([sql]) => sql.startsWith("ALTER TABLE"))).toBe(false);
});
