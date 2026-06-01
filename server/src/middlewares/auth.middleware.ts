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
  try {
    // Tenta pegar o Access Token do Header primeiro
    let token = req.headers.authorization?.split(" ")[1];
    let secret = process.env.JWT_SECRET || "your-secret-key";

    // Se não veio pelo Header, pega o Refresh Token do cookie e troca a chave
    if (!token) {
      token = req.cookies.token;
      secret = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
    }

    if (!token) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const decoded: any = jwt.verify(token, secret);

    req.user = { id: decoded.user_id, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
};

export default authMiddleware;