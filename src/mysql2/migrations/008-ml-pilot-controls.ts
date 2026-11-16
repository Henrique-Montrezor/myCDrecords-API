import { Pool } from "mysql2/promise";

export async function migrateMlPilotControls(connection: Pick<Pool, "query">) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ml_pilot_state (
            singleton_id TINYINT NOT NULL PRIMARY KEY,
            generation BIGINT UNSIGNED NOT NULL,
            CHECK (singleton_id = 1)
        ) ENGINE=InnoDB
    `);
    await connection.query(`
        INSERT INTO ml_pilot_state (singleton_id, generation) VALUES (1, 1)
        ON DUPLICATE KEY UPDATE singleton_id = singleton_id
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ml_pilot_participants (
            user_id INT NOT NULL PRIMARY KEY,
            invited_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            notice_version VARCHAR(80) NULL,
            accepted_at DATETIME(6) NULL,
            withdrawn_at DATETIME(6) NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ml_pilot_album_eligibility (
            album_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
            source ENUM('musicbrainz-core') NOT NULL,
            license ENUM('CC0-1.0') NOT NULL,
            evidence_reference VARCHAR(1000) NOT NULL,
            first_available_at DATETIME(6) NOT NULL,
            verified_at DATETIME(6) NOT NULL
        ) ENGINE=InnoDB
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ml_pilot_rating_events (
            sequence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            mutation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
            user_id INT NOT NULL,
            album_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            rating TINYINT UNSIGNED NULL,
            occurred_at DATETIME(6) NOT NULL,
            observed_at DATETIME(6) NOT NULL,
            expires_at DATETIME(6) NOT NULL,
            INDEX idx_ml_pilot_expiry (expires_at),
            INDEX idx_ml_pilot_user_album (user_id, album_id, sequence),
            CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
            FOREIGN KEY (user_id) REFERENCES ml_pilot_participants(user_id) ON DELETE CASCADE,
            FOREIGN KEY (album_id) REFERENCES ml_pilot_album_eligibility(album_id)
        ) ENGINE=InnoDB
    `);
}
