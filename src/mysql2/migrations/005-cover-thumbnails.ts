import { Pool } from "mysql2/promise";

// Stored Cover Art Archive URLs pointed at full-size originals (often several MB); keep the same cover, 500px thumbnail.
export async function migrateCoverThumbnails(connection: Pick<Pool, "query">) {
    for (const [table, keep] of [["reviews", ", updated_at = updated_at"], ["list_items", ""], ["profile_favorites", ""]]) {
        await connection.query(
            `UPDATE ${table} SET album_image = CONCAT(album_image, '-500')${keep}
            WHERE album_image LIKE 'https://coverartarchive.org/release-group/%/front'`,
        );
    }
}
