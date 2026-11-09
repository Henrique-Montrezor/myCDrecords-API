import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket } from "mysql2";
import { CatalogCandidate, CommunityStats, RecommendationPreferences } from "./recommendations.engine";

const MBID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const TAG_CANDIDATE_LIMIT = 300;
const COLLABORATIVE_LIMIT = 200;
const POPULAR_LIMIT = 100;

export const isMbid = (value: unknown): value is string => typeof value === "string" && new RegExp(MBID_PATTERN).test(value);

const emptyPreferences = (): RecommendationPreferences => ({ genres: [], artists: [] });

export async function getRecommendationPreferences(userId: number): Promise<RecommendationPreferences> {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>("SELECT genres, artists FROM recommendation_preferences WHERE user_id = ?", [userId]);
    if (!rows[0]) return emptyPreferences();
    return {
        genres: jsonArray(rows[0].genres).filter((value): value is string => typeof value === "string"),
        artists: jsonArray(rows[0].artists).filter((value): value is string => typeof value === "string"),
    };
}

export async function saveRecommendationPreferences(userId: number, preferences: RecommendationPreferences) {
    const connection = await initDatabase();
    await connection.query(`
        INSERT INTO recommendation_preferences (user_id, genres, artists) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE genres = VALUES(genres), artists = VALUES(artists)
    `, [userId, JSON.stringify(preferences.genres), JSON.stringify(preferences.artists)]);
}

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

const jsonArray = (value: unknown): unknown[] => {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
};

function toCandidate(row: RowDataPacket): CatalogCandidate {
    return {
        albumId: String(row.external_id),
        title: String(row.title),
        artists: jsonArray(row.artists).map((artist) => (artist as { name?: unknown })?.name).filter((name): name is string => typeof name === "string" && name !== ""),
        releaseDate: row.release_date ? String(row.release_date) : "",
        tags: jsonArray(row.tags).filter((tag): tag is string => typeof tag === "string"),
    };
}

// Spotify-ID reviews never feed the engine (SPOTIFY-COMPLIANCE §3); only MusicBrainz IDs are signals or candidates.
export async function getUserTaste(userId: number) {
    const connection = await initDatabase();
    const [[reviews], [favorites], [dismissed]] = await Promise.all([
        connection.query<RowDataPacket[]>("SELECT album_id, rating FROM reviews WHERE user_id = ?", [userId]),
        connection.query<RowDataPacket[]>("SELECT album_id FROM profile_favorites WHERE user_id = ?", [userId]),
        connection.query<RowDataPacket[]>("SELECT album_id FROM recommendation_dismissals WHERE user_id = ?", [userId]),
    ]);
    const ratings = new Map<string, number>();
    for (const row of reviews) if (isMbid(row.album_id)) ratings.set(row.album_id.toLowerCase(), Number(row.rating));
    for (const row of favorites) if (isMbid(row.album_id)) ratings.set(row.album_id.toLowerCase(), 5);
    const excluded = new Set<string>([...reviews, ...favorites, ...dismissed].map((row) => String(row.album_id).toLowerCase()));
    return { ratings, excluded };
}

export async function getCatalogAlbums(ids: string[]) {
    if (ids.length === 0) return [];
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT external_id, title, artists, release_date, tags FROM album_catalog
        WHERE source = 'musicbrainz' AND external_id IN (?)`, [ids],
    );
    return rows.map(toCandidate);
}

export async function getTagCandidates(tags: string[], excluded: string[]) {
    if (tags.length === 0) return [];
    const connection = await initDatabase();
    const exclusion = excluded.length > 0 ? "AND external_id NOT IN (?)" : "";
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT external_id, title, artists, release_date, tags FROM album_catalog
        WHERE source = 'musicbrainz' AND (${tags.map(() => "JSON_CONTAINS(tags, ?)").join(" OR ")}) ${exclusion}
        ORDER BY id LIMIT ?`,
        [...tags.map((tag) => JSON.stringify(tag)), ...(excluded.length > 0 ? [excluded] : []), TAG_CANDIDATE_LIMIT],
    );
    return rows.map(toCandidate);
}

export async function getPreferenceCandidates(preferences: RecommendationPreferences, excluded: string[]) {
    const conditions = [
        ...preferences.genres.map(() => "JSON_CONTAINS(tags, ?)") ,
        ...preferences.artists.map(() => "JSON_CONTAINS(artists, JSON_OBJECT('name', ?))"),
    ];
    if (conditions.length === 0) return [];
    const connection = await initDatabase();
    const exclusion = excluded.length > 0 ? "AND external_id NOT IN (?)" : "";
    const values = [
        ...preferences.genres.map((genre) => JSON.stringify(genre)),
        ...preferences.artists,
        ...(excluded.length > 0 ? [excluded] : []),
        TAG_CANDIDATE_LIMIT,
    ];
    const [rows] = await connection.query<RowDataPacket[]>(`
        SELECT external_id, title, artists, release_date, tags FROM album_catalog
        WHERE source = 'musicbrainz' AND (${conditions.join(" OR ")}) ${exclusion}
        ORDER BY id LIMIT ?
    `, values);
    return rows.map(toCandidate);
}

export async function getDismissedRecommendations(userId: number, limit: number, offset: number) {
    const connection = await initDatabase();
    const [[countRows], [rows]] = await Promise.all([
        connection.query<RowDataPacket[]>(`
            SELECT COUNT(*) AS total FROM recommendation_dismissals d
            JOIN album_catalog c ON c.external_id = d.album_id AND c.source = 'musicbrainz'
            WHERE d.user_id = ?
        `, [userId]),
        connection.query<RowDataPacket[]>(`
            SELECT c.external_id AS album_id, c.title AS album_title,
                JSON_UNQUOTE(JSON_EXTRACT(c.artists, '$[0].name')) AS album_artist,
                c.release_date, 'musicbrainz' AS source
            FROM recommendation_dismissals d
            JOIN album_catalog c ON c.external_id = d.album_id AND c.source = 'musicbrainz'
            WHERE d.user_id = ?
            ORDER BY d.created_at DESC, c.external_id
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]),
    ]);
    return {
        total: Number(countRows[0]?.total ?? 0),
        data: rows.map((row) => ({
            ...row,
            album_image: `https://coverartarchive.org/release-group/${row.album_id}/front-250`,
            reasons: [],
        })),
    };
}

// People (not the user) who rated a positive album of the user >= 4 and also rated another MBID album >= 4.
export async function getCollaborativeCandidates(userId: number, positiveIds: string[], minPeople: number) {
    if (positiveIds.length === 0) return new Map<string, number>();
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT LOWER(r2.album_id) AS album_id, COUNT(DISTINCT r2.user_id) AS people
        FROM reviews r1
        JOIN reviews r2 ON r2.user_id = r1.user_id
        WHERE r1.album_id IN (?) AND r1.rating >= 4 AND r1.user_id <> ?
            AND r2.rating >= 4 AND r2.album_id NOT IN (?) AND r2.album_id REGEXP ?
        GROUP BY LOWER(r2.album_id)
        HAVING people >= ?
        ORDER BY people DESC, album_id
        LIMIT ?`,
        [positiveIds, userId, positiveIds, MBID_PATTERN, minPeople, COLLABORATIVE_LIMIT],
    );
    return new Map(rows.map((row) => [String(row.album_id), Number(row.people)]));
}

export async function getCommunityStats(userId: number, ids: string[]) {
    if (ids.length === 0) return new Map<string, CommunityStats>();
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT LOWER(album_id) AS album_id, COUNT(DISTINCT user_id) AS reviews, AVG(rating) AS average
        FROM reviews WHERE user_id <> ? AND album_id IN (?)
        GROUP BY LOWER(album_id)`, [userId, ids],
    );
    return new Map(rows.map((row) => [String(row.album_id), { reviews: Number(row.reviews), averageRating: Number(row.average) }]));
}

// Cold start: MBID albums rated >= 4 by at least 2 other people.
export async function getPopularCandidates(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT LOWER(album_id) AS album_id, COUNT(DISTINCT user_id) AS people
        FROM reviews
        WHERE rating >= 4 AND user_id <> ? AND album_id REGEXP ?
        GROUP BY LOWER(album_id)
        HAVING people >= 2
        ORDER BY people DESC, album_id
        LIMIT ?`, [userId, MBID_PATTERN, POPULAR_LIMIT],
    );
    const people = new Map(rows.map((row) => [String(row.album_id), Number(row.people)]));
    const catalog = await getCatalogAlbums([...people.keys()]);
    return catalog.map((candidate) => ({ candidate, people: people.get(candidate.albumId) ?? 0 }));
}

export async function addDismissal(userId: number, albumId: string) {
    const connection = await initDatabase();
    await connection.query("INSERT IGNORE INTO recommendation_dismissals (user_id, album_id) VALUES (?, ?)", [userId, albumId]);
}

export async function removeDismissal(userId: number, albumId: string) {
    const connection = await initDatabase();
    await connection.query("DELETE FROM recommendation_dismissals WHERE user_id = ? AND album_id = ?", [userId, albumId]);
}