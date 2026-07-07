import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../../modules/auth/auth.service";

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
});
