/**
 * Testes de integração para POST /api/auth/register.
 *
 * O `app` executa initDatabase() e a criação de tabelas no momento do import,
 * portanto a camada de banco e a criação de tabelas são mockadas para que a
 * importação não tente conectar a um MySQL real (evita process.exit(1)).
 */

// Evita conexão real com o MySQL ao importar o app.
jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

// Todas as funções de criação de tabela viram no-ops resolvidos.
jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy(
    {},
    {
      get: () => noop,
    }
  );
});

// Camada de serviço mockada para o caminho de sucesso do registro.
jest.mock("../../modules/auth/auth.service", () => {
  const actual = jest.requireActual("../../modules/auth/auth.service");
  return {
    ...actual,
    registerUser: jest.fn(),
    createTokensPair: jest.fn(),
  };
});

import request from "supertest";
import app from "../../app";
import {
  registerUser,
  createTokensPair,
} from "../../modules/auth/auth.service";

const mockedRegisterUser = registerUser as jest.Mock;
const mockedCreateTokensPair = createTokensPair as jest.Mock;

describe("POST /api/auth/register", () => {
  const validBody = {
    username: "johndoe",
    email: "john@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("retorna 400 e a lista de issues quando o email é inválido", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validBody, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validação falhou");
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "email" }),
      ])
    );
    expect(mockedRegisterUser).not.toHaveBeenCalled();
  });

  it("retorna 400 quando a senha é muito curta", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validBody, password: "123", confirmPassword: "123" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "password" }),
      ])
    );
  });

  it("retorna 400 quando password e confirmPassword não correspondem", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validBody, confirmPassword: "outraSenha123" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "confirmPassword" }),
      ])
    );
  });

  it("retorna 400 quando campos obrigatórios estão ausentes", async () => {
    const res = await request(app).post("/api/auth/register").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validação falhou");
  });

  it("cria o usuário e retorna 201 com dados válidos", async () => {
    mockedRegisterUser.mockResolvedValue({
      id: 1,
      username: validBody.username,
      email: validBody.email,
    });
    mockedCreateTokensPair.mockResolvedValue({
      accessToken: "access.token.value",
      refreshToken: "refresh.token.value",
      expiresIn: 900,
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: 1,
      username: validBody.username,
      email: validBody.email,
    });
    expect(res.body.accessToken).toBe("access.token.value");
    expect(mockedRegisterUser).toHaveBeenCalledWith({
      username: validBody.username,
      email: validBody.email,
      password: validBody.password,
    });
  });
});
