import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { withTransaction } from "../../utils/withTransaction";


// Vote score and the viewer's own vote, resolved per review row (first placeholder = viewer id)
const VOTE_COLUMNS = `
    CAST(COALESCE((SELECT SUM(v.value) FROM votes v WHERE v.target_type = 'review' AND v.target_id = r.id), 0) AS SIGNED) AS score,
    (SELECT v.value FROM votes v WHERE v.target_type = 'review' AND v.target_id = r.id AND v.user_id = ?) AS user_vote,
    CAST((SELECT COUNT(*) FROM comments c WHERE c.review_id = r.id) AS SIGNED) AS comment_count
`;

// get reviews for a product with pagination
export async function getReviewsByAlbumId(albumId: string, page: number, viewerId: number) {
    const connection = await initDatabase();
    const offset = (page - 1) * 10;

    const query = `
        SELECT 
            r.id,
            r.user_id,
            u.username,
            r.rating,
            r.text,
            r.created_at,
            ${VOTE_COLUMNS}
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.album_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [viewerId, albumId, 10, offset]);
    return rows || [];
}

// the viewer's own review of an album, if any
export async function getUserReviewForAlbum(userId: number, albumId: string) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(`
        SELECT
            r.id,
            r.user_id,
            u.username,
            r.rating,
            r.text,
            r.created_at,
            ${VOTE_COLUMNS}
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.album_id = ? AND r.user_id = ?
        LIMIT 1
    `, [userId, albumId, userId]);
    return rows[0] ?? null;
}

// rating counts per star for an album
export async function getAlbumRatingCounts(albumId: string) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT rating, COUNT(*) AS count FROM reviews WHERE album_id = ? GROUP BY rating`,
        [albumId]
    );
    return (rows || []) as Array<{ rating: number; count: number }>;
}

// post a review for a album
export async function postReview(userId: number, 
    albumId: string, 
    albumTitle: string, 
    albumImage: string, 
    albumArtist: string, 
    albumGenre: string, // Novo campo
    rating: number, 
    text: string
){
    const connection = await initDatabase();
    
    const query = `
        INSERT INTO reviews (user_id, album_id, album_title, album_image, album_artist, album_genre, rating, text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query<any>(query, [userId, albumId, albumTitle, albumImage, albumArtist, albumGenre, rating, text]);
    return result.insertId;
}

// delete a review
export async function deleteReview(reviewId: number, userId: number) {
    // Deletes attached comments and the review in a single transaction,
    // ensuring no data is left inconsistent on failure.
    return withTransaction(async (connection) => {
        // 1. Remove the comments linked to the review
        await connection.query<ResultSetHeader>(
            `DELETE FROM comments WHERE review_id = ?`,
            [reviewId]
        );

        // 2. Remove the review ensuring the user's ownership
        const [result] = await connection.query<ResultSetHeader>(
            `DELETE FROM reviews WHERE id = ? AND user_id = ?`,
            [reviewId, userId]
        );

        return result.affectedRows > 0;
    });
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

    // The WHERE now requires the ID to match AND the owner to be the provided userId
    const query = `
        UPDATE reviews
        SET rating = ?, text = ?
        WHERE id = ? AND user_id = ?
    `;

    const [result] = await connection.query<ResultSetHeader>(query, [rating, text, reviewId, userId]);
    
    // Returns true if any row was updated, false otherwise
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
    return rows.length > 0; // Now returns true if a review already exists, correctly triggering the 409 error
}