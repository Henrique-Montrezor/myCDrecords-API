import { Pool } from "mysql2/promise";

// MySQL DDL commits implicitly; every step is additive and safe to repeat after interruption.
export async function migrateDiscoveryCatalog(connection: Pool) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS album_catalog (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            source ENUM('musicbrainz') NOT NULL,
            external_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            title VARCHAR(500) NOT NULL,
            artists JSON NOT NULL,
            release_date VARCHAR(10),
            release_type VARCHAR(32),
            tags JSON NOT NULL,
            source_url VARCHAR(255) NOT NULL,
            observed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            UNIQUE KEY catalog_source_identity (source, external_id)
        )
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS discovery_selection (
            id TINYINT PRIMARY KEY,
            revision INT UNSIGNED NOT NULL DEFAULT 0,
            updated_by INT NULL,
            updated_at TIMESTAMP(3) NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    await connection.query("INSERT IGNORE INTO discovery_selection (id, revision) VALUES (1, 0)");
    await connection.query(`
        CREATE TABLE IF NOT EXISTS discovery_selection_items (
            position TINYINT UNSIGNED PRIMARY KEY,
            catalog_id INT UNSIGNED NOT NULL UNIQUE,
            note VARCHAR(800) NOT NULL,
            FOREIGN KEY (catalog_id) REFERENCES album_catalog(id) ON DELETE RESTRICT
        )
    `);
}
