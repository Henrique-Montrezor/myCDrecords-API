import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Zod validation errors -> 400 with the list of issues
  if (err instanceof ZodError) {
    logger.warn("Validation failure", {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      issues: err.issues,
    });
    return res.status(400).json({
      error: "Validation failed",
      requestId: req.requestId,
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const status = err.status || 500;

  logger.error(err.message || "Internal server error", {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    status,
    stack: err.stack,
  });

  res.status(status).json({
    error: err.message || "Internal server error",
    requestId: req.requestId,
  });
}