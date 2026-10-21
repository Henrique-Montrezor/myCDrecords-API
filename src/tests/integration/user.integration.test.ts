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
  it("is not public: it used to return whole user rows (including the password hash)", async () => {
    const res = await request(app)
      .get("/api/user/search-users")
      .query({ username: "johndoe" });

    expect(res.status).toBe(401);
    expect(mockedFindByUsername).not.toHaveBeenCalled();
  });
});
