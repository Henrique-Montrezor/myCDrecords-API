import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { initDatabase } from "../../mysql2/init.database";
import { CoreAlbum, ModelSignal } from "./recommendations.ml";

const artistsSchema = z.preprocess((value) => typeof value === "string" ? JSON.parse(value) : value,
    z.array(z.object({ name: z.string().min(1) })).min(1).transform((values) => values.map(({ name }) => name)));
const coreRow = z.object({
    source: z.literal("musicbrainz"), external_id: z.string().uuid().transform((id) => id.toLowerCase()),
    title: z.string().min(1), artists: artistsSchema, release_date: z.string().nullable(),
}).strict();

export async function getMLCatalog(artistNames: string[]): Promise<CoreAlbum[]> {
    if (artistNames.length === 0 || artistNames.length > 24) throw new Error("ML_INVALID_CATALOG_SCOPE");
    const connection = await initDatabase();
    const queries = artistNames.map(() => `(SELECT source, external_id, title, artists, release_date
        FROM album_catalog WHERE source = 'musicbrainz' AND release_type = 'Album'
        AND JSON_CONTAINS(artists, JSON_OBJECT('name', ?))
        ORDER BY external_id LIMIT 20)`);
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT DISTINCT * FROM (${queries.join(" UNION ALL ")}) model_catalog ORDER BY external_id`, artistNames);
    return rows.map((row) => {
        const value = coreRow.parse(row);
        return { source: value.source, albumId: value.external_id, title: value.title, artists: value.artists, releaseDate: value.release_date ?? "" };
    });
}

export async function getMLTaste(userId: number) {
    const connection = await initDatabase();
    const [[reviews], [favorites], [dismissed], [preferences]] = await Promise.all([
        connection.query<RowDataPacket[]>(`SELECT LOWER(c.external_id) AS album_id, c.artists, r.rating
            FROM reviews r JOIN album_catalog c ON c.external_id = r.album_id AND c.source = 'musicbrainz'
            WHERE r.user_id = ?`, [userId]),
        connection.query<RowDataPacket[]>(`SELECT LOWER(c.external_id) AS album_id, c.artists
            FROM profile_favorites f JOIN album_catalog c ON c.external_id = f.album_id AND c.source = 'musicbrainz'
            WHERE f.user_id = ?`, [userId]),
        connection.query<RowDataPacket[]>(`SELECT LOWER(c.external_id) AS album_id
            FROM recommendation_dismissals d JOIN album_catalog c ON c.external_id = d.album_id AND c.source = 'musicbrainz'
            WHERE d.user_id = ?`, [userId]),
        connection.query<RowDataPacket[]>("SELECT artists FROM recommendation_preferences WHERE user_id = ?", [userId]),
    ]);
    const ratings = new Map<string, { artists: string[]; rating: number }>();
    for (const row of reviews) ratings.set(z.string().uuid().parse(row.album_id), {
        artists: artistsSchema.parse(row.artists), rating: z.coerce.number().int().min(1).max(5).parse(row.rating),
    });
    // Explicit ratings take precedence over a favorite, including a neutral/negative rating.
    for (const row of favorites) {
        const id = z.string().uuid().parse(row.album_id);
        if (!ratings.has(id)) ratings.set(id, { artists: artistsSchema.parse(row.artists), rating: 5 });
    }
    const signals: ModelSignal[] = [...ratings.values()].flatMap(({ artists, rating }) =>
        artists.map((artist) => ({ artist, weight: (rating - 3) / (2 * artists.length) })));
    if (preferences[0]) {
        const values: unknown = typeof preferences[0].artists === "string" ? JSON.parse(preferences[0].artists) : preferences[0].artists;
        signals.push(...z.array(z.string().min(1).max(120)).max(20).parse(values).map((artist) => ({ artist, weight: 1 })));
    }
    return {
        signals,
        excluded: new Set([...ratings.keys(), ...dismissed.map((row) => z.string().uuid().parse(row.album_id))]),
    };
}
