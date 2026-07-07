/**
 * Integration tests for the user module route (/api/user).
 *
 * Currently, the module only exposes user search by username. The registration/login flow
 * has been consolidated in the authentication module (/api/auth),
 * covered in register.integration.test.ts.
 *
 * The data layer (user.repository) is mocked and the database/tables initialization
 * is neutralized so that importing the app does not connect to MySQL.
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

// Mocked user repository to isolate the route from the data layer.
jest.mock("../../modules/users/user.repository", () => ({
  createUser: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findById: jest.fn(),
  findByIdForResponse: jest.fn(),
}));

import request from "supertest";
import app from "../../app";
import { findByUsername } from "../../modules/users/user.repository";

const mockedFindByUsername = findByUsername as jest.Mock;

describe("GET /api/user/search-users", () => {
  it("returns 404 when the user is not found", async () => {
    mockedFindByUsername.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/user/search-users")
      .query({ username: "missing" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "User not found" });
    expect(mockedFindByUsername).toHaveBeenCalledWith("missing");
  });

  it("returns 200 with the found user's data", async () => {
    const found = { id: 9, username: "johndoe", email: "john@example.com" };
    mockedFindByUsername.mockResolvedValue(found);

    const res = await request(app)
      .get("/api/user/search-users")
      .query({ username: "johndoe" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(found);
  });
});
