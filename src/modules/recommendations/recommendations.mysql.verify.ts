import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "mysql2/promise";
import { RowDataPacket } from "mysql2";
import { migrateMlPilotControls } from "../../mysql2/migrations/008-ml-pilot-controls";
import { migrateMlPilotCollection } from "../../mysql2/migrations/009-ml-pilot-collection";
import {
    lockPilotState, purgeExpiredPilotEventsOnConnection, recordPilotRatingEvent, withdrawPilotParticipant,
} from "./recommendations.pilot.controls";
import { markPilotRetentionHealthy, markPilotStorageReady, pilotNotice } from "./recommendations.pilot.collection";
import { readRealSnapshotOnConnection } from "./recommendations.real";

export async function verifyPilotMysql(pool: Pool) {
    if (Number(process.env.MYSQL_CONNECTION_LIMIT) === 1) throw new Error("HOMOLOGATION_REQUIRES_TWO_CONNECTIONS");
    const schema = `mycdrecords_ml_tests_${randomUUID().replace(/-/g, "")}`;
    const connection = await pool.getConnection();
    const previousEnv = { ...process.env };
    const checks: string[] = [];
    try {
        await connection.query("CREATE DATABASE ??", [schema]);
        await connection.query("USE ??", [schema]);
        await connection.query("CREATE TABLE users (id INT NOT NULL PRIMARY KEY, is_active BOOLEAN NOT NULL) ENGINE=InnoDB");
        await migrateMlPilotControls(connection);
        await migrateMlPilotCollection(connection);
        await migrateMlPilotControls(connection);
        await migrateMlPilotCollection(connection);
        checks.push("migrations-008-009-idempotent");

        process.env.ML_PILOT_COLLECTION_ENABLED = "true";
        process.env.ML_PILOT_NOTICE_APPROVED_VERSION = pilotNotice.version;
        process.env.ML_PILOT_DURABLE_RETENTION_CONFIRMED = "true";
        markPilotStorageReady(true);
        markPilotRetentionHealthy(true);
        await connection.beginTransaction();
        await connection.query("UPDATE ml_pilot_state SET generation = 9007199254740993 WHERE singleton_id = 1");
        assert.equal((await lockPilotState(connection)).generation, "9007199254740993", "BIGINT_PRECISION_FAILED");
        checks.push("generation-above-js-safe-integer");

        const contender = await pool.getConnection();
        try {
            await contender.query("USE ??", [schema]);
            await contender.query("SET SESSION innodb_lock_wait_timeout = 1");
            await contender.beginTransaction();
            await assert.rejects(
                contender.query("SELECT generation FROM ml_pilot_state WHERE singleton_id = 1 FOR UPDATE"),
                { code: "ER_LOCK_WAIT_TIMEOUT" },
            );
            checks.push("cross-connection-state-lock");
        } finally {
            contender.destroy();
        }

        await connection.query("INSERT INTO users (id, is_active) VALUES (1, TRUE)");
        await connection.query(`
            INSERT INTO ml_pilot_participants (user_id, notice_version, accepted_at)
            VALUES (1, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 MINUTE))
        `, [pilotNotice.version]);
        const album = "00000000-0000-4000-8000-000000000001";
        await connection.query(`
            INSERT INTO ml_pilot_album_eligibility
                (album_id, source, license, evidence_reference, first_available_at, verified_at)
            VALUES (?, 'musicbrainz-core', 'CC0-1.0', 'isolated-synthetic-test-only',
                DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 DAY), DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 HOUR))
        `, [album]);
        const event = { mutationId: randomUUID(), userId: 1, albumId: album, rating: 5 };
        assert.deepEqual(await recordPilotRatingEvent(connection, event), { captured: false, reason: "not_participating" });
        checks.push("no-capture-without-receipt");
        await connection.query(`
            INSERT INTO ml_pilot_consent_receipts (user_id, notice_version, accepted_at)
            SELECT user_id, notice_version, accepted_at FROM ml_pilot_participants WHERE user_id = 1
        `);
        await connection.query("SAVEPOINT before_capture");
        assert.deepEqual(await recordPilotRatingEvent(connection, event), { captured: true, reason: "recorded" });
        await connection.query("ROLLBACK TO SAVEPOINT before_capture");
        const [rolledBack] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM ml_pilot_rating_events");
        assert.equal(rolledBack[0].count, 0, "ROLLBACK_FAILED");
        checks.push("capture-rolls-back");
        assert.deepEqual(await recordPilotRatingEvent(connection, event), { captured: true, reason: "recorded" });
        assert.deepEqual(await recordPilotRatingEvent(connection, event), { captured: false, reason: "duplicate" });
        await assert.rejects(recordPilotRatingEvent(connection, { ...event, rating: 1 }), { status: 409 });
        checks.push("capture-deduplication-and-conflict");

        assert.equal((await readRealSnapshotOnConnection(connection)).rows.length, 1, "ELIGIBLE_EXPORT_FAILED");
        await connection.query("UPDATE ml_pilot_participants SET notice_version = 'ml-pilot-v1'");
        assert.equal((await readRealSnapshotOnConnection(connection)).rows.length, 0, "LEGACY_CONSENT_EXPORTED");
        await connection.query("UPDATE ml_pilot_participants SET notice_version = ?", [pilotNotice.version]);
        checks.push("real-export-requires-current-matching-receipt");

        await connection.query("UPDATE ml_pilot_rating_events SET occurred_at = '2026-01-01 00:00:00.123456'");
        const [precision] = await connection.query<RowDataPacket[]>(
            "SELECT DATE_FORMAT(occurred_at, '%f') AS fraction FROM ml_pilot_rating_events",
        );
        assert.equal(precision[0].fraction, "123456", "MICROSECOND_PRECISION_FAILED");
        checks.push("datetime-six-microseconds");
        await assert.rejects(connection.query(`
            INSERT INTO ml_pilot_rating_events
                (mutation_id, user_id, album_id, rating, occurred_at, observed_at, expires_at)
            VALUES (?, 1, ?, 6, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY))
        `, [randomUUID(), album]), (error: unknown) =>
            error instanceof Error && "errno" in error && (error.errno === 3819 || error.errno === 4025));
        checks.push("rating-check-enforced-by-mysql");
        await assert.rejects(connection.query(`
            INSERT INTO ml_pilot_rating_events
                (mutation_id, user_id, album_id, rating, occurred_at, observed_at, expires_at)
            VALUES (?, 999, ?, 5, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY))
        `, [randomUUID(), album]), { code: "ER_NO_REFERENCED_ROW_2" });
        checks.push("participant-foreign-key");
        await connection.query(`
            INSERT INTO ml_pilot_rating_events
                (mutation_id, user_id, album_id, rating, occurred_at, observed_at, expires_at)
            VALUES (?, 1, ?, 5, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 31 DAY),
                DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 31 DAY), DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 DAY))
        `, [randomUUID(), album]);
        assert.equal((await purgeExpiredPilotEventsOnConnection(connection)).purgedEvents, 1, "EVENT_EXPIRY_FAILED");
        checks.push("expired-events-purge");
        await withdrawPilotParticipant(connection, 1);
        const [withdrawn] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM ml_pilot_rating_events");
        assert.equal(withdrawn[0].count, 0, "WITHDRAWAL_DID_NOT_ERASE_EVENTS");
        assert.equal((await lockPilotState(connection)).generation, "9007199254740995", "INVALIDATION_FAILED");
        checks.push("withdrawal-erasure-and-generation");

        await connection.query(`
            UPDATE ml_pilot_participants SET withdrawn_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 31 DAY)
        `);
        await connection.query(`
            UPDATE ml_pilot_consent_receipts SET withdrawn_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 31 DAY)
        `);
        const purged = await purgeExpiredPilotEventsOnConnection(connection);
        assert.equal(purged.purgedReceipts, 1, "RECEIPT_RETENTION_FAILED");
        checks.push("expired-receipts-purge");
        await connection.rollback();
        const [remaining] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM users");
        assert.equal(remaining[0].count, 0, "TEST_DATA_ROLLBACK_FAILED");
        checks.push("all-fixtures-rolled-back");
        return { status: "passed", mode: "mysql-homologation", schema, checks, applicationDataModified: false };
    } finally {
        process.env = previousEnv;
        markPilotStorageReady(false);
        markPilotRetentionHealthy(false);
        try {
            await connection.rollback();
        } finally {
            // Never return a connection whose default schema was changed to the application pool.
            connection.destroy();
        }
    }
}
