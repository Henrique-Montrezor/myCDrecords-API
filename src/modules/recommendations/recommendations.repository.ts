import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket } from "mysql2";

// Albums the user already knows (reviewed or pinned as favorite) are never recommended
const KNOWN_ALBUMS = `SELECT album_id FROM reviews WHERE user_id = ?
    UNION SELECT album_id FROM profile_favorites WHERE user_id = ?`;

// How much the user has told us about their taste
export async function getTasteProfile(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
            (SELECT COUNT(*) FROM reviews WHERE user_id = ?) AS reviews,
            (SELECT COUNT(*) FROM profile_favorites WHERE user_id = ?) AS favorites`,
        [userId, userId]
    );
    return { reviews: Number(rows[0]?.reviews ?? 0), favorites: Number(rows[0]?.favorites ?? 0) };
}

// 1. Collaborative filtering: what people who loved the same albums (reviews >= 4 or favorites) also loved
export async function getCollaborativeRecommendations(userId: number, limit: number = 10) {
    const connection = await initDatabase();
    
    const query = `
        SELECT 
            r2.album_id, 
            r2.album_title, 
            r2.album_artist, 
            r2.album_image,
            r2.album_genre,
            COUNT(DISTINCT r2.user_id) as afinidade_score,
            AVG(r2.rating) as nota_media
        FROM reviews r1
        JOIN reviews r2 ON r1.user_id = r2.user_id
        WHERE 
            r1.album_id IN (
                SELECT album_id FROM reviews WHERE user_id = ? AND rating >= 4
                UNION SELECT album_id FROM profile_favorites WHERE user_id = ?
            )
            AND r1.user_id != ? 
            AND r2.rating >= 4 
            AND r2.album_id NOT IN (${KNOWN_ALBUMS})
        GROUP BY 
            r2.album_id, r2.album_title, r2.album_artist, r2.album_image, r2.album_genre
        ORDER BY 
            afinidade_score DESC, nota_media DESC
        LIMIT ?;
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [userId, userId, userId, userId, userId, limit]);
    return rows;
}

// 2. Genre affinity: well-rated albums in the genres the user rates highest
export async function getGenreRecommendations(userId: number, limit: number = 10) {
    const connection = await initDatabase();

    const query = `
        SELECT
            album_id,
            album_title,
            album_artist,
            album_image,
            album_genre,
            COUNT(DISTINCT user_id) as total_avaliacoes,
            AVG(rating) as nota_media
        FROM reviews
        WHERE rating >= 4
            AND user_id != ?
            AND album_genre IN (
                SELECT album_genre FROM (
                    SELECT album_genre FROM reviews
                    WHERE user_id = ? AND rating >= 4 AND album_genre IS NOT NULL AND album_genre <> ''
                    GROUP BY album_genre
                    ORDER BY COUNT(*) DESC
                    LIMIT 3
                ) top_genres
            )
            AND album_id NOT IN (${KNOWN_ALBUMS})
        GROUP BY album_id, album_title, album_artist, album_image, album_genre
        ORDER BY total_avaliacoes DESC, nota_media DESC
        LIMIT ?;
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [userId, userId, userId, userId, limit]);
    return rows;
}

// 3. Cold Start fallback (Platform's Popular Albums)
export async function getPopularRecommendations(userId: number, limit: number = 10) {
    const connection = await initDatabase();
    
    // Fetches the highest-rated albums by everyone, but hides those the user has already reviewed
    const query = `
        SELECT 
            album_id, 
            album_title, 
            album_artist, 
            album_image,
            album_genre,
            COUNT(user_id) as total_avaliacoes,
            AVG(rating) as nota_media
        FROM reviews
        WHERE rating >= 4
        AND album_id NOT IN (${KNOWN_ALBUMS})
        GROUP BY album_id, album_title, album_artist, album_image, album_genre
        HAVING total_avaliacoes >= 2 -- At least 2 reviews to be considered 'popular'
        ORDER BY total_avaliacoes DESC, nota_media DESC
        LIMIT ?;
    `;

    const [rows] = await connection.query<RowDataPacket[]>(query, [userId, userId, limit]);
    return rows;
}