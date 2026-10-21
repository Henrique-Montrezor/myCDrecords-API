/**
 * Integration tests for avatar/banner uploads.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/profile/profile.repository", () => ({
  getPublicProfile: jest.fn(),
  createOrUpdateProfile: jest.fn(),
  setProfileImage: jest.fn(),
}));

jest.mock("../../modules/profile/profile.images", () => ({
  ...jest.requireActual("../../modules/profile/profile.images"),
  saveProfileImage: jest.fn(),
  removeProfileImage: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { setProfileImage } from "../../modules/profile/profile.repository";
import { detectImageType, removeProfileImage, saveProfileImage } from "../../modules/profile/profile.images";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(8)]);

beforeEach(() => {
  jest.clearAllMocks();
  (saveProfileImage as jest.Mock).mockResolvedValue("http://localhost/uploads/profile/avatar-7-aaaaaaaaaaaaaaaa.jpg");
  (setProfileImage as jest.Mock).mockResolvedValue("http://localhost/uploads/profile/avatar-7-bbbbbbbbbbbbbbbb.jpg");
});

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by signature", () => {
    expect(detectImageType(jpeg)).toBe("jpg");
    expect(detectImageType(png)).toBe("png");
    expect(detectImageType(webp)).toBe("webp");
  });

  it("rejects anything else", () => {
    expect(detectImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("POST /api/profile/:kind", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/profile/avatar").set("Content-Type", "image/jpeg").send(jpeg);
    expect(res.status).toBe(401);
  });

  it("stores the image for the authenticated user and drops the previous file", async () => {
    const res = await request(app).post("/api/profile/avatar").set(auth(7)).set("Content-Type", "image/jpeg").send(jpeg);
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/avatar-7-/);
    expect(saveProfileImage).toHaveBeenCalledWith(7, "avatar", expect.any(Buffer), "jpg", expect.any(String));
    expect(setProfileImage).toHaveBeenCalledWith(7, "avatar", res.body.url);
    expect(removeProfileImage).toHaveBeenCalledWith("http://localhost/uploads/profile/avatar-7-bbbbbbbbbbbbbbbb.jpg");
  });

  it("accepts banners", async () => {
    const res = await request(app).post("/api/profile/banner").set(auth()).set("Content-Type", "image/webp").send(webp);
    expect(res.status).toBe(200);
    expect(saveProfileImage).toHaveBeenCalledWith(7, "banner", expect.any(Buffer), "webp", expect.any(String));
  });

  it("rejects a body whose bytes are not an image even with an image content type", async () => {
    const res = await request(app).post("/api/profile/avatar").set(auth()).set("Content-Type", "image/png").send(Buffer.from("not an image"));
    expect(res.status).toBe(415);
    expect(saveProfileImage).not.toHaveBeenCalled();
  });

  it("rejects non-image content types", async () => {
    const res = await request(app).post("/api/profile/avatar").set(auth()).set("Content-Type", "text/plain").send("hello");
    expect(res.status).toBe(415);
  });

  it("rejects images larger than 2 MB", async () => {
    const res = await request(app).post("/api/profile/avatar").set(auth()).set("Content-Type", "image/jpeg").send(Buffer.concat([jpeg, Buffer.alloc(2 * 1024 * 1024)]));
    expect(res.status).toBe(413);
    expect(saveProfileImage).not.toHaveBeenCalled();
  });

  it("removes the new file when the database update fails", async () => {
    (setProfileImage as jest.Mock).mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/api/profile/avatar").set(auth()).set("Content-Type", "image/jpeg").send(jpeg);
    expect(res.status).toBe(500);
    expect(removeProfileImage).toHaveBeenCalledWith("http://localhost/uploads/profile/avatar-7-aaaaaaaaaaaaaaaa.jpg");
  });
});

describe("DELETE /api/profile/:kind", () => {
  it("clears the image and removes the stored file", async () => {
    const res = await request(app).delete("/api/profile/banner").set(auth(7));
    expect(res.status).toBe(204);
    expect(setProfileImage).toHaveBeenCalledWith(7, "banner", null);
    expect(removeProfileImage).toHaveBeenCalled();
  });
});
