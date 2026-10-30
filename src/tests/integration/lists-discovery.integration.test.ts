jest.mock("../../modules/lists/lists.discovery.repository");
jest.mock("../../modules/lists/lists.repository");

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import routes from "../../modules/lists/lists.routes";
import { errorHandler } from "../../middlewares/error.middleware";
import * as discovery from "../../modules/lists/lists.discovery.repository";
import * as lists from "../../modules/lists/lists.repository";

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/lists", routes);
app.use(errorHandler);
const auth = { Authorization: `Bearer ${jwt.sign({ user_id: 7 }, process.env.JWT_SECRET as string)}` };

beforeEach(() => jest.clearAllMocks());

it("requires a session to explore personalized list scopes or save", async () => {
    expect((await request(app).get("/api/lists/explore")).status).toBe(401);
    expect((await request(app).put("/api/lists/4/saved")).status).toBe(401);
    expect(discovery.exploreLists).not.toHaveBeenCalled();
});

it("passes validated discovery filters and the authenticated user to the repository", async () => {
    jest.mocked(discovery.exploreLists).mockResolvedValue({
        items: [], total: 0, page: 2, pageSize: 20, totalPages: 0, mode: "recent",
    });
    const res = await request(app).get("/api/lists/explore?scope=friends&q=dark&sort=recent&page=2").set(auth);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(discovery.exploreLists).toHaveBeenCalledWith(7, { scope: "friends", q: "dark", sort: "recent", page: 2 });
    expect(res.body.mode).toBe("recent");
});

it.each(["page=0", "page=abc", "scope=private", "sort=random", "page=1&page=2", `q=${"a".repeat(101)}`])("rejects invalid discovery query %s", async (query) => {
    expect((await request(app).get(`/api/lists/explore?${query}`).set(auth)).status).toBe(400);
    expect(discovery.exploreLists).not.toHaveBeenCalled();
});

it("saves and unsaves idempotently and delegates ownership and visibility enforcement", async () => {
    jest.mocked(discovery.setListSaved).mockResolvedValue(undefined);
    expect((await request(app).put("/api/lists/4/saved").set(auth)).status).toBe(204);
    expect((await request(app).put("/api/lists/4/saved").set(auth)).status).toBe(204);
    expect(discovery.setListSaved).toHaveBeenLastCalledWith(4, 7, true);
    expect((await request(app).delete("/api/lists/4/saved").set(auth)).status).toBe(204);
    expect(discovery.setListSaved).toHaveBeenLastCalledWith(4, 7, false);
    jest.mocked(discovery.setListSaved).mockRejectedValue(Object.assign(new Error("Lista privada."), { status: 403 }));
    expect((await request(app).put("/api/lists/4/saved").set(auth)).status).toBe(403);
});

it("paginates public details for anonymous visitors and counts globally", async () => {
    jest.mocked(lists.getListById).mockResolvedValue({ id: 4, user_id: 8, is_public: 1, item_count: 1000, constructor: { name: "RowDataPacket" } });
    jest.mocked(lists.getListItems).mockResolvedValue([{ album_id: "mbid", constructor: { name: "RowDataPacket" } }]);
    const res = await request(app).get("/api/lists/4?page=42");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ item_count: 1000, page: 42, pageSize: 24, totalPages: 42 });
    expect(lists.getListItems).toHaveBeenCalledWith(4, 42, undefined);
});

it("never loads private items for a non-owner and rejects bad detail pages", async () => {
    jest.mocked(lists.getListById).mockResolvedValue({ id: 4, user_id: 8, is_public: 0, constructor: { name: "RowDataPacket" } });
    expect((await request(app).get("/api/lists/4").set(auth)).status).toBe(403);
    expect(lists.getListItems).not.toHaveBeenCalled();
    expect((await request(app).get("/api/lists/4?page=-1")).status).toBe(400);
});
