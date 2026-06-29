/**
 * Testes de integração para a rota do módulo de usuários (/api/user).
 *
 * Atualmente o módulo expõe apenas a busca de usuários por username. O fluxo
 * de registro/login foi consolidado no módulo de autenticação (/api/auth),
 * coberto em register.integration.test.ts.
 *
 * A camada de dados (user.repository) é mockada e a inicialização do
 * banco/tabelas é neutralizada para que o import do app não conecte ao MySQL.
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

// Repositório de usuários mockado para isolar a rota da camada de dados.
jest.mock("../../modules/users/user.repository", () => ({
  createUser: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findById: jest.fn(),
  findByIdForResponse: jest.fn(),
}));

import request from "supertest";
import app from "../../app";
import { findByUsername } from "../../modules/users/user.repository";

const mockedFindByUsername = findByUsername as jest.Mock;

describe("GET /api/user/search-users", () => {
  it("retorna 404 quando o usuário não é encontrado", async () => {
    mockedFindByUsername.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/user/search-users")
      .query({ username: "missing" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "User not found" });
    expect(mockedFindByUsername).toHaveBeenCalledWith("missing");
  });

  it("retorna 200 com os dados do usuário encontrado", async () => {
    const found = { id: 9, username: "johndoe", email: "john@example.com" };
    mockedFindByUsername.mockResolvedValue(found);

    const res = await request(app)
      .get("/api/user/search-users")
      .query({ username: "johndoe" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(found);
  });
});
