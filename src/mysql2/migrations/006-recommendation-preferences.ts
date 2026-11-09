import { Pool } from "mysql2/promise";

export async function migrateRecommendationPreferences(connection: Pick<Pool, "query">) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS recommendation_preferences (
            user_id INT NOT NULL PRIMARY KEY,
            genres JSON NOT NULL,
            artists JSON NOT NULL,
            updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
}