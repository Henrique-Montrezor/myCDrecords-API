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
      return res.status(401).json({ message: "Token not provided" });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Connecting and running the query (assuming a library like mysql2 or similar)
    const connection = await initDatabase();
    const query = `SELECT user_id FROM admins WHERE user_id = ?`;
    
    const [rows]: any = await connection.execute(query, [req.user.id]);

    // If the results array is empty, the user is not in the admin table
    if (rows.length === 0) {
      return res.status(403).json({ message: "Access denied - admin privileges required" });
    }

    next();
  } catch (error) {
    logger.error("Error in admin middleware", { error });
    return res.status(500).json({ message: "Error verifying admin permissions" });
  }
}

export default adminMiddleware;
