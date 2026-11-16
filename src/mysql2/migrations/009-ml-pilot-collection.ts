import { RowDataPacket } from "mysql2";
import { Pool } from "mysql2/promise";
import { pilotNotice } from "../../modules/recommendations/recommendations.pilot.collection";

export async function migrateMlPilotCollection(connection: Pick<Pool, "query">) {
    const [columns] = await connection.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ml_pilot_state' AND COLUMN_NAME = 'closed_at'
    `);
    if (columns.length === 0) {
        await connection.query("ALTER TABLE ml_pilot_state ADD COLUMN closed_at DATETIME(6) NULL");
    }
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ml_pilot_notice_versions (
            notice_version VARCHAR(80) NOT NULL PRIMARY KEY,
            notice_json TEXT NOT NULL,
            archived_at DATETIME(6) NOT NULL
        ) ENGINE=InnoDB
    `);
    const notice = JSON.stringify(pilotNotice);
    await connection.query(`
        INSERT INTO ml_pilot_notice_versions (notice_version, notice_json, archived_at)
        VALUES (?, ?, UTC_TIMESTAMP(6))
        ON DUPLICATE KEY UPDATE notice_version = notice_version
    `, [pilotNotice.version, notice]);
    const [notices] = await connection.query<RowDataPacket[]>(
        "SELECT notice_json FROM ml_pilot_notice_versions WHERE notice_version = ?", [pilotNotice.version],
    );
    if (notices[0]?.notice_json !== notice) {
        throw new Error("O aviso ML arquivado difere do texto publicado. Preserve o texto antigo e publique uma nova versão.");
    }
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ml_pilot_consent_receipts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            notice_version VARCHAR(80) NOT NULL,
            accepted_at DATETIME(6) NOT NULL,
            withdrawn_at DATETIME(6) NULL,
            INDEX idx_ml_pilot_receipt_expiry (withdrawn_at),
            INDEX idx_ml_pilot_receipt_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    `);
}
