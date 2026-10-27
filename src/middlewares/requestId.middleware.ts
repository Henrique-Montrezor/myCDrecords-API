import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Reuse a proxy-provided ID only when it is short and plain, so it is safe to echo into logs and headers.
const SAFE_ID = /^[\w-]{8,64}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("X-Request-Id");
  req.requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
