import { Pool } from "mysql2/promise";

export async function migrateRecommendationDismissals(connection: Pick<Pool, "query">) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS recommendation_dismissals (
            user_id INT NOT NULL,
            album_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (user_id, album_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
}
