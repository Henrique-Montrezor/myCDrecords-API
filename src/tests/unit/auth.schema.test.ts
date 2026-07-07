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

  it("accepts valid data", () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("trims the username and email", () => {
    const parsed = registerSchema.parse({
      ...validInput,
      username: "  johndoe  ",
      email: "  john@example.com  ",
    });
    expect(parsed.username).toBe("johndoe");
    expect(parsed.email).toBe("john@example.com");
  });

  it("rejects username with less than 3 characters", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("username");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("rejects password with less than 8 characters", () => {
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

  it("rejects when password and confirmPassword do not match", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
      expect(result.error.issues[0].message).toBe("Passwords do not match");
    }
  });

  it("rejects when required fields are missing", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("auth.schema - loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
