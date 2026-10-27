/**
 * Integration tests for email verification and password reset delivery.
 */

jest.mock("../../mysql2/init.database", () => ({
  initDatabase: jest.fn().mockResolvedValue({}),
  getPool: jest.fn().mockReturnValue({}),
}));

jest.mock("../../mysql2/create.tables", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy({}, { get: () => noop });
});

jest.mock("../../modules/auth/auth.repository", () => ({
  createVerificationToken: jest.fn().mockResolvedValue({}),
  findVerificationToken: jest.fn(),
  markTokenAsUsed: jest.fn(),
  markEmailAsVerified: jest.fn(),
  updateUserEmail: jest.fn(),
  storeRefreshToken: jest.fn(),
  findRefreshToken: jest.fn(),
  invalidateRefreshToken: jest.fn(),
}));

jest.mock("../../modules/users/user.repository", () => ({
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findByIdForResponse: jest.fn(),
  createUser: jest.fn(),
  searchUsersByUsername: jest.fn(),
}));

jest.mock("../../utils/mailer", () => ({
  ...jest.requireActual("../../utils/mailer"),
  sendMailInBackground: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { createVerificationToken, findVerificationToken, markEmailAsVerified, markTokenAsUsed } from "../../modules/auth/auth.repository";
import { findByEmail, findByIdForResponse } from "../../modules/users/user.repository";
import { sendMail, sendMailInBackground } from "../../utils/mailer";
import { generateEmailVerificationToken } from "../../modules/auth/auth.service";

const auth = (userId = 7) => ({
  Authorization: `Bearer ${jwt.sign({ user_id: userId, email: "me@example.com" }, process.env.JWT_SECRET as string, { expiresIn: "15m" })}`,
});

beforeEach(() => jest.clearAllMocks());

describe("POST /api/auth/email/resend-verification", () => {
  it("requires authentication", async () => {
    expect((await request(app).post("/api/auth/email/resend-verification")).status).toBe(401);
  });

  it("returns 409 when the email is already verified", async () => {
    (findByIdForResponse as jest.Mock).mockResolvedValue({ id: 7, email: "me@example.com", email_verified: 1 });
    const res = await request(app).post("/api/auth/email/resend-verification").set(auth());
    expect(res.status).toBe(409);
    expect(createVerificationToken).not.toHaveBeenCalled();
  });

  it("stores a new token and emails the verification link", async () => {
    (findByIdForResponse as jest.Mock).mockResolvedValue({ id: 7, email: "me@example.com", email_verified: 0 });
    const res = await request(app).post("/api/auth/email/resend-verification").set(auth());
    expect(res.status).toBe(200);
    expect(createVerificationToken).toHaveBeenCalledWith(7, expect.any(String), "email_verify", expect.any(Date));
    const mail = (sendMailInBackground as jest.Mock).mock.calls[0][0];
    expect(mail.to).toBe("me@example.com");
    expect(mail.text).toContain("/auth/verify-email?token=");
  });
});

describe("POST /api/auth/email/verify", () => {
  it("marks the email as verified with a stored token", async () => {
    const token = generateEmailVerificationToken(7);
    (findVerificationToken as jest.Mock).mockResolvedValue({ id: 3 });
    const res = await request(app).post("/api/auth/email/verify").send({ token });
    expect(res.status).toBe(200);
    expect(markEmailAsVerified).toHaveBeenCalledWith(7);
    expect(markTokenAsUsed).toHaveBeenCalledWith(3);
  });

  it("rejects used or unknown tokens", async () => {
    (findVerificationToken as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post("/api/auth/email/verify").send({ token: generateEmailVerificationToken(7) });
    expect(res.status).toBe(400);
    expect(markEmailAsVerified).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/password/request-reset", () => {
  it("emails the reset link to existing users only", async () => {
    (findByEmail as jest.Mock).mockResolvedValueOnce({ id: 7, email: "me@example.com" });
    expect((await request(app).post("/api/auth/password/request-reset").send({ email: "me@example.com" })).status).toBe(200);
    expect((sendMailInBackground as jest.Mock).mock.calls[0][0].text).toContain("/auth/reset-password?token=");

    (findByEmail as jest.Mock).mockResolvedValueOnce(null);
    expect((await request(app).post("/api/auth/password/request-reset").send({ email: "ghost@example.com" })).status).toBe(200);
    expect(sendMailInBackground).toHaveBeenCalledTimes(1);
  });
});

describe("sendMail without SMTP", () => {
  it("does not throw outside production", async () => {
    delete process.env.SMTP_HOST;
    await expect(sendMail({ to: "me@example.com", subject: "x", text: "y" })).resolves.toBeUndefined();
  });
});
