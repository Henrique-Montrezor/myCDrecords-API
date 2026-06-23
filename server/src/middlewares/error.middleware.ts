import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Erros de validação do Zod -> 400 com a lista de problemas
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validação falhou",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  res.status(err.status || 500).json({
    error: err.message || "Erro interno do servidor"
  });
}