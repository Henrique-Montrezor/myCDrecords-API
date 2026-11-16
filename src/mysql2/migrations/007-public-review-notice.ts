import { RowDataPacket } from "mysql2";
import { Pool } from "mysql2/promise";

export async function migratePublicReviewNotice(connection: Pick<Pool, "query">) {
    const columns = [
        ["public_review_notice_version", "VARCHAR(40) NULL"],
        ["public_review_notice_accepted_at", "DATETIME(3) NULL"],
    ] as const;
    for (const [column, definition] of columns) {
        const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?",
            [column],
        );
        if (rows.length === 0) await connection.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
}
