import { Request, Response } from "express";
import { createOrUpdateProfile, getProfileByUsername } from "./profile.repository";
import { logger } from "../../utils/logger";
import { profileUpsertSchema } from "./profile.schema";

// Criar ou atualizar perfil
export async function createOrUpdateProfileController(req: Request, res: Response) {
    const user_id = req.user?.id; // get user_id from JWT token

    if (!user_id) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const { bio, avatar_url } = profileUpsertSchema.parse(req.body);

    try {
        await createOrUpdateProfile(user_id, { user_id, bio, avatar_url } as any, avatar_url);

        res.status(200).json({
            message: "Profile created or updated successfully",
            user_id
        });
    } catch (error) {
        logger.error('Erro ao atualizar perfil', { error });
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}

// search the profile by username and return the profile data
export async function searchProfileByUsername(req: Request, res: Response) {
    try {
        const { username } = req.params;

        const profile = await getProfileByUsername({ username });

        if (!profile) {
            return res.status(404).json({ message: "Perfil não encontrado" });
        }

        res.status(200).json(profile);
    } catch (error) {
        logger.error('Erro ao obter perfil', { error });
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}