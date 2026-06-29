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

  it("transforma ZodError em 400 com a lista de issues", () => {
    const schema = z.object({ email: z.string().email("Email inválido") });
    let zodError: ZodError;
    try {
      schema.parse({ email: "invalid" });
      throw new Error("schema deveria ter lançado");
    } catch (err) {
      zodError = err as ZodError;
    }

    const res = buildRes();
    errorHandler(zodError!, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validação falhou",
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: "email",
            message: "Email inválido",
          }),
        ]),
      })
    );
  });

  it("respeita o status customizado e a mensagem do erro", () => {
    const customError: any = new Error("Recurso não encontrado");
    customError.status = 404;

    const res = buildRes();
    errorHandler(customError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Recurso não encontrado",
    });
  });

  it("usa 500 e mensagem padrão quando o erro não tem status nem mensagem", () => {
    const res = buildRes();
    errorHandler({}, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro interno do servidor",
    });
  });
});
