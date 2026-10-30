import { Pool } from "mysql2/promise";

export async function migrateListSaves(connection: Pool) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS list_saves (
            user_id INT NOT NULL,
            list_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, list_id),
            INDEX idx_list_saves_window (list_id, created_at, user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
        )
    `);
}
