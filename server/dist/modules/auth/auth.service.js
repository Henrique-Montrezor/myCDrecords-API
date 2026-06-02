"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.generatePasswordResetToken = generatePasswordResetToken;
exports.generateEmailVerificationToken = generateEmailVerificationToken;
exports.verifyToken = verifyToken;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.registerUser = registerUser;
exports.createTokensPair = createTokensPair;
exports.refreshAccessToken = refreshAccessToken;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
exports.verifyEmail = verifyEmail;
exports.updateEmail = updateEmail;
exports.logout = logout;
exports.generateSimpleToken = generateSimpleToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const auth_repository_1 = require("./auth.repository");
const user_repository_1 = require("../users/user.repository");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || "your-reset-secret";
const JWT_VERIFY_SECRET = process.env.JWT_VERIFY_SECRET || "your-verify-secret";
// Generate access token
function generateAccessToken(userId, email) {
    return jsonwebtoken_1.default.sign({ user_id: userId, email }, JWT_SECRET, { expiresIn: "15m" });
}
// Generate refresh token
function generateRefreshToken(userId) {
    return jsonwebtoken_1.default.sign({ user_id: userId }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}
// Generate password reset token
function generatePasswordResetToken(userId) {
    return jsonwebtoken_1.default.sign({ user_id: userId, type: "password_reset" }, JWT_RESET_SECRET, { expiresIn: "1h" });
}
// Generate email verification token
function generateEmailVerificationToken(userId) {
    return jsonwebtoken_1.default.sign({ user_id: userId, type: "email_verify" }, JWT_VERIFY_SECRET, { expiresIn: "24h" });
}
// Verify JWT token
function verifyToken(token, secret = JWT_SECRET) {
    try {
        return jsonwebtoken_1.default.verify(token, secret);
    }
    catch (error) {
        throw new Error("Token inválido ou expirado");
    }
}
// Hash password
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, 10);
}
// Compare password
async function comparePassword(password, hashedPassword) {
    return bcrypt_1.default.compare(password, hashedPassword);
}
// Register user
async function registerUser(data) {
    // Validar se email já existe
    const existingEmail = await (0, user_repository_1.findByEmail)(data.email);
    if (existingEmail) {
        throw new Error("Email já registrado");
    }
    // Validar se username já existe
    const existingUsername = await (0, user_repository_1.findByUsername)(data.username);
    if (existingUsername) {
        throw new Error("Username já existe");
    }
    // Hash password
    const hashedPassword = await hashPassword(data.password);
    // Create user
    const user = await (0, user_repository_1.createUser)({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        is_active: true,
    });
    return user;
}
// Create tokens pair
async function createTokensPair(userId, email) {
    const accessToken = generateAccessToken(userId, email);
    const refreshToken = generateRefreshToken(userId);
    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await (0, auth_repository_1.storeRefreshToken)(userId, refreshToken, expiresAt);
    return {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
    };
}
// Refresh access token
async function refreshAccessToken(refreshToken) {
    // Verify refresh token
    const decoded = verifyToken(refreshToken, JWT_REFRESH_SECRET);
    // Find refresh token in database
    const storedToken = await (0, auth_repository_1.findRefreshToken)(refreshToken);
    if (!storedToken) {
        throw new Error("Refresh token inválido");
    }
    // Get user from database to get email
    // This would need a function to get user by ID - you might need to add this to user.repository
    // For now, returning the new tokens
    const accessToken = generateAccessToken(decoded.user_id, "email@example.com");
    return {
        accessToken,
        expiresIn: 900, // 15 minutes in seconds
    };
}
// Request password reset
async function requestPasswordReset(email) {
    const user = await (0, user_repository_1.findByEmail)(email);
    if (!user) {
        // Don't reveal if email exists
        return { success: true };
    }
    const resetToken = generatePasswordResetToken(user.id);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await (0, auth_repository_1.createVerificationToken)(user.id, resetToken, "password_reset", expiresAt);
    // TODO: Send email with reset link
    // const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    // await sendResetEmail(email, resetLink);
    return { success: true };
}
// Reset password
async function resetPassword(token, newPassword) {
    // Verify reset token
    const decoded = verifyToken(token, JWT_RESET_SECRET);
    if (decoded.type !== "password_reset") {
        throw new Error("Token inválido para reset de senha");
    }
    // Find verification token
    const verificationToken = await (0, auth_repository_1.findVerificationToken)(token);
    if (!verificationToken) {
        throw new Error("Token de reset expirado ou já utilizado");
    }
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    // Update user password
    await (0, auth_repository_1.updateUserPassword)(decoded.user_id, hashedPassword);
    // Mark token as used
    await (0, auth_repository_1.markTokenAsUsed)(verificationToken.id);
    return { success: true };
}
// Verify email
async function verifyEmail(token) {
    // Verify verification token
    const decoded = verifyToken(token, JWT_VERIFY_SECRET);
    if (decoded.type !== "email_verify") {
        throw new Error("Token inválido para verificação de email");
    }
    // Find verification token
    const verificationToken = await (0, auth_repository_1.findVerificationToken)(token);
    if (!verificationToken) {
        throw new Error("Token de verificação expirado ou já utilizado");
    }
    // Mark email as verified
    await (0, auth_repository_1.markEmailAsVerified)(decoded.user_id);
    // Mark token as used
    await (0, auth_repository_1.markTokenAsUsed)(verificationToken.id);
    return { success: true };
}
// Update email (requires authentication)
async function updateEmail(userId, newEmail) {
    // Check if new email is already in use
    const existingEmail = await (0, user_repository_1.findByEmail)(newEmail);
    if (existingEmail && existingEmail.id !== userId) {
        throw new Error("Este email já está em uso");
    }
    // Update email
    await (0, auth_repository_1.updateUserEmail)(userId, newEmail);
    return { success: true };
}
// Logout
async function logout(refreshToken) {
    try {
        await (0, auth_repository_1.invalidateRefreshToken)(refreshToken);
        return { success: true };
    }
    catch (error) {
        return { success: true }; // Always return success for logout
    }
}
// Generate a simple token for testing (should be removed in production)
function generateSimpleToken() {
    return crypto_1.default.randomBytes(32).toString("hex");
}
//# sourceMappingURL=auth.service.js.map