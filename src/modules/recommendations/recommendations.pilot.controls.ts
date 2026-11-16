import { RowDataPacket, ResultSetHeader } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { withTransaction } from "../../utils/withTransaction";
import { hasPilotStorage, inspectPilotCollection, pilotNotice } from "./recommendations.pilot.collection";

const actorSchema = z.number().int().positive();
const enrollmentSchema = z.object({
    accepted: z.literal(true),
    noticeVersion: z.literal(pilotNotice.version),
}).strict();
const eventSchema = z.object({
    mutationId: z.string().uuid().transform((id) => id.toLowerCase()),
    userId: actorSchema,
    albumId: z.string().uuid().transform((id) => id.toLowerCase()),
    rating: z.number().int().min(1).max(5).nullable(),
}).strict();
type Connection = Pick<PoolConnection, "query">;
interface Participant extends RowDataPacket {
    accepted_at: Date | null;
    withdrawn_at: Date | null;
    notice_version: string | null;
    consent_recorded: number;
}
interface StoredEvent extends RowDataPacket {
    user_id: number;
    album_id: string;
    rating: number | null;
}
type CaptureResult = { captured: boolean; reason: "recorded" | "duplicate" | "pilot_disabled" | "pilot_closed" | "not_participating" | "album_not_eligible" };

function failure(status: number, message: string) {
    return Object.assign(new Error(message), { status });
}

function requireAvailable() {
    if (!inspectPilotCollection().collectionAllowed) {
        throw failure(503, "A coleta do piloto de ML está desativada ou indisponível.");
    }
}

export async function lockPilotState(connection: Connection) {
    const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT CAST(generation AS CHAR) AS generation, closed_at FROM ml_pilot_state WHERE singleton_id = 1 FOR UPDATE",
    );
    const generation = rows[0]?.generation;
    if (typeof generation !== "string" || !/^[1-9]\d*$/.test(generation)) {
        throw failure(503, "Estado do piloto de ML ausente ou inválido.");
    }
    return { generation, closed: rows[0].closed_at != null };
}

async function lockGeneration(connection: Connection) {
    return (await lockPilotState(connection)).generation;
}

export async function invalidatePilotGeneration(connection: Connection) {
    const [result] = await connection.query<ResultSetHeader>(
        "UPDATE ml_pilot_state SET generation = generation + 1 WHERE singleton_id = 1",
    );
    if (result.affectedRows !== 1) throw failure(503, "Não foi possível invalidar os derivados do piloto.");
}

async function participantFor(connection: Connection, userId: number) {
    const [rows] = await connection.query<Participant[]>(`
        SELECT p.accepted_at, p.withdrawn_at, p.notice_version,
            EXISTS (
                SELECT 1 FROM ml_pilot_consent_receipts r
                WHERE r.user_id = p.user_id AND r.notice_version = p.notice_version
                  AND r.accepted_at = p.accepted_at AND r.withdrawn_at IS NULL
            ) AS consent_recorded
        FROM ml_pilot_participants p
        WHERE p.user_id = ? AND EXISTS (
            SELECT 1 FROM users u WHERE u.id = p.user_id AND u.is_active = TRUE
        ) FOR UPDATE
    `, [userId]);
    return rows[0];
}

function participates(participant: Participant | undefined) {
    return Boolean(participant?.accepted_at && participant.withdrawn_at === null
        && participant.notice_version === pilotNotice.version && participant.consent_recorded === 1);
}

export async function getPilotParticipation(actor: number) {
    const userId = actorSchema.parse(actor);
    requireAvailable();
    return withTransaction(async (connection) => {
        const state = await lockPilotState(connection);
        const participant = await participantFor(connection, userId);
        return { invited: Boolean(participant), participating: !state.closed && participates(participant), closed: state.closed, noticeVersion: participant?.notice_version ?? null };
    });
}

export async function enrollInPilot(actor: number, input: unknown) {
    const userId = actorSchema.parse(actor);
    const notice = enrollmentSchema.parse(input);
    requireAvailable();
    return withTransaction(async (connection) => {
        if ((await lockPilotState(connection)).closed) throw failure(503, "Este piloto foi encerrado.");
        const participant = await participantFor(connection, userId);
        if (!participant) throw failure(403, "Este piloto é restrito a participantes internos convidados.");
        if (!participates(participant)) {
            await connection.query(`
                UPDATE ml_pilot_consent_receipts SET withdrawn_at = UTC_TIMESTAMP(6)
                WHERE user_id = ? AND withdrawn_at IS NULL
            `, [userId]);
            const [deleted] = await connection.query<ResultSetHeader>(
                "DELETE FROM ml_pilot_rating_events WHERE user_id = ?", [userId],
            );
            if (deleted.affectedRows > 0) await invalidatePilotGeneration(connection);
            await connection.query(`
                UPDATE ml_pilot_participants
                SET notice_version = ?, accepted_at = UTC_TIMESTAMP(6), withdrawn_at = NULL
                WHERE user_id = ?
            `, [notice.noticeVersion, userId]);
            const [receipt] = await connection.query<ResultSetHeader>(`
                INSERT INTO ml_pilot_consent_receipts (user_id, notice_version, accepted_at)
                SELECT user_id, notice_version, accepted_at FROM ml_pilot_participants WHERE user_id = ?
            `, [userId]);
            if (receipt.affectedRows !== 1) throw failure(503, "Não foi possível registrar o comprovante de adesão.");
        }
        return { participating: true, noticeVersion: notice.noticeVersion };
    });
}

export async function withdrawFromPilot(actor: number) {
    const userId = actorSchema.parse(actor);
    // Withdrawal remains available after collection has been disabled.
    return withTransaction((connection) => withdrawPilotParticipant(connection, userId));
}

export async function withdrawPilotParticipant(connection: Connection, userId: number) {
    await lockGeneration(connection);
    const [deleted] = await connection.query<ResultSetHeader>(
        "DELETE FROM ml_pilot_rating_events WHERE user_id = ?", [userId],
    );
    const [updated] = await connection.query<ResultSetHeader>(`
        UPDATE ml_pilot_participants SET withdrawn_at = UTC_TIMESTAMP(6)
        WHERE user_id = ? AND withdrawn_at IS NULL
    `, [userId]);
    const [receipts] = await connection.query<ResultSetHeader>(`
        UPDATE ml_pilot_consent_receipts SET withdrawn_at = UTC_TIMESTAMP(6)
        WHERE user_id = ? AND withdrawn_at IS NULL
    `, [userId]);
    if (deleted.affectedRows > 0 || updated.affectedRows > 0 || receipts.affectedRows > 0) {
        await invalidatePilotGeneration(connection);
    }
    return { participating: false };
}

// The caller acquires the global pilot lock before writing the rating on this transaction.
export async function recordPilotRatingEvent(connection: Connection, input: unknown): Promise<CaptureResult> {
    const event = eventSchema.parse(input);
    if (!inspectPilotCollection().collectionAllowed) return { captured: false, reason: "pilot_disabled" };
    if ((await lockPilotState(connection)).closed) return { captured: false, reason: "pilot_closed" };
    if (!participates(await participantFor(connection, event.userId))) return { captured: false, reason: "not_participating" };
    const [albums] = await connection.query<RowDataPacket[]>(`
        SELECT album_id FROM ml_pilot_album_eligibility
        WHERE album_id = ? AND source = 'musicbrainz-core' AND license = 'CC0-1.0'
          AND evidence_reference <> '' AND first_available_at <= UTC_TIMESTAMP(6)
          AND verified_at <= UTC_TIMESTAMP(6) FOR UPDATE
    `, [event.albumId]);
    if (!albums[0]) return { captured: false, reason: "album_not_eligible" };
    const [previous] = await connection.query<StoredEvent[]>(`
        SELECT user_id, album_id, rating FROM ml_pilot_rating_events WHERE mutation_id = ? FOR UPDATE
    `, [event.mutationId]);
    if (previous[0]) {
        if (previous[0].user_id !== event.userId || previous[0].album_id !== event.albumId || previous[0].rating !== event.rating) {
            throw failure(409, "A identidade desta mutação já foi utilizada com outro conteúdo.");
        }
        return { captured: false, reason: "duplicate" };
    }
    await connection.query(`
        INSERT INTO ml_pilot_rating_events (mutation_id, user_id, album_id, rating, occurred_at, observed_at, expires_at)
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY))
    `, [event.mutationId, event.userId, event.albumId, event.rating]);
    return { captured: true, reason: "recorded" };
}

export async function purgeExpiredPilotEvents() {
    return withTransaction(purgeExpiredPilotEventsOnConnection);
}

export async function purgeExpiredPilotEventsOnConnection(connection: Connection) {
    await lockGeneration(connection);
    const [result] = await connection.query<ResultSetHeader>(
        "DELETE FROM ml_pilot_rating_events WHERE expires_at <= UTC_TIMESTAMP(6)",
    );
    const [receipts] = await connection.query<ResultSetHeader>(`
        DELETE FROM ml_pilot_consent_receipts
        WHERE withdrawn_at <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 30 DAY)
    `);
    const [participants] = await connection.query<ResultSetHeader>(`
        DELETE FROM ml_pilot_participants
        WHERE withdrawn_at <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 30 DAY)
    `);
    if (result.affectedRows > 0 || receipts.affectedRows > 0 || participants.affectedRows > 0) {
        await invalidatePilotGeneration(connection);
    }
    return { purgedEvents: result.affectedRows, purgedReceipts: receipts.affectedRows };
}

// A future publisher must hold this lock through activation of its artifact.
export async function assertPilotGeneration(connection: Connection, expected: string) {
    z.string().regex(/^[1-9]\d*$/).parse(expected);
    if (await lockGeneration(connection) !== expected) {
        throw failure(409, "O dataset foi invalidado. Refaça a exportação e o treinamento.");
    }
}

export async function lockPilotForMutation(connection: Connection) {
    const state = inspectPilotCollection();
    if (state.configured && !hasPilotStorage()) throw failure(503, "Armazenamento do piloto ainda não está pronto.");
    if (hasPilotStorage()) await lockGeneration(connection);
}

export async function capturePilotReviewMutation(connection: Connection, kind: "create" | "update", userId: number, albumId: string, rating: number) {
    if (!inspectPilotCollection().collectionAllowed) {
        if (kind === "update") await erasePilotAlbumEvents(connection, userId, albumId);
        return { captured: false, reason: "pilot_disabled" };
    }
    const parsedAlbum = z.string().uuid().safeParse(albumId);
    if (!parsedAlbum.success) return { captured: false, reason: "album_not_eligible" };
    const canonicalAlbumId = parsedAlbum.data.toLowerCase();
    if (kind === "update") {
        const [tracked] = await connection.query<RowDataPacket[]>(`
            SELECT e.mutation_id FROM ml_pilot_rating_events e
            JOIN ml_pilot_participants p ON p.user_id = e.user_id
            WHERE e.user_id = ? AND e.album_id = ? AND e.rating IS NOT NULL
              AND e.occurred_at >= p.accepted_at AND e.expires_at > UTC_TIMESTAMP(6)
            LIMIT 1 FOR UPDATE
        `, [userId, canonicalAlbumId]);
        if (!tracked[0]) return { captured: false, reason: "not_prospective" };
    }
    const result = await recordPilotRatingEvent(connection, { mutationId: randomUUID(), userId, albumId: canonicalAlbumId, rating });
    if (kind === "update" && !result.captured && result.reason !== "duplicate") {
        await erasePilotAlbumEvents(connection, userId, albumId);
    }
    return result;
}

export async function erasePilotAlbumEvents(connection: Connection, userId: number, albumId: string) {
    if (!hasPilotStorage()) return;
    const parsedAlbum = z.string().uuid().safeParse(albumId);
    if (!parsedAlbum.success) return;
    const [result] = await connection.query<ResultSetHeader>(
        "DELETE FROM ml_pilot_rating_events WHERE user_id = ? AND album_id = ?", [userId, parsedAlbum.data.toLowerCase()],
    );
    if (result.affectedRows > 0) await invalidatePilotGeneration(connection);
}
