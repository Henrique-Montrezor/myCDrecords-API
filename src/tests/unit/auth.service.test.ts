import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  registerUser,
  verifyToken,
} from "../../modules/auth/auth.service";
import { findRefreshToken } from "../../modules/auth/auth.repository";
import { createUser, findByEmail, findByUsername, findByIdForResponse } from "../../modules/users/user.repository";

jest.mock("../../modules/auth/auth.repository", () => ({
  findRefreshToken: jest.fn(),
}));
jest.mock("../../modules/users/user.repository", () => ({
  findByIdForResponse: jest.fn(),
  createUser: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
}));

describe("auth.service - token generation and verification", () => {
  const userId = 42;
  const email = "user@example.com";

  it("generateAccessToken creates a verifiable JWT with the correct payload", () => {
    const token = generateAccessToken(userId, email);
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    expect(decoded.user_id).toBe(userId);
    expect(decoded.email).toBe(email);
    expect(decoded.exp).toBeDefined();
  });

  describe("auth.service - registration acknowledgement", () => {
    it("passes the explicitly acknowledged version to account persistence without ML consent", async () => {
      jest.mocked(findByEmail).mockResolvedValue(null);
      jest.mocked(findByUsername).mockResolvedValue(null);
      jest.mocked(createUser).mockResolvedValue({ id: 8, username: "synthetic-user", email: "fixture@example.invalid", is_active: true });

      await registerUser({
        username: "synthetic-user", email: "fixture@example.invalid", password: "synthetic-password",
        publicReviewNotice: { accepted: true, version: "public-reviews-v1" },
      });

      expect(createUser).toHaveBeenCalledWith({
        username: "synthetic-user", email: "fixture@example.invalid", password: expect.not.stringContaining("synthetic-password"),
        is_active: true, publicReviewNoticeVersion: "public-reviews-v1",
      });
    });
  });

  it("generateRefreshToken creates a JWT signed with the refresh secret", () => {
    const token = generateRefreshToken(userId);
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET as string
    );

    expect(decoded.user_id).toBe(userId);
  });

  it("refresh token is not valid under the access secret", () => {
    const token = generateRefreshToken(userId);
    expect(() =>
      jwt.verify(token, process.env.JWT_SECRET as string)
    ).toThrow();
  });

  it("verifyToken decodes a valid access token", () => {
    const token = generateAccessToken(userId, email);
    const decoded = verifyToken(token);

    expect(decoded.user_id).toBe(userId);
    expect(decoded.email).toBe(email);
  });

  it("verifyToken throws an error for a tampered token", () => {
    const token = generateAccessToken(userId, email);
    const tampered = token.slice(0, -2) + "xx";

    expect(() => verifyToken(tampered)).toThrow();
  });

  describe("refreshAccessToken", () => {
    const mockedFindToken = findRefreshToken as jest.Mock;
    const mockedFindUser = findByIdForResponse as jest.Mock;

    it("signs the new access token with the real email and returns the user", async () => {
      mockedFindToken.mockResolvedValue({ id: 1 });
      mockedFindUser.mockResolvedValue({ id: userId, username: "ana", email, is_active: 1, email_verified: 0 });

      const result = await refreshAccessToken(generateRefreshToken(userId));
      const decoded: any = jwt.verify(result.accessToken, process.env.JWT_SECRET as string);

      expect(decoded.email).toBe(email);
      expect(result.user).toEqual({ id: userId, username: "ana", email, emailVerified: false });
    });

    it("rejects tokens that are not stored or belong to an inactive user", async () => {
      mockedFindToken.mockResolvedValue(null);
      await expect(refreshAccessToken(generateRefreshToken(userId))).rejects.toThrow("Invalid refresh token");

      mockedFindToken.mockResolvedValue({ id: 1 });
      mockedFindUser.mockResolvedValue({ id: userId, email, is_active: 0 });
      await expect(refreshAccessToken(generateRefreshToken(userId))).rejects.toThrow("Invalid refresh token");
    });
  });
});
