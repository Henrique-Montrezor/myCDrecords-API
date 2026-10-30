jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn(async () => mockConnection),
    getPool: jest.fn(() => ({ getConnection: async () => mockConnection })),
}));

import { setListSaved, exploreLists } from "../../modules/lists/lists.discovery.repository";
import { updateList } from "../../modules/lists/lists.repository";
import { listDiscoverySchema } from "../../modules/lists/lists.schema";
import { migrateListSaves } from "../../mysql2/migrations/002-list-saves";
import { initDatabase } from "../../mysql2/init.database";

const mockConnection = {
    query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
beforeEach(() => {
    Object.values(mockConnection).forEach((mock) => mock.mockReset());
    mockConnection.query.mockResolvedValue([[], []]);
});

it("idempotent saving locks visibility, preserves the original timestamp and commits", async () => {
    mockConnection.query.mockResolvedValueOnce([[{ user_id: 8, is_public: 1 }], []]);
    await setListSaved(4, 7, true);
    expect(mockConnection.query.mock.calls[0]).toEqual(["SELECT user_id, is_public FROM lists WHERE id = ? FOR UPDATE", [4]]);
    expect(mockConnection.query.mock.calls[1][0]).toContain("ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)");
    expect(mockConnection.query.mock.calls[1][0]).not.toContain("created_at =");
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
});

it.each([
    [[], 404], [[{ user_id: 8, is_public: 0 }], 403], [[{ user_id: 7, is_public: 1 }], 400],
])("rolls back saves for invalid or forbidden lists", async (rows, status) => {
    mockConnection.query.mockResolvedValueOnce([rows, []]);
    await expect(setListSaved(4, 7, true)).rejects.toMatchObject({ status });
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("allows idempotent removal after the list becomes private", async () => {
    mockConnection.query.mockResolvedValueOnce([[{ user_id: 8, is_public: 0 }], []]);
    await setListSaved(4, 7, false);
    expect(mockConnection.query.mock.calls[1]).toEqual(["DELETE FROM list_saves WHERE list_id = ? AND user_id = ?", [4, 7]]);
});

it("rolls back the visibility update when cleaning saved markers fails", async () => {
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]).mockRejectedValueOnce(new Error("storage failure"));
    await expect(updateList(4, 8, { isPublic: false })).rejects.toThrow("storage failure");
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
});

it("does not clean other users' saves on an unauthorized private update", async () => {
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    expect(await updateList(4, 7, { isPublic: false })).toBe(false);
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
});

it("uses private visibility, stable ordering and bounded batches without fetching list contents per card", async () => {
    mockConnection.query.mockResolvedValueOnce([[{ total: 1 }], []])
        .mockResolvedValueOnce([[{ id: 4, user_id: 8, is_public: 1, is_saved: 0, item_count: 1000, save_count: 3 }], []])
        .mockResolvedValueOnce([[{ list_id: 4, album_id: "one", album_image: null }], []]);
    const result = await exploreLists(7, listDiscoverySchema.parse({ scope: "friends", q: "%_!" }));
    expect(result.items[0]).toMatchObject({ item_count: 1000, is_saved: false, previews: [{ album_id: "one" }] });
    const [countSql, countParams] = mockConnection.query.mock.calls[0];
    expect(countSql).toContain("l.is_public = TRUE");
    expect(countSql).toContain("f.follower_id = l.user_id AND f.following_id = ?");
    expect(countSql).toContain("COUNT(DISTINCT s.user_id)");
    expect(countSql).toContain("s.user_id <> visible.user_id");
    expect(countSql).toContain("INTERVAL 30 DAY");
    expect(countSql).toContain(">= 3");
    expect(countParams).toEqual([7, 7, "%!%!_!!%", "%!%!_!!%"]);
    expect(mockConnection.query.mock.calls[1][0]).toContain("save_count DESC, l.created_at DESC, l.id DESC");
    expect(mockConnection.query.mock.calls[2][0]).toContain("LIMIT 4");
    expect(mockConnection.query.mock.calls[2][1]).toEqual([4, 7]);
    expect(mockConnection.query).toHaveBeenCalledTimes(3);
});

it("falls back to recent only when the filtered ranking has no eligible list", async () => {
    mockConnection.query.mockResolvedValueOnce([[{ total: 0 }], []])
        .mockResolvedValueOnce([[{ total: 1 }], []])
        .mockResolvedValueOnce([[{ id: 4, item_count: 0, save_count: 0, is_saved: 0, is_public: 1 }], []]);
    const result = await exploreLists(7, listDiscoverySchema.parse({ q: "dark" }));
    expect(result.mode).toBe("recent");
    expect(result.total).toBe(1);
    expect(mockConnection.query.mock.calls[0][0]).toContain(">= 3");
    expect(mockConnection.query.mock.calls[1][0]).not.toContain(">= 3");
    expect(mockConnection.query.mock.calls[2][0]).toContain("ORDER BY l.created_at DESC, l.id DESC");
});

it("does not turn a past-the-end popular page into unrelated recent results", async () => {
    mockConnection.query.mockResolvedValueOnce([[{ total: 20 }], []]).mockResolvedValueOnce([[], []]);
    expect(await exploreLists(7, listDiscoverySchema.parse({ page: 2 }))).toMatchObject({ items: [], total: 20, mode: "popular", page: 2 });
    expect(mockConnection.query).toHaveBeenCalledTimes(2);
    expect(mockConnection.query.mock.calls[1][1]).toEqual([7, 20, 20]);
});

it.each(["following", "friends", "mine", "saved"])("keeps the %s scope in SQL rather than filtering a public page in memory", async (scope) => {
    mockConnection.query.mockResolvedValueOnce([[{ total: 0 }], []]);
    await exploreLists(7, listDiscoverySchema.parse({ scope, sort: "recent" }));
    const [sql, params] = mockConnection.query.mock.calls[0];
    expect(params).toContain(7);
    if (scope === "mine") {
        expect(sql).toContain("WHERE l.user_id = ?");
    } else {
        expect(sql).toContain("WHERE l.is_public = TRUE");
        if (scope === "friends") expect(sql).toContain("f.follower_id = l.user_id AND f.following_id = ?");
        if (scope === "following") expect(sql).toContain("f.follower_id = ? AND f.following_id = l.user_id");
        if (scope === "saved") expect(sql).toContain("mine.list_id = l.id AND mine.user_id = ?");
    }
});

it("creates only an additive saved table with uniqueness and cascading privacy cleanup", async () => {
    const database = await initDatabase();
    await migrateListSaves(database);
    const sql = mockConnection.query.mock.calls[0][0];
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS");
    expect(sql).toContain("PRIMARY KEY (user_id, list_id)");
    expect(sql).toContain("REFERENCES lists(id) ON DELETE CASCADE");
});
