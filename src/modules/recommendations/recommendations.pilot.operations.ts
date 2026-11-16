import { ResultSetHeader, RowDataPacket } from "mysql2";
import { withTransaction } from "../../utils/withTransaction";
import { inspectPilotCollection } from "./recommendations.pilot.collection";
import { invalidatePilotGeneration, lockPilotState, purgeExpiredPilotEvents } from "./recommendations.pilot.controls";
import { pilotOperationSchema } from "./recommendations.pilot.manage.cli";

export async function applyPilotOperation(input: unknown) {
    const operation = pilotOperationSchema.parse(input);
    if (operation.action === "purge") return purgeExpiredPilotEvents();
    if (operation.action === "invite" || operation.action === "album") {
        const config = inspectPilotCollection();
        if (!config.configured || config.blockers.includes("PUBLIC_NOTICE_APPROVAL_PENDING")) {
            throw new Error("Ative a configuração local e confirme a versão do aviso público antes de preparar o piloto.");
        }
    }
    return withTransaction(async (connection) => {
        const state = await lockPilotState(connection);
        if (operation.action === "close") {
            if (state.closed) return { closed: true };
            await connection.query("DELETE FROM ml_pilot_rating_events");
            await connection.query("DELETE FROM ml_pilot_participants WHERE accepted_at IS NULL");
            await connection.query(`
                UPDATE ml_pilot_participants SET withdrawn_at = UTC_TIMESTAMP(6) WHERE withdrawn_at IS NULL
            `);
            await connection.query(`
                UPDATE ml_pilot_consent_receipts SET withdrawn_at = UTC_TIMESTAMP(6) WHERE withdrawn_at IS NULL
            `);
            await connection.query("UPDATE ml_pilot_state SET closed_at = UTC_TIMESTAMP(6) WHERE singleton_id = 1");
            await invalidatePilotGeneration(connection);
            return { closed: true };
        }
        if (operation.action === "invite") {
            if (state.closed) throw new Error("Este piloto foi encerrado.");
            const userId = operation["user-id"];
            const [users] = await connection.query<RowDataPacket[]>(
                "SELECT id FROM users WHERE id = ? AND is_active = TRUE FOR UPDATE", [userId],
            );
            if (!users[0]) throw new Error("Conta ativa não encontrada para o convite.");
            await connection.query(`
                INSERT INTO ml_pilot_participants (user_id) VALUES (?)
                ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)
            `, [userId]);
            return { invited: true };
        }
        const albumId = operation["album-id"];
        if (operation.action === "revoke-album") {
            await connection.query("DELETE FROM ml_pilot_rating_events WHERE album_id = ?", [albumId]);
            await connection.query("DELETE FROM ml_pilot_album_eligibility WHERE album_id = ?", [albumId]);
            await invalidatePilotGeneration(connection);
            return { revoked: true };
        }
        if (state.closed) throw new Error("Este piloto foi encerrado.");
        const [existing] = await connection.query<RowDataPacket[]>(
            "SELECT album_id FROM ml_pilot_album_eligibility WHERE album_id = ? FOR UPDATE", [albumId],
        );
        if (existing[0]) {
            throw new Error("Elegibilidade já cadastrada. Correções exigem revogação explícita antes de novo cadastro.");
        }
        const availableAt = new Date(operation["first-available-at"]).toISOString().slice(0, 23).replace("T", " ");
        const [result] = await connection.query<ResultSetHeader>(`
            INSERT INTO ml_pilot_album_eligibility (album_id, source, license, evidence_reference, first_available_at, verified_at)
            SELECT ?, 'musicbrainz-core', 'CC0-1.0', ?, ?, UTC_TIMESTAMP(6) WHERE ? <= UTC_TIMESTAMP(6)
        `, [albumId, operation.evidence, availableAt, availableAt]);
        if (result.affectedRows === 0) throw new Error("A disponibilidade do álbum não pode estar no futuro.");
        await invalidatePilotGeneration(connection);
        return { eligible: true };
    });
}
