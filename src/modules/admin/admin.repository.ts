import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { withTransaction } from "../../utils/withTransaction";

// Get all users with pagination
export async function getAllUsers(page: number = 1, limit: number = 20) {
  const connection = await initDatabase();
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.is_active,
      u.is_admin,
      u.email_verified,
      u.created_at,
      bu.user_id IS NOT NULL as is_banned,
      bu.reason as banned_reason
    FROM users u
    LEFT JOIN banned_users bu ON u.id = bu.user_id AND bu.unbanned_at IS NULL
    LIMIT ? OFFSET ?
  `;

  const [rows] = await connection.query<RowDataPacket[]>(query, [limit, offset]);
  return rows || [];
}

// Get total users count
export async function getTotalUsersCount() {
  const connection = await initDatabase();
  const query = `SELECT COUNT(*) as count FROM users`;

  const [rows] = await connection.query<RowDataPacket[]>(query);
  return rows[0]?.count || 0;
}

// Ban user
export async function banUser(userId: number, adminId: number, reason: string) {
  const connection = await initDatabase();
  const query = `
    INSERT INTO banned_users (user_id, banned_by, reason, banned_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE 
      banned_by = ?,
      reason = ?,
      unbanned_at = NULL,
      banned_at = NOW()
  `;

  const [result] = await connection.query<any>(query, [userId, adminId, reason, adminId, reason]);
  
  // Update user is_active to false
  await connection.query(`UPDATE users SET is_active = false WHERE id = ?`, [userId]);
  
  return result;
}

// Unban user
export async function unbanUser(userId: number) {
  const connection = await initDatabase();
  const query = `
    UPDATE banned_users 
    SET unbanned_at = NOW()
    WHERE user_id = ? AND unbanned_at IS NULL
  `;

  const [result] = await connection.query<any>(query, [userId]);
  
  // Update user is_active to true
  await connection.query(`UPDATE users SET is_active = true WHERE id = ?`, [userId]);
  
  return result;
}

// Check if user is banned
export async function isUserBanned(userId: number) {
  const connection = await initDatabase();
  const query = `
    SELECT * FROM banned_users 
    WHERE user_id = ? AND unbanned_at IS NULL
  `;

  const [rows] = await connection.query<RowDataPacket[]>(query, [userId]);
  return rows && rows.length > 0 ? rows[0] : null;
}

// Get all reviews
export async function getAllReviews(page: number = 1, limit: number = 20) {
  const connection = await initDatabase();
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      r.id,
      r.user_id,
      u.username,
      r.album_id,
      r.album_title,
      r.album_image,
      r.album_artist,
      r.rating,
      r.text,
      r.created_at
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await connection.query<RowDataPacket[]>(query, [limit, offset]);
  return rows || [];
}

// Delete review
export async function deleteReview(reviewId: number) {
  // Removes attached comments and the review atomically.
  return withTransaction(async (connection) => {
    await connection.query<ResultSetHeader>(
      `DELETE FROM comments WHERE review_id = ?`,
      [reviewId]
    );

    const [result] = await connection.query<ResultSetHeader>(
      `DELETE FROM reviews WHERE id = ?`,
      [reviewId]
    );

    return result;
  });
}

// Get all comments
export async function getAllComments(page: number = 1, limit: number = 20) {
  const connection = await initDatabase();
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      c.id,
      c.user_id,
      u.username,
      c.review_id,
      c.album_id,
      c.text,
      c.created_at
    FROM comments c
    JOIN users u ON c.user_id = u.id
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await connection.query<RowDataPacket[]>(query, [limit, offset]);
  return rows || [];
}

// Delete comment
export async function deleteComment(commentId: number) {
  const connection = await initDatabase();
  const query = `DELETE FROM comments WHERE id = ?`;

  const [result] = await connection.query<any>(query, [commentId]);
  return result;
}

// Get all reports
export async function getAllReports(page: number = 1, limit: number = 20) {
  const connection = await initDatabase();
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      r.id,
      r.reporter_id,
      u.username as reporter_username,
      r.reported_type,
      r.reported_id,
      r.reason,
      r.description,
      r.status,
      r.created_at,
      r.updated_at
    FROM reports r
    JOIN users u ON r.reporter_id = u.id
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await connection.query<RowDataPacket[]>(query, [limit, offset]);
  return rows || [];
}

// Get reports by status
export async function getReportsByStatus(status: string, page: number = 1, limit: number = 20) {
  const connection = await initDatabase();
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      r.id,
      r.reporter_id,
      u.username as reporter_username,
      r.reported_type,
      r.reported_id,
      r.reason,
      r.description,
      r.status,
      r.created_at,
      r.updated_at
    FROM reports r
    JOIN users u ON r.reporter_id = u.id
    WHERE r.status = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await connection.query<RowDataPacket[]>(query, [status, limit, offset]);
  return rows || [];
}

// Check if user is admin
export async function isUserAdmin(userId: number) {
  const connection = await initDatabase();
  const query = `SELECT user_id FROM admins WHERE user_id = ?`;

  const [rows] = await connection.query<RowDataPacket[]>(query, [userId]);
  return rows && rows.length > 0 ? true : false;
}
