import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string };
    }
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const headerToken = req.headers.authorization?.split(" ")[1];
  const cookieToken = req.cookies?.token;

  // 1) Try the Access Token from the header (short-lived: 15m).
  if (headerToken) {
    try {
      const decoded: any = jwt.verify(
        headerToken,
        process.env.JWT_SECRET || "your-secret-key"
      );
      req.user = { id: decoded.user_id, email: decoded.email };
      return next();
    } catch {
      // Access token missing/expired/invalid — falls back to the refresh cookie below.
    }
  }

  // 2) Fallback: Refresh Token from the httpOnly cookie (long-lived: 7d).
  // Keeps the user authenticated even after the access token expires, preventing
  // actions like "Connect Spotify" from silently failing with 401.
  if (cookieToken) {
    try {
      const decoded: any = jwt.verify(
        cookieToken,
        process.env.JWT_REFRESH_SECRET || "your-refresh-secret"
      );
      req.user = { id: decoded.user_id, email: decoded.email };
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  }

  return res.status(401).json({ message: "Token not provided" });
};

export default authMiddleware;