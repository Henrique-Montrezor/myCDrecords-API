/**
 * integration test for POST /api/auth/register.
 *
 * The `app` executes initDatabase() and table creation upon import,
 * so the database layer and table creation are mocked to prevent
 * connecting to a real MySQL (avoids process.exit(1)).
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

// Mocked service layer for the successful registration path.
jest.mock("../../modules/auth/auth.service", () => {
  const actual = jest.requireActual("../../modules/auth/auth.service");
  return {
    ...actual,
    registerUser: jest.fn(),
    createTokensPair: jest.fn(),
  };
});

import request from "supertest";
import app from "../../app";
import {
  registerUser,
  createTokensPair,
} from "../../modules/auth/auth.service";

const mockedRegisterUser = registerUser as jest.Mock;
const mockedCreateTokensPair = createTokensPair as jest.Mock;

describe("POST /api/auth/register", () => {
  const validBody = {
    username: "johndoe",
    email: "john@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("returns 400 and the list of issues when the email is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validBody, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "email" }),
      ])
    );
    expect(mockedRegisterUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the password is too short", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validBody, password: "123", confirmPassword: "123" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "password" }),
      ])
    );
  });

  it("returns 400 when password and confirmPassword do not match", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validBody, confirmPassword: "anotherPassword123" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "confirmPassword" }),
      ])
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/auth/register").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("creates the user and returns 201 with valid data", async () => {
    mockedRegisterUser.mockResolvedValue({
      id: 1,
      username: validBody.username,
      email: validBody.email,
    });
    mockedCreateTokensPair.mockResolvedValue({
      accessToken: "access.token.value",
      refreshToken: "refresh.token.value",
      expiresIn: 900,
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: 1,
      username: validBody.username,
      email: validBody.email,
    });
    expect(res.body.accessToken).toBe("access.token.value");
    expect(mockedRegisterUser).toHaveBeenCalledWith({
      username: validBody.username,
      email: validBody.email,
      password: validBody.password,
    });
  });
});
