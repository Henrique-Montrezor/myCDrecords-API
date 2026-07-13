import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// Counts how many reviews the user has already published
export async function countUserReviews(userId: number): Promise<number> {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM reviews WHERE user_id = ?`,
        [userId]
    );
    return Number(rows[0]?.total ?? 0);
}

// Grants the user all badges whose threshold has been reached (idempotent).
// Returns the number of newly granted badges.
export async function awardEligibleBadges(userId: number, reviewCount: number): Promise<number> {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `INSERT IGNORE INTO user_badges (user_id, badge_id)
         SELECT ?, id FROM badges WHERE threshold <= ?`,
        [userId, reviewCount]
    );
    return result.affectedRows;
}

// Badges earned by a user
export async function getUserBadges(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT b.id, b.code, b.name, b.description, b.threshold, ub.awarded_at
         FROM user_badges ub
         JOIN badges b ON b.id = ub.badge_id
         WHERE ub.user_id = ?
         ORDER BY b.threshold ASC`,
        [userId]
    );
    return rows || [];
}

// Full badge catalog
export async function getAllBadges() {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, code, name, description, threshold FROM badges ORDER BY threshold ASC`
    );
    return rows || [];
}
