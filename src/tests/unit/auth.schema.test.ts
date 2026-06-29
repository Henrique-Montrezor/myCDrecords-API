import {
  registerSchema,
  loginSchema,
} from "../../modules/auth/auth.schema";

describe("auth.schema - registerSchema", () => {
  const validInput = {
    username: "johndoe",
    email: "john@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("aceita dados válidos", () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("faz trim do username e do email", () => {
    const parsed = registerSchema.parse({
      ...validInput,
      username: "  johndoe  ",
      email: "  john@example.com  ",
    });
    expect(parsed.username).toBe("johndoe");
    expect(parsed.email).toBe("john@example.com");
  });

  it("rejeita username com menos de 3 caracteres", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("username");
    }
  });

  it("rejeita email inválido", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("rejeita senha com menos de 8 caracteres", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      password: "123",
      confirmPassword: "123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("password");
    }
  });

  it("rejeita quando password e confirmPassword não correspondem", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
      expect(result.error.issues[0].message).toBe("Senhas não correspondem");
    }
  });

  it("rejeita quando campos obrigatórios estão ausentes", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("auth.schema - loginSchema", () => {
  it("aceita credenciais válidas", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = loginSchema.safeParse({
      email: "invalid",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
