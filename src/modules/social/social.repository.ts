import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export type VoteTarget = "review" | "comment";

// Follows a user (idempotent)
export async function followUser(followerId: number, followingId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`,
        [followerId, followingId]
    );
    return result.affectedRows > 0;
}

// Unfollows
export async function unfollowUser(followerId: number, followingId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM follows WHERE follower_id = ? AND following_id = ?`,
        [followerId, followingId]
    );
    return result.affectedRows > 0;
}

// Lists who follows the user
export async function getFollowers(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT u.id, u.username, f.created_at
         FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ?
         ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows || [];
}

// Lists who the user follows
export async function getFollowing(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT u.id, u.username, f.created_at
         FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ?
         ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows || [];
}

// Followers/following counters
export async function getFollowCounts(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
            (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
        [userId, userId]
    );
    return rows[0] || { followers: 0, following: 0 };
}

export type FeedScope = "following" | "friends";

const FOLLOWING_IDS = `SELECT following_id FROM follows WHERE follower_id = ?`;
// Friends are mutual follows
const FRIEND_IDS = `SELECT f.following_id FROM follows f
    JOIN follows b ON b.follower_id = f.following_id AND b.following_id = f.follower_id
    WHERE f.follower_id = ?`;

// Activity (reviews, public lists, new follows) from followed users or mutual friends, newest first
export async function getFollowingFeed(userId: number, page: number, scope: FeedScope = "following") {
    const connection = await initDatabase();
    const offset = (page - 1) * 10;
    const circle = scope === "friends" ? FRIEND_IDS : FOLLOWING_IDS;
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM (
            SELECT 'review' AS type, r.id, r.user_id, u.username, p.avatar_url, r.created_at,
                   r.album_id, r.album_title, r.album_image, r.album_artist, r.rating, r.text,
                   NULL AS list_id, NULL AS list_title, NULL AS item_count,
                   NULL AS target_id, NULL AS target_username, NULL AS target_avatar_url
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            LEFT JOIN profiles p ON p.user_id = r.user_id
            WHERE r.user_id IN (${circle})
            UNION ALL
            SELECT 'list' AS type, l.id, l.user_id, u.username, p.avatar_url, l.created_at,
                   NULL AS album_id, NULL AS album_title,
                   (SELECT li.album_image FROM list_items li WHERE li.list_id = l.id ORDER BY li.position, li.id LIMIT 1) AS album_image,
                   NULL AS album_artist, NULL AS rating, l.description AS text,
                   l.id AS list_id, l.title AS list_title,
                   (SELECT CAST(COUNT(*) AS SIGNED) FROM list_items li WHERE li.list_id = l.id) AS item_count,
                   NULL AS target_id, NULL AS target_username, NULL AS target_avatar_url
            FROM lists l
            JOIN users u ON u.id = l.user_id
            LEFT JOIN profiles p ON p.user_id = l.user_id
            WHERE l.user_id IN (${circle})
              AND l.is_public = 1
              AND EXISTS (SELECT 1 FROM list_items li WHERE li.list_id = l.id)
            UNION ALL
            SELECT 'follow' AS type, f.id, f.follower_id AS user_id, u.username, p.avatar_url, f.created_at,
                   NULL AS album_id, NULL AS album_title, NULL AS album_image, NULL AS album_artist,
                   NULL AS rating, NULL AS text,
                   NULL AS list_id, NULL AS list_title, NULL AS item_count,
                   f.following_id AS target_id, t.username AS target_username, tp.avatar_url AS target_avatar_url
            FROM follows f
            JOIN users u ON u.id = f.follower_id
            LEFT JOIN profiles p ON p.user_id = f.follower_id
            JOIN users t ON t.id = f.following_id
            LEFT JOIN profiles tp ON tp.user_id = f.following_id
            WHERE f.follower_id IN (${circle})
         ) activity
         ORDER BY created_at DESC, type, id DESC
         LIMIT ? OFFSET ?`,
        [userId, userId, userId, 10, offset]
    );
    return rows || [];
}

// Creates or updates the user's vote on a target
export async function upsertVote(
    userId: number,
    targetType: VoteTarget,
    targetId: number,
    value: 1 | -1
) {
    const connection = await initDatabase();
    await connection.query<ResultSetHeader>(
        `INSERT INTO votes (user_id, target_type, target_id, value)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [userId, targetType, targetId, value]
    );
}

// Removes the user's vote
export async function removeVote(userId: number, targetType: VoteTarget, targetId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, targetType, targetId]
    );
    return result.affectedRows > 0;
}

// Aggregate score of a target
export async function getVoteScore(targetType: VoteTarget, targetId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
            CAST(COALESCE(SUM(value), 0) AS SIGNED) AS score,
            CAST(COALESCE(SUM(value = 1), 0) AS SIGNED) AS upvotes,
            CAST(COALESCE(SUM(value = -1), 0) AS SIGNED) AS downvotes
         FROM votes
         WHERE target_type = ? AND target_id = ?`,
        [targetType, targetId]
    );
    return rows[0] || { score: 0, upvotes: 0, downvotes: 0 };
}

// Current user's vote on a target (or null)
export async function getUserVote(userId: number, targetType: VoteTarget, targetId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT value FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, targetType, targetId]
    );
    return rows.length > 0 ? Number(rows[0].value) : null;
}
