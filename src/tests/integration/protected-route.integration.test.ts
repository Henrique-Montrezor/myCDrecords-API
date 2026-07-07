/**
 * integration test for protected route: /api/profile/create-or-update-profile
 * POST /api/profile/create-or-update-profile.
 *
 * Verifies that the auth.middleware blocks requests without a token (401) and
 * allows access when a valid access token is sent in the header.
 */

// Avoids real MySQL connection when importing the app.
jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

// All table creation functions become resolved no-ops.
jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy(
    {},
    {
      get: () => noop,
    }
  );
});

// Mocked profile repository to isolate the route from the data layer.
jest.mock("../../modules/profile/profile.repository", () => ({
  createOrUpdateProfile: jest.fn().mockResolvedValue(undefined),
  getProfileByUsername: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { createOrUpdateProfile } from "../../modules/profile/profile.repository";

const mockedCreateOrUpdateProfile = createOrUpdateProfile as jest.Mock;

function validAccessToken(userId = 99, email = "profile@example.com") {
  return jwt.sign(
    { user_id: userId, email },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" }
  );
}

const validProfile = {
  bio: "Collector of rare CDs",
  avatar_url: "https://example.com/avatar.jpg",
};

describe("POST /api/profile/create-or-update-profile (protected route)", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .send(validProfile);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Token not provided" });
    expect(mockedCreateOrUpdateProfile).not.toHaveBeenCalled();
  });

  it("returns 401 when the token in the header is invalid", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .set("Authorization", "Bearer invalid.token.here")
      .send(validProfile);

    expect(res.status).toBe(401);
    expect(mockedCreateOrUpdateProfile).not.toHaveBeenCalled();
  });

  it("allows access and returns 200 with a valid access token", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .set("Authorization", `Bearer ${validAccessToken()}`)
      .send(validProfile);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Profile created or updated successfully");
    expect(res.body.user_id).toBe(99);
    expect(mockedCreateOrUpdateProfile).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when the body is invalid even if authenticated", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .set("Authorization", `Bearer ${validAccessToken()}`)
      .send({ bio: "", avatar_url: "not-a-url" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(mockedCreateOrUpdateProfile).not.toHaveBeenCalled();
  });
});
