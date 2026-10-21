import { Request, Response } from "express";
import { createOrUpdateProfile, getFavorites, getPublicProfile, getUserActivity, replaceFavorites, setProfileImage } from "./profile.repository";
import { detectImageType, removeProfileImage, saveProfileImage, type ProfileImageKind } from "./profile.images";
import { logger } from "../../utils/logger";
import { activityQuerySchema, favoritesSchema, profileUpsertSchema, userIdParamSchema, usernameParamSchema } from "./profile.schema";

// Create or update profile
export async function createOrUpdateProfileController(req: Request, res: Response) {
    const user_id = req.user?.id; // get user_id from JWT token

    if (!user_id) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const { bio, avatar_url } = profileUpsertSchema.parse(req.body);

    try {
        await createOrUpdateProfile(user_id, { user_id, bio, avatar_url: avatar_url || null } as any, avatar_url || null);

        res.status(200).json({
            message: "Profile created or updated successfully",
            user_id
        });
    } catch (error) {
        logger.error('Error updating profile', { error });
        res.status(500).json({ message: 'Internal server error' });
    }
}

// GET /api/profile/get-profile/:username
export async function searchProfileByUsername(req: Request, res: Response) {
    const { username } = usernameParamSchema.parse(req.params);

    try {
        const profile = await getPublicProfile(username, req.user!.id);

        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        res.status(200).json(profile);
    } catch (error) {
        logger.error('Error retrieving profile', { error });
        res.status(500).json({ message: 'Internal server error' });
    }
}

// GET /api/profile/users/:userId/favorites
export async function getFavoritesController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    res.json(await getFavorites(userId));
}

// PUT /api/profile/favorites
export async function replaceFavoritesController(req: Request, res: Response) {
    const { albums } = favoritesSchema.parse(req.body);
    await replaceFavorites(req.user!.id, albums);
    res.json(await getFavorites(req.user!.id));
}

// GET /api/profile/users/:userId/activity
export async function getActivityController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    const { page } = activityQuerySchema.parse(req.query);
    res.json(await getUserActivity(userId, page));
}

const imageKind = (req: Request) => req.params.kind as ProfileImageKind;

// POST /api/profile/:kind (avatar | banner), raw image body
export async function uploadProfileImageController(req: Request, res: Response) {
    const body = req.body;
    if (!Buffer.isBuffer(body)) {
        return res.status(415).json({ error: "Send a JPEG, PNG or WebP image" });
    }
    const ext = detectImageType(body);
    if (!ext) {
        return res.status(415).json({ error: "Unsupported image type" });
    }

    const kind = imageKind(req);
    const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
    const url = await saveProfileImage(req.user!.id, kind, body, ext, baseUrl);
    try {
        const previous = await setProfileImage(req.user!.id, kind, url);
        await removeProfileImage(previous);
    } catch (error) {
        await removeProfileImage(url);
        throw error;
    }
    res.json({ url });
}

// DELETE /api/profile/:kind (avatar | banner)
export async function deleteProfileImageController(req: Request, res: Response) {
    const previous = await setProfileImage(req.user!.id, imageKind(req), null);
    await removeProfileImage(previous);
    res.status(204).send();
}
