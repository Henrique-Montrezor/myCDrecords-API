import { parseArgs } from "node:util";
import { z } from "zod";

export const pilotOperationSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("purge") }).strict(),
    z.object({ action: z.literal("invite"), "user-id": z.coerce.number().int().positive().max(2147483647) }).strict(),
    z.object({
        action: z.literal("album"), "album-id": z.string().uuid().transform((id) => id.toLowerCase()),
        evidence: z.string().trim().min(1).max(1000),
        "first-available-at": z.string().datetime({ offset: true }),
        "confirm-independent-core-cc0": z.literal(true),
    }).strict(),
    z.object({ action: z.literal("revoke-album"), "album-id": z.string().uuid().transform((id) => id.toLowerCase()) }).strict(),
    z.object({ action: z.literal("close"), "confirm-end": z.literal(true) }).strict(),
]);

export function parsePilotOperation(args: string[]) {
    if (args.length === 1 && args[0] === "--help") return null;
    const { values, positionals } = parseArgs({
        args, allowPositionals: true, strict: true,
        options: {
            "user-id": { type: "string" }, "album-id": { type: "string" },
            evidence: { type: "string" }, "first-available-at": { type: "string" },
            "confirm-independent-core-cc0": { type: "boolean" }, "confirm-end": { type: "boolean" },
        },
    });
    if (positionals.length !== 1) throw new Error("Informe exatamente uma operação.");
    return pilotOperationSchema.parse({ action: positionals[0], ...values });
}

if (require.main === module) {
    let operation: ReturnType<typeof parsePilotOperation> | undefined;
    try {
        operation = parsePilotOperation(process.argv.slice(2));
    } catch {
        console.error("Argumentos inválidos. Uso: npm run ml:pilot:manage -- --help");
        process.exitCode = 2;
    }
    if (process.exitCode !== 2) {
        if (operation === null) {
            console.log("Operação privada local; não compartilhe IDs/evidências ou resultados com ferramentas de IA.");
            console.log("invite --user-id ID");
            console.log("album --album-id MBID --evidence REFERENCIA --first-available-at ISO_UTC --confirm-independent-core-cc0");
            console.log("revoke-album --album-id MBID");
            console.log("purge (limpeza para agendador externo, inclusive com a API parada)");
            console.log("close --confirm-end (encerra este piloto sem reabertura automática)");
        } else if (operation !== undefined) {
            void (async () => {
                const { applyPilotOperation } = await import("./recommendations.pilot.operations");
                const { getPool } = await import("../../mysql2/init.database");
                try {
                    console.log(JSON.stringify(await applyPilotOperation(operation)));
                } catch (error) {
                    const { logger } = await import("../../utils/logger");
                    logger.error("ML pilot management failed", { error });
                    process.exitCode = 1;
                } finally {
                    await getPool().end();
                }
            })().catch(() => {
                console.error("Falha ao inicializar/finalizar a operação privada do piloto.");
                process.exitCode = 1;
            });
        }
    }
}
