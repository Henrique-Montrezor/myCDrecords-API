"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = getAllUsers;
exports.getTotalUsersCount = getTotalUsersCount;
exports.banUser = banUser;
exports.unbanUser = unbanUser;
exports.isUserBanned = isUserBanned;
exports.getAllReviews = getAllReviews;
exports.deleteReview = deleteReview;
exports.getAllComments = getAllComments;
exports.deleteComment = deleteComment;
exports.getAllReports = getAllReports;
exports.getReportsByStatus = getReportsByStatus;
exports.isUserAdmin = isUserAdmin;
const init_database_1 = require("../../mysql2/init.database");
// Get all users with pagination
async function getAllUsers(page = 1, limit = 20) {
    const connection = await (0, init_database_1.initDatabase)();
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
    const [rows] = await connection.query(query, [limit, offset]);
    return rows || [];
}
// Get total users count
async function getTotalUsersCount() {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `SELECT COUNT(*) as count FROM users`;
    const [rows] = await connection.query(query);
    return rows[0]?.count || 0;
}
// Ban user
async function banUser(userId, adminId, reason) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    INSERT INTO banned_users (user_id, banned_by, reason, banned_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE 
      banned_by = ?,
      reason = ?,
      unbanned_at = NULL,
      banned_at = NOW()
  `;
    const [result] = await connection.query(query, [userId, adminId, reason, adminId, reason]);
    // Update user is_active to false
    await connection.query(`UPDATE users SET is_active = false WHERE id = ?`, [userId]);
    return result;
}
// Unban user
async function unbanUser(userId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    UPDATE banned_users 
    SET unbanned_at = NOW()
    WHERE user_id = ? AND unbanned_at IS NULL
  `;
    const [result] = await connection.query(query, [userId]);
    // Update user is_active to true
    await connection.query(`UPDATE users SET is_active = true WHERE id = ?`, [userId]);
    return result;
}
// Check if user is banned
async function isUserBanned(userId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
    SELECT * FROM banned_users 
    WHERE user_id = ? AND unbanned_at IS NULL
  `;
    const [rows] = await connection.query(query, [userId]);
    return rows && rows.length > 0 ? rows[0] : null;
}
// Get all reviews
async function getAllReviews(page = 1, limit = 20) {
    const connection = await (0, init_database_1.initDatabase)();
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
    const [rows] = await connection.query(query, [limit, offset]);
    return rows || [];
}
// Delete review
async function deleteReview(reviewId) {
    const connection = await (0, init_database_1.initDatabase)();
    // Delete associated comments first
    await connection.query(`DELETE FROM comments WHERE review_id = ?`, [reviewId]);
    // Delete the review
    const query = `DELETE FROM reviews WHERE id = ?`;
    const [result] = await connection.query(query, [reviewId]);
    return result;
}
// Get all comments
async function getAllComments(page = 1, limit = 20) {
    const connection = await (0, init_database_1.initDatabase)();
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
    const [rows] = await connection.query(query, [limit, offset]);
    return rows || [];
}
// Delete comment
async function deleteComment(commentId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `DELETE FROM comments WHERE id = ?`;
    const [result] = await connection.query(query, [commentId]);
    return result;
}
// Get all reports
async function getAllReports(page = 1, limit = 20) {
    const connection = await (0, init_database_1.initDatabase)();
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
    const [rows] = await connection.query(query, [limit, offset]);
    return rows || [];
}
// Get reports by status
async function getReportsByStatus(status, page = 1, limit = 20) {
    const connection = await (0, init_database_1.initDatabase)();
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
    const [rows] = await connection.query(query, [status, limit, offset]);
    return rows || [];
}
// Check if user is admin
async function isUserAdmin(userId) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `SELECT user_id FROM admins WHERE user_id = ?`;
    const [rows] = await connection.query(query, [userId]);
    return rows && rows.length > 0 ? true : false;
}
//# sourceMappingURL=admin.repository.js.map