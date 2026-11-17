import { RowDataPacket } from "mysql2";
import { Pool } from "mysql2/promise";

export async function migrateRecommendationEngine(connection: Pick<Pool, "query">) {
    const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recommendation_preferences' AND COLUMN_NAME = 'ml_enabled'",
    );
    if (rows.length === 0) {
        await connection.query("ALTER TABLE recommendation_preferences ADD COLUMN ml_enabled TINYINT(1) NOT NULL DEFAULT 0");
    }
}
