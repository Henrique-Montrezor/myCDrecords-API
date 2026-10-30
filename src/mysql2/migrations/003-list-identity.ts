import { RowDataPacket } from "mysql2";
import { Pool } from "mysql2/promise";

export async function migrateListIdentity(connection: Pick<Pool, "query">) {
    for (const column of ["order_revision", "image_revision"]) {
        const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lists' AND COLUMN_NAME = ?", [column],
        );
        if (rows.length === 0) await connection.query(`ALTER TABLE lists ADD COLUMN ${column} INT UNSIGNED NOT NULL DEFAULT 0`);
    }
    await connection.query(`
        CREATE TABLE IF NOT EXISTS list_images (
            list_id INT NOT NULL,
            kind ENUM('thumbnail', 'banner') NOT NULL,
            content MEDIUMBLOB NOT NULL,
            PRIMARY KEY (list_id, kind),
            FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
        )
    `);
}
