import { createHash, createHmac, randomBytes } from "node:crypto";
import { RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { z } from "zod";
import { pilotNotice } from "./recommendations.pilot.collection";

const utc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const sequence = z.string().regex(/^[1-9]\d{0,19}$/).refine((value) => BigInt(value) <= 18446744073709551615n);
const rowSchema = z.object({
    sequence, user_id: z.number().int().positive(), album_id: z.string().uuid(),
    rating: z.number().int().min(1).max(5).nullable(),
    occurred_at: utc, observed_at: utc, expires_at: utc, available_at: utc,
}).strict();
export interface RealSnapshot {
    generation: string;
    capturedAt: string;
    rows: z.infer<typeof rowSchema>[];
}

function micros(value: string) {
    return BigInt(Date.parse(value.slice(0, 23) + "Z")) * 1000n + BigInt(value.slice(23, 26));
}

function iso(value: bigint) {
    return new Date(Number(value / 1000n)).toISOString().slice(0, 23) + String(value % 1000n).padStart(3, "0") + "Z";
}

export function buildRealExchange(snapshot: RealSnapshot) {
    sequence.parse(snapshot.generation);
    utc.parse(snapshot.capturedAt);
    const rows = z.array(rowSchema).max(5000).parse(snapshot.rows);
    if (!rows.length) throw new Error("NO_ELIGIBLE_EVENTS");
    const key = randomBytes(32);
    const token = (domain: string, value: string) => createHmac("sha256", key).update(`${domain}:${value}`).digest("hex");
    const observed = rows.map((row) => micros(row.observed_at));
    const first = observed.reduce((a, b) => a < b ? a : b);
    const last = observed.reduce((a, b) => a > b ? a : b);
    if (last - first < 3n) throw new Error("TEMPORAL_HISTORY_REQUIRED");
    const span = last - first;
    const cuts = [iso(first + span * 6n / 10n), iso(first + span * 8n / 10n), iso(last)];
    const albums = new Map<string, { id: string; available_at: string }>();
    for (const row of rows) {
        albums.set(row.album_id, { id: token("album", row.album_id), available_at: row.available_at });
    }
    return {
        schemaVersion: 2, mode: "real", origin: "mycdrecords-consented-ratings-v2",
        noticeVersion: pilotNotice.version, generation: snapshot.generation, captured_at: snapshot.capturedAt, cuts,
        albums: [...albums.values()],
        events: rows.map((row) => ({
            sequence: row.sequence, user_id: token("user", String(row.user_id)), album_id: token("album", row.album_id),
            rating: row.rating, occurred_at: row.occurred_at, observed_at: row.observed_at, expires_at: row.expires_at,
        })),
    };
}

export function verifyRealSnapshot(before: RealSnapshot, after: RealSnapshot) {
    const digest = (snapshot: RealSnapshot) => createHash("sha256").update(JSON.stringify(snapshot.rows)).digest("hex");
    if (before.generation !== after.generation || digest(before) !== digest(after)) {
        throw new Error("DATASET_INVALIDATED");
    }
}

export async function readRealSnapshot(connection: PoolConnection): Promise<RealSnapshot> {
    await connection.beginTransaction();
    try {
        const snapshot = await readRealSnapshotOnConnection(connection);
        await connection.commit();
        return snapshot;
    } catch (error) {
        await connection.rollback();
        throw error;
    }
}

export async function readRealSnapshotOnConnection(connection: Pick<PoolConnection, "query">): Promise<RealSnapshot> {
    const { lockPilotState } = await import("./recommendations.pilot.controls");
    const state = await lockPilotState(connection);
    if (state.closed) throw new Error("PILOT_CLOSED");
    const [notices] = await connection.query<RowDataPacket[]>(
        "SELECT notice_json FROM ml_pilot_notice_versions WHERE notice_version = ?", [pilotNotice.version],
    );
    if (notices[0]?.notice_json !== JSON.stringify(pilotNotice)) throw new Error("CURRENT_NOTICE_NOT_ARCHIVED");
    const [clock] = await connection.query<RowDataPacket[]>(
        "SELECT DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.%fZ') AS captured_at",
    );
    const capturedAt = utc.parse(clock[0]?.captured_at);
    const [raw] = await connection.query<RowDataPacket[]>(`
            SELECT CAST(e.sequence AS CHAR) AS sequence, e.user_id, e.album_id, e.rating,
                DATE_FORMAT(e.occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS occurred_at,
                DATE_FORMAT(e.observed_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS observed_at,
                DATE_FORMAT(e.expires_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS expires_at,
                DATE_FORMAT(GREATEST(a.first_available_at, a.verified_at), '%Y-%m-%dT%H:%i:%s.%fZ') AS available_at
            FROM ml_pilot_rating_events e
            JOIN ml_pilot_participants p ON p.user_id = e.user_id
            JOIN users u ON u.id = e.user_id AND u.is_active = TRUE
            JOIN ml_pilot_album_eligibility a ON a.album_id = e.album_id
            WHERE p.notice_version = ? AND p.accepted_at IS NOT NULL AND p.withdrawn_at IS NULL
              AND e.occurred_at >= p.accepted_at AND e.observed_at >= e.occurred_at
              AND e.expires_at > STR_TO_DATE(?, '%Y-%m-%dT%H:%i:%s.%fZ')
              AND e.observed_at <= STR_TO_DATE(?, '%Y-%m-%dT%H:%i:%s.%fZ')
              AND e.expires_at <= DATE_ADD(e.occurred_at, INTERVAL 30 DAY)
              AND a.source = 'musicbrainz-core' AND a.license = 'CC0-1.0' AND a.evidence_reference <> ''
              AND a.first_available_at <= e.occurred_at AND a.verified_at <= e.occurred_at
              AND EXISTS (
                  SELECT 1 FROM ml_pilot_consent_receipts r WHERE r.user_id = p.user_id
                    AND r.notice_version = p.notice_version AND r.accepted_at = p.accepted_at
                    AND r.withdrawn_at IS NULL
              )
            ORDER BY e.sequence LIMIT 5001
    `, [pilotNotice.version, capturedAt, capturedAt]);
    const rows = z.array(rowSchema).max(5000).parse(raw);
    return { generation: state.generation, capturedAt, rows };
}
