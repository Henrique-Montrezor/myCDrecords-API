import { Request, Response, NextFunction } from "express";
import { initDatabase } from "../../mysql2/init.database";
import { logger } from "../../utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string };
    }
  }
}

// Admin middleware - checks if user is authenticated and has admin role
export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];   
    
    if (!token) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    // Conectando e executando a query (assumindo uma biblioteca como mysql2 ou similar)
    const connection = await initDatabase();
    const query = `SELECT user_id FROM admins WHERE user_id = ?`;
    
    const [rows]: any = await connection.execute(query, [req.user.id]);

    // Se o array de resultados for vazio, o usuário não está na tabela admin
    if (rows.length === 0) {
      return res.status(403).json({ message: "Acesso negado - privilégios de admin necessários" });
    }

    next();
  } catch (error) {
    logger.error("Erro no middleware de admin", { error });
    return res.status(500).json({ message: "Erro ao verificar permissões de admin" });
  }
}

export default adminMiddleware;
