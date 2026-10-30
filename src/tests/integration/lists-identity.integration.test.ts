jest.mock("../../modules/lists/lists.identity.repository");
jest.mock("../../modules/lists/lists.images");

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import routes from "../../modules/lists/lists.routes";
import { errorHandler } from "../../middlewares/error.middleware";
import * as identity from "../../modules/lists/lists.identity.repository";
import { prepareListImage } from "../../modules/lists/lists.images";

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/lists", routes);
app.use(errorHandler);
const auth = { Authorization: `Bearer ${jwt.sign({ user_id: 7 }, process.env.JWT_SECRET as string)}` };
beforeEach(() => jest.resetAllMocks());

it("requires authentication for image mutations and order changes", async () => {
    expect((await request(app).put("/api/lists/4/images/thumbnail").set("Content-Type", "image/jpeg").send(Buffer.from("image"))).status).toBe(401);
    expect((await request(app).delete("/api/lists/4/images/banner")).status).toBe(401);
    expect((await request(app).put("/api/lists/4/order").send({ revision: 0, itemId: 5, toPosition: 25 })).status).toBe(401);
    expect(identity.saveListImage).not.toHaveBeenCalled();
});

it("uploads only validated binary images and delegates owner enforcement to the locked write", async () => {
    jest.mocked(prepareListImage).mockResolvedValue(Buffer.from("sanitized"));
    jest.mocked(identity.saveListImage).mockResolvedValue(undefined);
    const res = await request(app).put("/api/lists/4/images/thumbnail").set(auth).set("Content-Type", "image/jpeg").send(Buffer.from("raw"));
    expect(res.status).toBe(204);
    expect(prepareListImage).toHaveBeenCalledWith(Buffer.from("raw"), "thumbnail");
    expect(identity.saveListImage).toHaveBeenCalledWith(4, 7, "thumbnail", Buffer.from("sanitized"));
    expect((await request(app).put("/api/lists/4/images/thumbnail").set(auth).send({ url: "https://example.com/image.jpg" })).status).toBe(415);
    expect((await request(app).put("/api/lists/4/images/unknown").set(auth).send(Buffer.from("raw"))).status).toBe(400);
});

it("rejects oversized raw uploads before decoding or saving", async () => {
    const res = await request(app).put("/api/lists/4/images/banner").set(auth).set("Content-Type", "image/png").send(Buffer.alloc(2 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(prepareListImage).not.toHaveBeenCalled();
});

it("returns public images with no-store and serves no bytes after private denial", async () => {
    jest.mocked(identity.readListImage).mockResolvedValue(Buffer.from("jpeg"));
    const publicImage = await request(app).get("/api/lists/4/images/banner");
    expect(publicImage.status).toBe(200);
    expect(publicImage.headers["content-type"]).toContain("image/jpeg");
    expect(publicImage.headers["cache-control"]).toContain("no-store");
    expect(publicImage.headers["x-content-type-options"]).toBe("nosniff");
    expect(identity.readListImage).toHaveBeenCalledWith(4, "banner", undefined);
    jest.mocked(identity.readListImage).mockRejectedValue(Object.assign(new Error("Lista privada."), { status: 403 }));
    expect((await request(app).get("/api/lists/4/images/banner")).status).toBe(403);
    expect((await request(app).get("/api/lists/4/images/banner").set(auth)).status).toBe(403);
});

it("removes images idempotently and returns explicit order conflicts", async () => {
    jest.mocked(identity.saveListImage).mockResolvedValue(undefined);
    expect((await request(app).delete("/api/lists/4/images/banner").set(auth)).status).toBe(204);
    expect(identity.saveListImage).toHaveBeenCalledWith(4, 7, "banner", null);
    jest.mocked(identity.moveListItem).mockResolvedValue({ revision: 4, page: 2 });
    const res = await request(app).put("/api/lists/4/order").set(auth).send({ revision: 3, itemId: 5, toPosition: 25 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revision: 4, page: 2 });
    expect(identity.moveListItem).toHaveBeenCalledWith(4, 7, { revision: 3, itemId: 5, toPosition: 25 });
    jest.mocked(identity.moveListItem).mockRejectedValue(Object.assign(new Error("A ordem mudou."), { status: 409 }));
    expect((await request(app).put("/api/lists/4/order").set(auth).send({ revision: 3, itemId: 5, toPosition: 25 })).status).toBe(409);
});

it.each([
    { revision: -1, itemId: 1, toPosition: 1 }, { revision: 0, itemId: 0, toPosition: 1 },
    { revision: 0, itemId: 1, toPosition: 0 }, { revision: 0, itemId: 1, toPosition: 1.5 },
    { revision: 0, itemId: 1, toPosition: 1, extra: true },
])("rejects invalid reorder input", async (body) => {
    expect((await request(app).put("/api/lists/4/order").set(auth).send(body)).status).toBe(400);
    expect(identity.moveListItem).not.toHaveBeenCalled();
});
