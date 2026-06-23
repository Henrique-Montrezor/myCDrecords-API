import { Request, Response } from "express";
import { getUserBadges, getAllBadges } from "./gamification.repository";
import { userIdParamSchema } from "./gamification.schema";

// GET /api/gamification/badges - catálogo de emblemas
export async function listBadgesController(req: Request, res: Response) {
    const badges = await getAllBadges();
    res.json(badges);
}

// GET /api/gamification/me/badges - emblemas do usuário autenticado
export async function myBadgesController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const badges = await getUserBadges(userId);
    res.json(badges);
}

// GET /api/gamification/users/:userId/badges - emblemas de um usuário
export async function userBadgesController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    const badges = await getUserBadges(userId);
    res.json(badges);
}
