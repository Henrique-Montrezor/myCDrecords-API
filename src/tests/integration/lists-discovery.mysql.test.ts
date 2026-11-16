import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket } from "mysql2";

jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn(async () => mockConnection),
    getPool: jest.fn(() => ({ getConnection: async () => mockConnection })),
}));

import { exploreLists, setListSaved } from "../../modules/lists/lists.discovery.repository";
import { getListItems, getListById, updateList } from "../../modules/lists/lists.repository";
import { listDiscoverySchema } from "../../modules/lists/lists.schema";
import { migrateListIdentity } from "../../mysql2/migrations/003-list-identity";

let mockConnection: PoolConnection;
let pool: Pool;
const mysqlSuite = process.env.LIST_DISCOVERY_MYSQL_TESTS === "true" ? describe : describe.skip;

mysqlSuite("list discovery against an explicitly provisioned test database", () => {
    beforeAll(async () => {
        jest.unmock("dotenv");
        jest.requireActual<typeof import("dotenv")>("dotenv").config();
        const databaseName = process.env.LIST_DISCOVERY_MYSQL_DATABASE;
        if (!databaseName || !/^mycdrecords_list_tests_[a-z0-9_]+$/.test(databaseName) || databaseName.toLowerCase() === process.env.MYSQL_DATABASE?.toLowerCase()) {
            throw new Error("Provide an isolated, pre-created LIST_DISCOVERY_MYSQL_DATABASE named mycdrecords_list_tests_<suffix>; never use the application database.");
        }
        const database = jest.requireActual<typeof import("../../mysql2/init.database")>("../../mysql2/init.database");
        pool = database.getPool();
        mockConnection = await pool.getConnection();
        jest.spyOn(mockConnection, "release").mockImplementation(() => undefined);
        await mockConnection.query("USE ??", [databaseName]);
        await mockConnection.query("CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY, username VARCHAR(255))");
        await mockConnection.query(`CREATE TABLE IF NOT EXISTS lists (
            id INT PRIMARY KEY, user_id INT, title VARCHAR(255), description TEXT, is_public BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await mockConnection.query(`CREATE TABLE IF NOT EXISTS list_items (
            id INT PRIMARY KEY, list_id INT, album_id VARCHAR(255), album_title VARCHAR(500), album_image VARCHAR(500), album_artist VARCHAR(500),
            position INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await mockConnection.query("CREATE TABLE IF NOT EXISTS follows (follower_id INT, following_id INT)");
        await mockConnection.query(`CREATE TABLE IF NOT EXISTS list_saves (
            user_id INT, list_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, list_id)
        )`);
        await migrateListIdentity(mockConnection);
    }, 30000);
    afterAll(async () => {
        mockConnection?.destroy();
        await pool?.end();
    });
    beforeEach(async () => {
        for (const table of ["list_images", "list_saves", "list_items", "follows", "lists", "users"]) {
            await mockConnection.query(`DELETE FROM ${table}`);
        }
        await mockConnection.query("INSERT INTO users VALUES (1, 'reader'), (2, 'following'), (3, 'friend'), (4, 'stranger')");
        await mockConnection.query(`INSERT INTO lists (id, user_id, title, is_public) VALUES
            (1, 1, 'Mine private', FALSE), (2, 2, 'Followed public', TRUE), (3, 3, 'Mutual public', TRUE),
            (4, 4, 'Other public', TRUE), (5, 3, 'Friend private', FALSE)`);
        await mockConnection.query("INSERT INTO follows VALUES (1, 2), (1, 3), (3, 1)");
    });
    const explore = (query: object) => exploreLists(1, listDiscoverySchema.parse(query));

    it("separates outgoing, mutual, mine and saved scopes without private leakage", async () => {
        expect((await explore({ scope: "following", sort: "recent" })).items.map((item) => item.id)).toEqual([3, 2]);
        expect((await explore({ scope: "friends", sort: "recent" })).items.map((item) => item.id)).toEqual([3]);
        expect((await explore({ scope: "mine" })).items.map((item) => item.id)).toEqual([1]);
        await setListSaved(2, 1, true);
        expect((await explore({ scope: "saved" })).items.map((item) => item.id)).toEqual([2]);
        await expect(setListSaved(5, 1, true)).rejects.toMatchObject({ status: 403 });
        await expect(setListSaved(1, 1, true)).rejects.toMatchObject({ status: 403 });
        await expect(setListSaved(99, 1, true)).rejects.toMatchObject({ status: 404 });
    });

    it("counts distinct third parties in 30 days, enforces three, and preserves timestamp on repeated saves", async () => {
        await mockConnection.query(`INSERT INTO list_saves (list_id, user_id, created_at) VALUES
            (2, 1, DATE_SUB(NOW(), INTERVAL 31 DAY)), (2, 2, NOW()), (2, 3, NOW()), (2, 4, NOW()),
            (3, 1, NOW()), (3, 2, NOW()), (3, 4, NOW())`);
        const before = await explore({});
        expect(before.mode).toBe("popular");
        expect(before.items.map((item) => [item.id, item.save_count])).toEqual([[3, 3]]);
        await setListSaved(2, 1, true);
        expect((await explore({})).items.map((item) => item.id)).toEqual([3]);
        await setListSaved(2, 1, false);
        await setListSaved(2, 1, false);
        await setListSaved(2, 1, true);
        expect((await explore({})).items.map((item) => [item.id, item.save_count])).toEqual([[3, 3], [2, 3]]);
        const search = await explore({ q: "Followed" });
        expect(search.items.map((item) => item.id)).toEqual([2]);
        expect(search.mode).toBe("popular");
        expect((await explore({ page: 2 })).mode).toBe("popular");
        expect((await explore({ page: 2 })).items).toEqual([]);
    });

    it("uses explicit recent fallback, treats SQL wildcard input literally, and cleans saves on private transition", async () => {
        expect((await explore({})).mode).toBe("recent");
        expect((await explore({ q: "%" })).items).toEqual([]);
        await setListSaved(2, 1, true);
        await updateList(2, 2, { isPublic: false });
        expect((await explore({ scope: "saved" })).items).toEqual([]);
        const [rows] = await mockConnection.query<RowDataPacket[]>("SELECT * FROM list_saves WHERE list_id = 2");
        expect(rows).toEqual([]);
        await updateList(2, 2, { isPublic: true });
        expect((await explore({ scope: "saved" })).items).toEqual([]);
        await expect(setListSaved(2, 2, true)).rejects.toMatchObject({ status: 400 });
    });

    it("bounds previews at four and reads a thousand album list in stable pages of 24", async () => {
        const values = Array.from({ length: 1000 }, (_, index) => [index + 1, 2, `album-${index + 1}`, `Album ${index + 1}`]);
        await mockConnection.query("INSERT INTO list_items (id, list_id, album_id, album_title) VALUES ?", [values]);
        const result = await explore({ sort: "recent" });
        const list = result.items.find((item) => item.id === 2);
        expect(list?.item_count).toBe(1000);
        expect(list?.previews.map((item) => item.album_id)).toEqual(["album-1", "album-2", "album-3", "album-4"]);
        expect((await getListItems(2, 1)).map((item) => item.id)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1));
        expect((await getListItems(2, 42)).map((item) => item.id)).toEqual(Array.from({ length: 16 }, (_, index) => index + 985));
        expect((await getListById(2, 1))?.item_count).toBe(1000);
        await updateList(2, 2, { isPublic: false });
        expect(await getListItems(2, 1, 1)).toEqual([]);
        expect(await getListItems(2, 1, 2)).toHaveLength(24);
    });
});
