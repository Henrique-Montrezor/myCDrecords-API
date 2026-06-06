import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket } from "mysql2";

// get reviews for a product with pagination
export async function getReviewsByAlbumId(albumId: number, page: number) {
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
        WHERE r.album_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [albumId, 10, offset]);
    return rows || [];
}

// post a review for a product
export async function postReview(userId: number, albumId: string, albumTitle: string, albumImage: string, albumArtist: string, rating: number, text?: string) {
    const connection = await initDatabase();
    const query = `
        INSERT INTO reviews (user_id, album_id, album_title, album_image, album_artist, rating, text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query<any>(query, [userId, albumId, albumTitle, albumImage, albumArtist, rating, text]);
    return result.insertId;
}

// delete a review
export async function deleteReview(reviewId: number) {
    const connection = await initDatabase();

    // Delete associated comments first
    await connection.query(`DELETE FROM comments WHERE review_id = ?`, [reviewId]);
    // Delete the review
    await connection.query(`DELETE FROM reviews WHERE id = ?`, [reviewId]);
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
