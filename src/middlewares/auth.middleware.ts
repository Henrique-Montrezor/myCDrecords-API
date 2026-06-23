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

  // 1) Tenta o Access Token do header (curta duração: 15m).
  if (headerToken) {
    try {
      const decoded: any = jwt.verify(
        headerToken,
        process.env.JWT_SECRET || "your-secret-key"
      );
      req.user = { id: decoded.user_id, email: decoded.email };
      return next();
    } catch {
      // Access token ausente/expirado/inválido — cai para o refresh cookie abaixo.
    }
  }

  // 2) Fallback: Refresh Token do cookie httpOnly (longa duração: 7d).
  // Mantém o usuário autenticado mesmo após o access token expirar, evitando
  // que ações como "Conectar Spotify" falhem silenciosamente com 401.
  if (cookieToken) {
    try {
      const decoded: any = jwt.verify(
        cookieToken,
        process.env.JWT_REFRESH_SECRET || "your-refresh-secret"
      );
      req.user = { id: decoded.user_id, email: decoded.email };
      return next();
    } catch {
      return res.status(401).json({ message: "Token inválido ou expirado" });
    }
  }

  return res.status(401).json({ message: "Token não fornecido" });
};

export default authMiddleware;