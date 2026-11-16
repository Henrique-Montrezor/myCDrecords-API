import { RowDataPacket } from "mysql2";
import { Pool, PoolConnection } from "mysql2/promise";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import sharp from "sharp";

jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn(async () => mockConnection),
    getPool: jest.fn(() => ({ getConnection: async () => mockConnection })),
}));
import { moveListItem, readListImage, saveListImage } from "../../modules/lists/lists.identity.repository";
import { addListItem, removeListItem } from "../../modules/lists/lists.repository";
import routes from "../../modules/lists/lists.routes";
import { errorHandler } from "../../middlewares/error.middleware";

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/lists", routes);
app.use(errorHandler);
const ownerAuth = { Authorization: `Bearer ${jwt.sign({ user_id: 7 }, process.env.JWT_SECRET as string)}` };

let mockConnection: PoolConnection;
let pool: Pool;
let temporaryTablesReady = false;
const mysqlSuite = process.env.LIST_IDENTITY_MYSQL_TESTS === "true" ? describe : describe.skip;

mysqlSuite("list identity on connection-local MySQL temporary tables only", () => {
    beforeAll(async () => {
        jest.unmock("dotenv");
        jest.requireActual<typeof import("dotenv")>("dotenv").config();
        const database = jest.requireActual<typeof import("../../mysql2/init.database")>("../../mysql2/init.database");
        pool = database.getPool();
        mockConnection = await pool.getConnection();
        jest.spyOn(mockConnection, "release").mockImplementation(() => undefined);
        await mockConnection.query(`CREATE TEMPORARY TABLE lists (
            id INT PRIMARY KEY, user_id INT, is_public BOOLEAN, order_revision INT UNSIGNED DEFAULT 0,
            image_revision INT UNSIGNED DEFAULT 0, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`);
        await mockConnection.query(`CREATE TEMPORARY TABLE list_items (
            id INT AUTO_INCREMENT PRIMARY KEY, list_id INT, album_id VARCHAR(255), album_title VARCHAR(500),
            album_image VARCHAR(500), album_artist VARCHAR(500), position INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY list_album(list_id, album_id)
        ) ENGINE=InnoDB`);
        await mockConnection.query(`CREATE TEMPORARY TABLE list_images (
            list_id INT, kind ENUM('thumbnail', 'banner'), content MEDIUMBLOB, PRIMARY KEY (list_id, kind)
        ) ENGINE=InnoDB`);
        temporaryTablesReady = true;
    }, 30000);
    afterAll(async () => { mockConnection?.destroy(); await pool?.end() });
    beforeEach(async () => {
        if (!temporaryTablesReady) throw new Error("Temporary tables were not initialized; no cleanup SQL may run.");
        await mockConnection.query("DELETE FROM list_images");
        await mockConnection.query("DELETE FROM list_items");
        await mockConnection.query("DELETE FROM lists");
        await mockConnection.query("INSERT INTO lists (id, user_id, is_public) VALUES (4, 7, FALSE)");
    });

    it("persists/replaces/removes private bytes and rechecks authorization after visibility changes", async () => {
        await saveListImage(4, 7, "thumbnail", Buffer.from("first"));
        expect(await readListImage(4, "thumbnail", 7)).toEqual(Buffer.from("first"));
        await expect(readListImage(4, "thumbnail")).rejects.toMatchObject({ status: 403 });
        await expect(readListImage(4, "thumbnail", 8)).rejects.toMatchObject({ status: 403 });
        await expect(saveListImage(4, 8, "thumbnail", Buffer.from("forbidden"))).rejects.toMatchObject({ status: 403 });
        expect(await readListImage(4, "thumbnail", 7)).toEqual(Buffer.from("first"));
        await saveListImage(4, 7, "thumbnail", Buffer.from("second"));
        expect(await readListImage(4, "thumbnail", 7)).toEqual(Buffer.from("second"));
        await mockConnection.query("UPDATE lists SET is_public = TRUE WHERE id = 4");
        expect(await readListImage(4, "thumbnail")).toEqual(Buffer.from("second"));
        await mockConnection.query("UPDATE lists SET is_public = FALSE WHERE id = 4");
        await expect(readListImage(4, "thumbnail")).rejects.toMatchObject({ status: 403 });
        await saveListImage(4, 7, "thumbnail", null);
        await saveListImage(4, 7, "thumbnail", null);
        await expect(readListImage(4, "thumbnail", 7)).rejects.toMatchObject({ status: 404 });
    });

    it("moves through 1000 items, keeps uniqueness and refuses a stale revision without changing order", async () => {
        const values = Array.from({ length: 1000 }, (_, index) => [index + 1, 4, `album-${index + 1}`]);
        await mockConnection.query("INSERT INTO list_items (id, list_id, album_id) VALUES ?", [values]);
        expect(await moveListItem(4, 7, { revision: 0, itemId: 1, toPosition: 1000 })).toEqual({ revision: 1, page: 42 });
        const order = async () => {
            const [rows] = await mockConnection.query<RowDataPacket[]>("SELECT id, position FROM list_items WHERE list_id = 4 ORDER BY position, created_at, id");
            return rows;
        };
        const moved = await order();
        expect(moved[0]).toMatchObject({ id: 2, position: 0 });
        expect(moved.at(-1)).toMatchObject({ id: 1, position: 999 });
        expect(new Set(moved.map((item) => item.id)).size).toBe(1000);
        expect(new Set(moved.map((item) => item.position)).size).toBe(1000);
        await expect(moveListItem(4, 7, { revision: 0, itemId: 1, toPosition: 1 })).rejects.toMatchObject({ status: 409 });
        expect(await order()).toEqual(moved);
        await expect(moveListItem(4, 8, { revision: 1, itemId: 1, toPosition: 1 })).rejects.toMatchObject({ status: 403 });
        expect(await moveListItem(4, 7, { revision: 1, itemId: 1, toPosition: 1 })).toEqual({ revision: 2, page: 1 });
    });

    it("appends under the revision lock and changes revision only for actual add/remove", async () => {
        expect(await addListItem(4, { albumId: "a" }, 7)).toBe(true);
        expect(await addListItem(4, { albumId: "b" }, 7)).toBe(true);
        expect(await addListItem(4, { albumId: "b" }, 7)).toBe(false);
        const [rows] = await mockConnection.query<RowDataPacket[]>("SELECT album_id, position FROM list_items ORDER BY position");
        expect(rows).toEqual([{ album_id: "a", position: 0 }, { album_id: "b", position: 1 }]);
        expect(await removeListItem(4, "a", 7)).toBe(true);
        expect(await removeListItem(4, "a", 7)).toBe(false);
        const [lists] = await mockConnection.query<RowDataPacket[]>("SELECT order_revision FROM lists WHERE id = 4");
        expect(lists[0].order_revision).toBe(3);
    });

    it("round-trips an actual upload through HTTP, decoder, MySQL and authorized binary reads", async () => {
        const source = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#123456" } }).png().toBuffer();
        expect((await request(app).put("/api/lists/4/images/thumbnail").set(ownerAuth).set("Content-Type", "image/png").send(source)).status).toBe(204);
        const loaded = await request(app).get("/api/lists/4/images/thumbnail").set(ownerAuth);
        expect(loaded.status).toBe(200);
        expect(loaded.headers["cache-control"]).toContain("no-store");
        expect(await sharp(loaded.body).metadata()).toMatchObject({ format: "jpeg", width: 512, height: 512 });
        const again = await request(app).get("/api/lists/4/images/thumbnail").set(ownerAuth);
        expect(again.body).toEqual(loaded.body);
        const anonymous = await request(app).get("/api/lists/4/images/thumbnail");
        expect(anonymous.status).toBe(403);
        expect(anonymous.headers["content-type"]).toContain("application/json");
        expect((await request(app).delete("/api/lists/4/images/thumbnail").set(ownerAuth)).status).toBe(204);
        expect((await request(app).get("/api/lists/4/images/thumbnail").set(ownerAuth)).status).toBe(404);
    });
});
