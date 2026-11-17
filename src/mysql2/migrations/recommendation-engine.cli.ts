import { RowDataPacket } from "mysql2";
import { getPool } from "../init.database";
import { migrateRecommendationEngine } from "./010-recommendation-engine";

async function main() {
    if (process.argv.length !== 2) throw new Error("INVALID_ARGUMENTS");
    const pool = getPool();
    try {
        await migrateRecommendationEngine(pool);
        await migrateRecommendationEngine(pool);
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT COLUMN_DEFAULT, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recommendation_preferences' AND COLUMN_NAME = 'ml_enabled'",
        );
        if (rows.length !== 1 || String(rows[0].COLUMN_DEFAULT) !== "0" || rows[0].IS_NULLABLE !== "NO") {
            throw new Error("INVALID_ENGINE_MIGRATION");
        }
        console.log(JSON.stringify({ status: "passed", check: "migration-010-idempotent-disabled-by-default", personalDataRead: false }));
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message) ? error.message : "ENGINE_MIGRATION_FAILED";
    console.error(JSON.stringify({ status: "failed", code }));
    process.exitCode = 1;
});
