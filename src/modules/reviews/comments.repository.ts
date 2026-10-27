import { RowDataPacket, ResultSetHeader } from "mysql2";
import { initDatabase } from "../../mysql2/init.database";

export const COMMENTS_PAGE_SIZE = 20;

const COMMENT_SELECT = `
    SELECT c.id, c.review_id, c.user_id, u.username, p.avatar_url, c.text, c.created_at, c.updated_at
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN profiles p ON p.user_id = c.user_id
`;

export async function reviewExists(reviewId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT id FROM reviews WHERE id = ?`, [reviewId]);
    return rows.length > 0;
}

// oldest first, so a thread reads top to bottom
export async function getCommentsByReviewId(reviewId: number, page: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `${COMMENT_SELECT} WHERE c.review_id = ? ORDER BY c.created_at ASC, c.id ASC LIMIT ? OFFSET ?`,
        [reviewId, COMMENTS_PAGE_SIZE, (page - 1) * COMMENTS_PAGE_SIZE]
    );
    return rows;
}

export async function getCommentById(commentId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(`${COMMENT_SELECT} WHERE c.id = ?`, [commentId]);
    return rows[0] ?? null;
}

// Returns the new id, or null when the review does not exist
export async function postComment(userId: number, reviewId: number, text: string) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO comments (user_id, review_id, album_id, text)
         SELECT ?, r.id, r.album_id, ? FROM reviews r WHERE r.id = ?`,
        [userId, text, reviewId]
    );
    return result.affectedRows > 0 ? result.insertId : null;
}

export async function updateComment(commentId: number, userId: number, text: string) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `UPDATE comments SET text = ? WHERE id = ? AND user_id = ?`,
        [text, commentId, userId]
    );
    return result.affectedRows > 0;
}

export async function deleteComment(commentId: number, userId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM comments WHERE id = ? AND user_id = ?`,
        [commentId, userId]
    );
    return result.affectedRows > 0;
}
