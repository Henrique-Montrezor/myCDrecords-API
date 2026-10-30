import { RowDataPacket, ResultSetHeader } from "mysql2";
import { z } from "zod";
import { initDatabase } from "../../mysql2/init.database";
import { withTransaction } from "../../utils/withTransaction";
import { CatalogAlbum, catalogAlbumCard, EditorialSelectionInput } from "./album.catalog";

export async function saveCatalogAlbums(albums: CatalogAlbum[]) {
    if (albums.length === 0) return;
    const connection = await initDatabase();
    const values = albums.map((album) => {
        const card = catalogAlbumCard(album);
        return [
            card.source, card.id, card.title, JSON.stringify(card.artistCredit),
            card.releaseDate || null, card.type || null, JSON.stringify(card.tags),
            `https://musicbrainz.org/release-group/${card.id}`,
        ];
    });
    await connection.query<ResultSetHeader>(`
        INSERT INTO album_catalog (source, external_id, title, artists, release_date, release_type, tags, source_url)
        VALUES ?
        ON DUPLICATE KEY UPDATE title = VALUES(title), artists = VALUES(artists),
            release_date = VALUES(release_date), release_type = VALUES(release_type),
            tags = VALUES(tags), source_url = VALUES(source_url), observed_at = CURRENT_TIMESTAMP(3)
    `, [values]);
}

const artistsSchema = z.preprocess(
    (value) => typeof value === "string" ? JSON.parse(value) : value,
    z.array(z.object({ name: z.string() })),
);
const selectionRowSchema = z.object({
    revision: z.number().int().nonnegative(),
    updated_at: z.coerce.date().nullable(),
    curator: z.string().nullable(),
    external_id: z.string().uuid().nullable(),
    title: z.string().nullable(),
    artists: artistsSchema.nullable(),
    release_date: z.string().nullable(),
    note: z.string().nullable(),
});

export async function getEditorialSelection() {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(`
        SELECT s.revision, s.updated_at, u.username AS curator,
            c.external_id, c.title, c.artists, c.release_date, i.note
        FROM discovery_selection s
        LEFT JOIN users u ON u.id = s.updated_by
        LEFT JOIN discovery_selection_items i ON TRUE
        LEFT JOIN album_catalog c ON c.id = i.catalog_id AND c.source = 'musicbrainz'
        WHERE s.id = 1
        ORDER BY i.position ASC
    `);
    if (rows.length === 0) throw new Error("Discovery schema not initialized");
    const entries = rows.map((row) => selectionRowSchema.parse(row));
    const meta = entries[0];
    return {
        sectionId: "editorial" as const,
        kind: "editorial" as const,
        title: "Escolhas da curadoria",
        source: "mycdrecords" as const,
        revision: meta.revision,
        updatedAt: meta.updated_at?.toISOString() ?? null,
        curator: meta.curator,
        items: entries.filter((entry) => entry.external_id !== null).map((entry) => {
            if (!entry.external_id || !entry.title || !entry.artists || !entry.note) throw new Error("Invalid editorial catalog entry");
            return {
                album: {
                    id: entry.external_id, source: "musicbrainz" as const,
                    title: entry.title, artistCredit: entry.artists,
                    releaseDate: entry.release_date ?? "",
                    imageUrl: `https://coverartarchive.org/release-group/${entry.external_id}/front-500`,
                },
                note: entry.note,
            };
        }),
    };
}

export async function publishEditorialSelection(userId: number, input: EditorialSelectionInput) {
    return withTransaction(async (connection) => {
        const [updated] = await connection.query<ResultSetHeader>(`
            UPDATE discovery_selection
            SET revision = revision + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = 1 AND revision = ?
        `, [userId, input.revision]);
        if (updated.affectedRows !== 1) {
            throw Object.assign(new Error("Seleção alterada. Recarregue antes de publicar."), { status: 409 });
        }

        const ids = input.items.map((item) => item.albumId);
        const catalog = new Map<string, number>();
        if (ids.length > 0) {
            const [rows] = await connection.query<(RowDataPacket & { id: number; external_id: string })[]>(
                "SELECT id, external_id FROM album_catalog WHERE source = 'musicbrainz' AND external_id IN (?)", [ids],
            );
            for (const row of rows) catalog.set(row.external_id, row.id);
            if (catalog.size !== ids.length) {
                throw Object.assign(new Error("Um álbum não está no catálogo. Consulte-o antes de publicar."), { status: 404 });
            }
        }

        await connection.query("DELETE FROM discovery_selection_items");
        if (input.items.length > 0) {
            const values = input.items.map((item, index) => {
                const catalogId = catalog.get(item.albumId);
                if (catalogId === undefined) throw new Error("Missing validated catalog ID");
                return [index + 1, catalogId, item.note];
            });
            await connection.query("INSERT INTO discovery_selection_items (position, catalog_id, note) VALUES ?", [values]);
        }
        return input.revision + 1;
    });
}
