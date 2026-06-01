import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket } from "mysql2";

// Create a verification token record
export async function createVerificationToken(
  userId: number,
  token: string,
  type: "email_verify" | "password_reset",
  expiresAt: Date
) {
  const connection = await initDatabase();
  const query = `
    INSERT INTO verification_tokens (user_id, token, type, expires_at, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;
  
  const [result] = await connection.query<any>(query, [userId, token, type, expiresAt]);
  return result;
}

// Find verification token
export async function findVerificationToken(token: string) {
  const connection = await initDatabase();
  const query = `
    SELECT * FROM verification_tokens 
    WHERE token = ? AND expires_at > NOW() AND used = false
  `;
  
  const [rows] = await connection.query<RowDataPacket[]>(query, [token]);
  return rows[0] || null;
}

// Mark verification token as used
export async function markTokenAsUsed(tokenId: number) {
  const connection = await initDatabase();
  const query = `
    UPDATE verification_tokens 
    SET used = true, used_at = NOW() 
    WHERE id = ?
  `;
  
  const [result] = await connection.query<any>(query, [tokenId]);
  return result;
}

// Update user email
export async function updateUserEmail(userId: number, email: string) {
  const connection = await initDatabase();
  const query = `
    UPDATE users 
    SET email = ?, email_verified = true 
    WHERE id = ?
  `;
  
  const [result] = await connection.query<any>(query, [email, userId]);
  return result;
}

// Update user password
export async function updateUserPassword(userId: number, hashedPassword: string) {
  const connection = await initDatabase();
  const query = `
    UPDATE users 
    SET password = ? 
    WHERE id = ?
  `;
  
  const [result] = await connection.query<any>(query, [hashedPassword, userId]);
  return result;
}

// Mark email as verified
export async function markEmailAsVerified(userId: number) {
  const connection = await initDatabase();
  const query = `
    UPDATE users 
    SET email_verified = true 
    WHERE id = ?
  `;
  
  const [result] = await connection.query<any>(query, [userId]);
  return result;
}

// Store refresh token
export async function storeRefreshToken(
  userId: number,
  token: string,
  expiresAt: Date
) {
  const connection = await initDatabase();
  const query = `
    INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  
  const [result] = await connection.query<any>(query, [userId, token, expiresAt]);
  return result;
}

// Find and validate refresh token
export async function findRefreshToken(token: string) {
  const connection = await initDatabase();
  const query = `
    SELECT * FROM refresh_tokens 
    WHERE token = ? AND expires_at > NOW() AND is_valid = true
  `;
  
  const [rows] = await connection.query<RowDataPacket[]>(query, [token]);
  return rows[0] || null;
}

// Invalidate refresh token (logout)
export async function invalidateRefreshToken(token: string) {
  const connection = await initDatabase();
  const query = `
    UPDATE refresh_tokens 
    SET is_valid = false 
    WHERE token = ?
  `;
  
  const [result] = await connection.query<any>(query, [token]);
  return result;
}

// Store OAuth provider connection
export async function storeOAuthProvider(
  userId: number,
  provider: "google" | "spotify" | "discord",
  providerId: string
) {
  const connection = await initDatabase();
  const query = `
    INSERT INTO oauth_providers (user_id, provider, provider_id, created_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE provider_id = ?
  `;
  
  const [result] = await connection.query<any>(query, [userId, provider, providerId, providerId]);
  return result;
}

// Find OAuth user
export async function findOAuthUser(provider: string, providerId: string) {
  const connection = await initDatabase();
  const query = `
    SELECT u.* FROM users u
    JOIN oauth_providers o ON u.id = o.user_id
    WHERE o.provider = ? AND o.provider_id = ?
  `;
  
  const [rows] = await connection.query<RowDataPacket[]>(query, [provider, providerId]);
  return rows[0] || null;
}
