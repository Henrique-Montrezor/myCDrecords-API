import { Request, Response } from "express";
import { getUserBadges, getAllBadges } from "./gamification.repository";
import { userIdParamSchema } from "./gamification.schema";

// GET /api/gamification/badges - badge catalog
export async function listBadgesController(req: Request, res: Response) {
    const badges = await getAllBadges();
    res.json(badges);
}

// GET /api/gamification/me/badges - badges of the authenticated user
export async function myBadgesController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const badges = await getUserBadges(userId);
    res.json(badges);
}

// GET /api/gamification/users/:userId/badges - badges of a user
export async function userBadgesController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    const badges = await getUserBadges(userId);
    res.json(badges);
}
