import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";


// get reviews for a product with pagination
export async function getReviewsByAlbumId(albumId: number, page: number) {
    const connection = await initDatabase();
    const offset = (page - 1) * 10;

    const query = `
        SELECT 
            r.id,
            r.user_id,
            u.username,
            r.rating,
            r.text,
            r.created_at
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.album_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [albumId, 10, offset]);
    return rows || [];
}

// post a review for a album
export async function postReview(userId: number, albumId: string, rating: number, text: string) {
    const connection = await initDatabase();
    
    const query = `
        INSERT INTO reviews (user_id, album_id, rating, text)
        VALUES (?, ?, ?, ?)
    `;

    const [result] = await connection.query<any>(query, [userId, albumId, rating, text]);
    return result.insertId;
}

// delete a review
export async function deleteReview(reviewId: number, userId: number) {
    const connection = await initDatabase();

    // Delete the review
    const query = `
        DELETE FROM reviews 
        WHERE id = ? AND user_id = ?
    `;

    const [result] = await connection.query<ResultSetHeader>(query, [reviewId, userId]);

    return result.affectedRows > 0;

}

// get all reviews by a user
export async function getReviewsByUserId(userId: number, page: number) {
    const connection = await initDatabase();
    const offset = (page - 1) * 10;

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
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [userId, 10, offset]);
    return rows || [];
}

export async function updateReview(reviewId: number, userId: number, rating: number, text: string) {
    const connection = await initDatabase();

    // O WHERE agora exige que o ID coincida E que o dono seja o userId fornecido
    const query = `
        UPDATE reviews
        SET rating = ?, text = ?
        WHERE id = ? AND user_id = ?
    `;

    const [result] = await connection.query<ResultSetHeader>(query, [rating, text, reviewId, userId]);
    
    // Retorna true se alguma linha foi atualizada, false caso contrário
    return result.affectedRows > 0;
}

export async function checkReview(userId: number, albumId: string): Promise<boolean> {
    const connection = await initDatabase();

    const query = `
        SELECT 
            id
        FROM reviews
        WHERE user_id = ? AND album_id = ?
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [userId, albumId]);
    return rows.length > 0; // Agora retorna true se já existir uma review, ativando corretamente o erro 409
}