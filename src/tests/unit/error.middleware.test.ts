import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { errorHandler } from "../../middlewares/error.middleware";

function buildRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as any;
  res.json = jest.fn().mockReturnValue(res) as any;
  return res as Response;
}

describe("error.middleware - errorHandler", () => {
  const req = {} as Request;
  const next = jest.fn() as NextFunction;

  it("turns ZodError into 400 with the list of issues", () => {
    const schema = z.object({ email: z.string().email("Invalid email") });
    let zodError: ZodError;
    try {
      schema.parse({ email: "invalid" });
      throw new Error("schema should have thrown");
    } catch (err) {
      zodError = err as ZodError;
    }

    const res = buildRes();
    errorHandler(zodError!, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: "email",
            message: "Invalid email",
          }),
        ]),
      })
    );
  });

  it("respects the custom status and message of the error", () => {
    const customError: any = new Error("Resource not found");
    customError.status = 404;

    const res = buildRes();
    errorHandler(customError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Resource not found",
    });
  });

  it("uses 500 and default message when the error has no status or message", () => {
    const res = buildRes();
    errorHandler({}, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });
});
