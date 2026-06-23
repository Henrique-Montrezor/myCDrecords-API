import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export type VoteTarget = "review" | "comment";

// Segue um usuário (idempotente)
export async function followUser(followerId: number, followingId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`,
        [followerId, followingId]
    );
    return result.affectedRows > 0;
}

// Deixa de seguir
export async function unfollowUser(followerId: number, followingId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM follows WHERE follower_id = ? AND following_id = ?`,
        [followerId, followingId]
    );
    return result.affectedRows > 0;
}

// Lista quem segue o usuário
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

// Lista quem o usuário segue
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

// Contadores de seguidores/seguindo
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

// Feed de avaliações dos usuários seguidos
export async function getFollowingFeed(userId: number, page: number) {
    const connection = await initDatabase();
    const offset = (page - 1) * 10;
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
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
         JOIN users u ON u.id = r.user_id
         WHERE r.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, 10, offset]
    );
    return rows || [];
}

// Cria ou atualiza o voto do usuário em um alvo
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

// Remove o voto do usuário
export async function removeVote(userId: number, targetType: VoteTarget, targetId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, targetType, targetId]
    );
    return result.affectedRows > 0;
}

// Pontuação agregada de um alvo
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

// Voto do usuário atual em um alvo (ou null)
export async function getUserVote(userId: number, targetType: VoteTarget, targetId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT value FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, targetType, targetId]
    );
    return rows.length > 0 ? Number(rows[0].value) : null;
}
