import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Erros de validação do Zod -> 400 com a lista de problemas
  if (err instanceof ZodError) {
    logger.warn("Falha de validação", {
      method: req.method,
      url: req.originalUrl,
      issues: err.issues,
    });
    return res.status(400).json({
      error: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const status = err.status || 500;

  logger.error(err.message || "Erro interno do servidor", {
    method: req.method,
    url: req.originalUrl,
    status,
    stack: err.stack,
  });

  res.status(status).json({
    error: err.message || "Internal server error"
  });
}