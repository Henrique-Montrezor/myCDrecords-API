import { z } from "zod";

export const pilotNotice = {
    version: "ml-pilot-v2",
    responsible: "Administradores - MyCDRecords",
    contact: "Contato@MyCDRecords.com",
    purpose: "Treinar e avaliar recomendações de álbuns no piloto interno do myCDrecords.",
    text: "Autorizo, de forma opcional, o uso das novas notas que eu publicar após aderir a este piloto para treinar e avaliar recomendações de álbuns. O uso normal do aplicativo não depende desta autorização.",
    data: "Somente notas independentes de 1 a 5, identificadores internos de usuário e álbum e horários das alterações. Texto de reviews, capas, tags e dados do Spotify não são coletados para ML.",
    retention: "Eventos do piloto expiram em até 30 dias. As notas autorizadas podem ser usadas em treinamento e avaliação locais de recomendações, somente em memória durante a execução. Datasets, mapas de identificadores, pesos e recomendações individuais não são salvos nem publicados; somente resultados agregados do experimento são mantidos.",
    receipts: "O comprovante é mantido durante a participação e por até 30 dias após a retirada ou encerramento do piloto.",
    withdrawal: "Você pode retirar a autorização pela API a qualquer momento ou solicitar ajuda pelo contato acima. A retirada interrompe a coleta e remove os eventos do piloto; não apaga suas reviews públicas.",
} as const;

const configSchema = z.object({
    enabled: z.enum(["true", "false"]).default("false"),
    approvedVersion: z.string().optional(),
    durableRetention: z.enum(["true", "false"]).default("false"),
});
let storageReady = false;
let retentionHealthy = false;

export function inspectPilotCollection(env: NodeJS.ProcessEnv = process.env) {
    const config = configSchema.parse({
        enabled: env.ML_PILOT_COLLECTION_ENABLED,
        approvedVersion: env.ML_PILOT_NOTICE_APPROVED_VERSION,
        durableRetention: env.ML_PILOT_DURABLE_RETENTION_CONFIRMED,
    });
    const blockers: string[] = [];
    if (config.enabled !== "true") blockers.push("COLLECTION_DISABLED");
    if (config.approvedVersion !== pilotNotice.version) blockers.push("PUBLIC_NOTICE_APPROVAL_PENDING");
    if (config.durableRetention !== "true") blockers.push("DURABLE_RETENTION_NOT_CONFIRMED");
    if (!storageReady) blockers.push("PILOT_STORAGE_NOT_READY");
    if (!retentionHealthy) blockers.push("RETENTION_NOT_READY");
    return { configured: config.enabled === "true", collectionAllowed: blockers.length === 0, blockers };
}

// Only the database bootstrap/retention lifecycle calls these; neither is an HTTP control.
export function markPilotStorageReady(ready: boolean) {
    storageReady = ready;
}

export function markPilotRetentionHealthy(healthy: boolean) {
    retentionHealthy = healthy;
}

export function hasPilotStorage() {
    return storageReady;
}
