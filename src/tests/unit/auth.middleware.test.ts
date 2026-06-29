import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import authMiddleware from "../../middlewares/auth.middleware";

function buildRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as any;
  res.json = jest.fn().mockReturnValue(res) as any;
  return res as Response;
}

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  } as Request;
}

describe("auth.middleware", () => {
  const userId = 7;
  const email = "auth@example.com";

  it("retorna 401 quando nenhum token é fornecido", () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token não fornecido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("autentica com um access token válido no header Authorization", () => {
    const token = jwt.sign(
      { user_id: userId, email },
      process.env.JWT_SECRET as string
    );
    const req = buildReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: userId, email });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("faz fallback para o refresh token no cookie quando o header é inválido", () => {
    const cookieToken = jwt.sign(
      { user_id: userId, email },
      process.env.JWT_REFRESH_SECRET as string
    );
    const req = buildReq({
      headers: { authorization: "Bearer invalid.token.value" },
      cookies: { token: cookieToken },
    });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: userId, email });
  });

  it("retorna 401 quando o cookie token é inválido e não há header", () => {
    const req = buildReq({
      cookies: { token: "invalid.cookie.token" },
    });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Token inválido ou expirado",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 quando o access token está expirado e não há cookie", () => {
    const expired = jwt.sign(
      { user_id: userId, email },
      process.env.JWT_SECRET as string,
      { expiresIn: -10 }
    );
    const req = buildReq({
      headers: { authorization: `Bearer ${expired}` },
    });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
