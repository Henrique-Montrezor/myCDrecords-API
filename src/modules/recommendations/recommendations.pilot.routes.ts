import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import authMiddleware from "../../middlewares/auth.middleware";
import asyncHandler from "../../utils/asyncHandler";
import { inspectPilotCollection, pilotNotice } from "./recommendations.pilot.collection";
import { enrollInPilot, getPilotParticipation, withdrawFromPilot } from "./recommendations.pilot.controls";

const router = Router();
/**
 * @swagger
 * /api/recommendations/pilot/notice:
 *   get:
 *     summary: Aviso público do piloto opcional de ML
 *     description: Não consulta usuários nem a política confidencial. Exibe o aviso v2 para adesão opcional ao treino local em memória; consultar não constitui aceite.
 *     tags: [Recommendations]
 *     security: []
 *     responses:
 *       200:
 *         description: Aviso versionado, finalidade, dados, retenção, retirada e contato; no-store.
 * /api/recommendations/pilot/participation:
 *   get:
 *     summary: Consultar a própria participação no piloto
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto com invited, participating, closed e noticeVersion anulável.
 *       401:
 *         description: Autenticação obrigatória.
 *       503:
 *         description: Coleta desligada, armazenamento indisponível ou limpeza não saudável.
 *   put:
 *     summary: Aderir explicitamente ao piloto interno após ler o aviso
 *     description: Requer convite privado prévio. Nunca usa o aceite de reviews públicas como autorização ML.
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [accepted, noticeVersion]
 *             properties:
 *               accepted:
 *                 type: boolean
 *                 enum: [true]
 *               noticeVersion:
 *                 type: string
 *                 enum: [ml-pilot-v2]
 *     responses:
 *       200:
 *         description: Participação registrada com versão e horário do banco; repetição é idempotente.
 *       400:
 *         description: Aceite recusado, versão incompatível ou campos extras.
 *       401:
 *         description: Autenticação obrigatória.
 *       403:
 *         description: Conta sem convite interno ou inativa.
 *       503:
 *         description: Coleta indisponível ou piloto encerrado; nenhum aceite automático.
 *   delete:
 *     summary: Retirar a própria autorização e apagar eventos do piloto
 *     description: Sem campos de entrada. Disponível mesmo com coleta desligada. Não apaga reviews públicas.
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: participating false; eventos apagados e geração invalidada atomicamente.
 *       400:
 *         description: Campos de entrada não permitidos.
 *       401:
 *         description: Autenticação obrigatória.
 *       500:
 *         description: Falha de persistência; transação revertida, sem simular retirada bem-sucedida.
 */
router.get("/notice", (_req, res) => {
    res.set("Cache-Control", "no-store").json(pilotNotice);
});
router.use(authMiddleware);
router.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
});

function available(_req: Request, res: Response, next: NextFunction) {
    const report = inspectPilotCollection();
    if (!report.collectionAllowed) {
        return res.status(503).json({
            error: "A coleta do piloto de ML está desativada ou indisponível.",
            code: "ML_PILOT_BLOCKED",
            blockers: report.blockers,
        });
    }
    next();
}

function actor(req: Request) {
    return z.number().int().positive().parse(req.user?.id);
}

router.get("/participation", available, asyncHandler(async (req, res) => {
    res.json(await getPilotParticipation(actor(req)));
}));
router.put("/participation", available, asyncHandler(async (req, res) => {
    res.json(await enrollInPilot(actor(req), req.body));
}));
router.delete("/participation", asyncHandler(async (req, res) => {
    z.object({}).strict().parse(req.body ?? {});
    res.json(await withdrawFromPilot(actor(req)));
}));

export default router;
