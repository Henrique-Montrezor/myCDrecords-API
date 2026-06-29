/**
 * Testes de integração para uma rota protegida por JWT:
 * POST /api/profile/create-or-update-profile.
 *
 * Verifica que o auth.middleware bloqueia requisições sem token (401) e
 * permite o acesso quando um access token válido é enviado no header.
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

// Repositório de perfil mockado para isolar a rota da camada de dados.
jest.mock("../../modules/profile/profile.repository", () => ({
  createOrUpdateProfile: jest.fn().mockResolvedValue(undefined),
  getProfileByUsername: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { createOrUpdateProfile } from "../../modules/profile/profile.repository";

const mockedCreateOrUpdateProfile = createOrUpdateProfile as jest.Mock;

function validAccessToken(userId = 99, email = "profile@example.com") {
  return jwt.sign(
    { user_id: userId, email },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" }
  );
}

const validProfile = {
  bio: "Colecionador de CDs raros",
  avatar_url: "https://example.com/avatar.jpg",
};

describe("POST /api/profile/create-or-update-profile (rota protegida)", () => {
  it("retorna 401 quando nenhum token é fornecido", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .send(validProfile);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Token não fornecido" });
    expect(mockedCreateOrUpdateProfile).not.toHaveBeenCalled();
  });

  it("retorna 401 quando o token do header é inválido", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .set("Authorization", "Bearer token.invalido.aqui")
      .send(validProfile);

    expect(res.status).toBe(401);
    expect(mockedCreateOrUpdateProfile).not.toHaveBeenCalled();
  });

  it("permite o acesso e retorna 200 com um access token válido", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .set("Authorization", `Bearer ${validAccessToken()}`)
      .send(validProfile);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Perfil criado ou atualizado com sucesso");
    expect(res.body.user_id).toBe(99);
    expect(mockedCreateOrUpdateProfile).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 quando o corpo é inválido mesmo autenticado", async () => {
    const res = await request(app)
      .post("/api/profile/create-or-update-profile")
      .set("Authorization", `Bearer ${validAccessToken()}`)
      .send({ bio: "", avatar_url: "não-é-url" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validação falhou");
    expect(mockedCreateOrUpdateProfile).not.toHaveBeenCalled();
  });
});
