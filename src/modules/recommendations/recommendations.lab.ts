import express from "express";
import cors from "cors";
import helmet from "helmet";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import asyncHandler from "../../utils/asyncHandler";
import { errorHandler } from "../../middlewares/error.middleware";
import { requestIdMiddleware } from "../../middlewares/requestId.middleware";
import { logger } from "../../utils/logger";

const albumId = z.string().regex(/^synthetic-album-(0[1-9]|1[0-2])$/);
const ranked = z.array(z.object({ albumId, score: z.number().finite() }).strict()).max(6);
const metrics = z.object({ recall: z.number().min(0).max(1), ndcg: z.number().min(0).max(1) }).strict();
const snapshotSchema = z.object({
    schemaVersion: z.literal(1),
    mode: z.literal("synthetic"),
    modelVersion: z.literal("pytorch-bpr-v1"),
    datasetVersion: z.literal("synthetic-families-v1"),
    snapshotId: z.string().regex(/^[a-f0-9]{64}$/),
    generatedAt: z.string().datetime(),
    promotionAllowed: z.literal(false),
    realWorldQuality: z.literal("not_measured"),
    training: z.object({
        initialLoss: z.number().finite().nonnegative(),
        finalLoss: z.number().finite().nonnegative(),
        epochs: z.number().int().positive(),
        seed: z.number().int().nonnegative(),
        torchVersion: z.string().min(1).max(40),
    }).strict(),
    evaluation: z.object({
        protocol: z.literal("synthetic-leave-one-out"),
        k: z.literal(3),
        model: metrics,
        baseline: metrics,
    }).strict(),
    profiles: z.array(z.object({
        id: z.string().regex(/^synthetic-user-(0[1-9]|1[0-2])$/),
        trainingAlbums: z.array(albumId).length(3),
        heldOutAlbum: albumId,
        recommendations: ranked,
        baseline: ranked,
    }).strict()).length(12),
}).strict().superRefine((snapshot, context) => {
    if (new Set(snapshot.profiles.map((profile) => profile.id)).size !== 12) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["profiles"], message: "Duplicate synthetic profiles." });
    }
    for (const [index, profile] of snapshot.profiles.entries()) {
        const training = new Set(profile.trainingAlbums);
        const valid = training.size === 3 && !training.has(profile.heldOutAlbum)
            && [profile.recommendations, profile.baseline].every((items) =>
                new Set(items.map((item) => item.albumId)).size === items.length
                && items.every((item, position) => !training.has(item.albumId) && (position === 0 || items[position - 1].score >= item.score)));
        if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, path: ["profiles", index], message: "Invalid ranking or training exclusion." });
    }
});

export function createRecommendationLabApp(snapshotPath = resolve(__dirname, "..", "..", "..", "..", "myCDrecords-ml", "artifacts", "snapshot.json")) {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(helmet());
    app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], exposedHeaders: ["X-Request-Id"] }));
    app.use((_req, res, next) => {
        res.set("Cache-Control", "no-store");
        if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
            res.status(404).json({ message: "Laboratório indisponível neste ambiente." });
            return;
        }
        next();
    });

    /**
     * @swagger
     * /api/recommendations/lab:
     *   get:
     *     summary: Read the isolated synthetic PyTorch laboratory snapshot
     *     description: |
     *       Development-only entry `npm run ml:lab`, bound to localhost:3005.
     *       Not mounted in the production API. No auth, cookies, database or provider access.
     *       Reads a validated, atomically published Python snapshot; never trains on HTTP.
     *       All identifiers are synthetic; promotionAllowed is always false.
     *       Model scores are ranking scores, not probabilities. Evaluation is synthetic leave-one-out at k=3, not temporal validation.
     *       Each of 12 profiles has id, trainingAlbums (3 synthetic IDs), heldOutAlbum,
     *       recommendations and baseline (up to 6 {albumId, score}, descending, unique and excluding training items).
     *     tags: [Recommendations]
     *     security: []
     *     servers:
     *       - url: http://localhost:3005
     *     responses:
     *       200:
     *         description: Validated synthetic snapshot; Cache-Control no-store.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               required: [schemaVersion, mode, modelVersion, datasetVersion, snapshotId, generatedAt, promotionAllowed, realWorldQuality, training, evaluation, profiles]
     *               properties:
     *                 schemaVersion: { type: integer, enum: [1] }
     *                 mode: { type: string, enum: [synthetic] }
     *                 modelVersion: { type: string, enum: [pytorch-bpr-v1] }
     *                 datasetVersion: { type: string, enum: [synthetic-families-v1] }
     *                 snapshotId: { type: string, pattern: '^[a-f0-9]{64}$' }
     *                 generatedAt: { type: string, format: date-time }
     *                 promotionAllowed: { type: boolean, enum: [false] }
     *                 realWorldQuality: { type: string, enum: [not_measured] }
     *                 training:
     *                   type: object
     *                   description: initialLoss, finalLoss, epochs, seed and torchVersion.
     *                 evaluation:
     *                   type: object
     *                   description: protocol synthetic-leave-one-out, k=3, model and baseline metrics (recall and ndcg, each 0-1).
     *                 profiles:
     *                   type: array
     *                   minItems: 12
     *                   maxItems: 12
     *                   items: { type: object }
     *       404:
     *         description: Environment is not development/test.
     *       503:
     *         description: ML_LAB_NOT_TRAINED (missing file) or ML_LAB_INVALID_SNAPSHOT (invalid/oversized file); includes code, message and requestId.
     */
    app.get("/api/recommendations/lab", asyncHandler(async (req, res) => {
        const unavailable = (code: string, message: string) => {
            logger.warn("Synthetic ML laboratory unavailable", { code, requestId: req.requestId });
            return res.status(503).json({ code, message, requestId: req.requestId });
        };
        let content: string;
        try {
            content = await readFile(snapshotPath, "utf8");
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                return unavailable("ML_LAB_NOT_TRAINED", "Nenhum treino disponível. Execute o treinamento sintético e tente novamente.");
            }
            throw error;
        }
        const invalid = () => unavailable("ML_LAB_INVALID_SNAPSHOT", "O resultado do treino é inválido. Gere um novo snapshot sintético.");
        if (Buffer.byteLength(content, "utf8") > 131072) return invalid();
        let data: unknown;
        try {
            data = JSON.parse(content);
        } catch (error) {
            if (error instanceof SyntaxError) return invalid();
            throw error;
        }
        const parsed = snapshotSchema.safeParse(data);
        if (!parsed.success) return invalid();
        return res.json(parsed.data);
    }));
    app.use(errorHandler);
    return app;
}

if (require.main === module) {
    process.env.NODE_ENV ??= "development";
    if (process.env.NODE_ENV !== "development") throw new Error("O servidor de laboratório só pode iniciar em desenvolvimento.");
    const server = createRecommendationLabApp().listen(3005, "localhost", () => {
        logger.info("Synthetic ML laboratory ready at http://localhost:3005/api/recommendations/lab");
    });
    server.on("error", (error) => {
        logger.error("Synthetic ML laboratory failed to start", { message: error.message });
        process.exitCode = 1;
    });
}
