import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../../modules/auth/auth.service";

describe("auth.service - geração e verificação de tokens", () => {
  const userId = 42;
  const email = "user@example.com";

  it("generateAccessToken cria um JWT verificável com o payload correto", () => {
    const token = generateAccessToken(userId, email);
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    expect(decoded.user_id).toBe(userId);
    expect(decoded.email).toBe(email);
    expect(decoded.exp).toBeDefined();
  });

  it("generateRefreshToken cria um JWT assinado com o refresh secret", () => {
    const token = generateRefreshToken(userId);
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET as string
    );

    expect(decoded.user_id).toBe(userId);
  });

  it("refresh token não é válido sob o access secret", () => {
    const token = generateRefreshToken(userId);
    expect(() =>
      jwt.verify(token, process.env.JWT_SECRET as string)
    ).toThrow();
  });

  it("verifyToken decodifica um access token válido", () => {
    const token = generateAccessToken(userId, email);
    const decoded = verifyToken(token);

    expect(decoded.user_id).toBe(userId);
    expect(decoded.email).toBe(email);
  });

  it("verifyToken lança erro para um token adulterado", () => {
    const token = generateAccessToken(userId, email);
    const tampered = token.slice(0, -2) + "xx";

    expect(() => verifyToken(tampered)).toThrow();
  });
});
