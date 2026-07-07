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

  it("returns 401 when no token is provided", () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token not provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("authenticates with a valid access token in the Authorization header", () => {
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

  it("falls back to the refresh token in the cookie when the header is invalid", () => {
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

  it("returns 401 when the cookie token is invalid and no header is present", () => {
    const req = buildReq({
      cookies: { token: "invalid.cookie.token" },
    });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token is expired and no cookie is present", () => {
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
