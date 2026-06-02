"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVerificationToken = createVerificationToken;
exports.findVerificationToken = findVerificationToken;
exports.markTokenAsUsed = markTokenAsUsed;
exports.updateUserEmail = updateUserEmail;
exports.updateUserPassword = updateUserPassword;
exports.markEmailAsVerified = markEmailAsVerified;
exports.storeRefreshToken = storeRefreshToken;
exports.findRefreshToken = findRefreshToken;
exports.invalidateRefreshToken = invalidateRefreshToken;
exports.storeOAuthProvider = storeOAuthProvider;
exports.findOAuthUser = findOAuthUser;
const init_database_1 = require("../../mysql2/init.database");
// Create a verification token record
async function createVerificationToken(userId, token, type, expiresAt) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    INSERT INTO verification_tokens (user_id, token, type, expires_at, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;
    const [result] = await connection.query(query, [userId, token, type, expiresAt]);
    return result;
}
// Find verification token
async function findVerificationToken(token) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    SELECT * FROM verification_tokens 
    WHERE token = ? AND expires_at > NOW() AND used = false
  `;
    const [rows] = await connection.query(query, [token]);
    return rows[0] || null;
}
// Mark verification token as used
async function markTokenAsUsed(tokenId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    UPDATE verification_tokens 
    SET used = true, used_at = NOW() 
    WHERE id = ?
  `;
    const [result] = await connection.query(query, [tokenId]);
    return result;
}
// Update user email
async function updateUserEmail(userId, email) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    UPDATE users 
    SET email = ?, email_verified = true 
    WHERE id = ?
  `;
    const [result] = await connection.query(query, [email, userId]);
    return result;
}
// Update user password
async function updateUserPassword(userId, hashedPassword) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    UPDATE users 
    SET password = ? 
    WHERE id = ?
  `;
    const [result] = await connection.query(query, [hashedPassword, userId]);
    return result;
}
// Mark email as verified
async function markEmailAsVerified(userId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    UPDATE users 
    SET email_verified = true 
    WHERE id = ?
  `;
    const [result] = await connection.query(query, [userId]);
    return result;
}
// Store refresh token
async function storeRefreshToken(userId, token, expiresAt) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, NOW())
  `;
    const [result] = await connection.query(query, [userId, token, expiresAt]);
    return result;
}
// Find and validate refresh token
async function findRefreshToken(token) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    SELECT * FROM refresh_tokens 
    WHERE token = ? AND expires_at > NOW() AND is_valid = true
  `;
    const [rows] = await connection.query(query, [token]);
    return rows[0] || null;
}
// Invalidate refresh token (logout)
async function invalidateRefreshToken(token) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    UPDATE refresh_tokens 
    SET is_valid = false 
    WHERE token = ?
  `;
    const [result] = await connection.query(query, [token]);
    return result;
}
// Store OAuth provider connection
async function storeOAuthProvider(userId, provider, providerId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    INSERT INTO oauth_providers (user_id, provider, provider_id, created_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE provider_id = ?
  `;
    const [result] = await connection.query(query, [userId, provider, providerId, providerId]);
    return result;
}
// Find OAuth user
async function findOAuthUser(provider, providerId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    SELECT u.* FROM users u
    JOIN oauth_providers o ON u.id = o.user_id
    WHERE o.provider = ? AND o.provider_id = ?
  `;
    const [rows] = await connection.query(query, [provider, providerId]);
    return rows[0] || null;
}
//# sourceMappingURL=auth.repository.js.map