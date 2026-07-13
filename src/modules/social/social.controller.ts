import { Request, Response } from "express";
import {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getFollowCounts,
    getFollowingFeed,
    upsertVote,
    removeVote,
    getVoteScore,
    getUserVote,
} from "./social.repository";
import {
    userIdParamSchema,
    paginationQuerySchema,
    voteSchema,
    voteTargetParamSchema,
    removeVoteSchema,
} from "./social.schema";

// POST /api/social/follow/:userId
export async function followController(req: Request, res: Response) {
    const followerId = req.user?.id;
    if (!followerId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { userId: followingId } = userIdParamSchema.parse(req.params);

    if (followerId === followingId) {
        return res.status(400).json({ error: "You cannot follow yourself" });
    }

    const created = await followUser(followerId, followingId);
    if (!created) {
        return res.status(409).json({ error: "You already follow this user" });
    }

    res.status(201).json({ message: "User followed successfully" });
}

// DELETE /api/social/follow/:userId
export async function unfollowController(req: Request, res: Response) {
    const followerId = req.user?.id;
    if (!followerId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { userId: followingId } = userIdParamSchema.parse(req.params);

    const removed = await unfollowUser(followerId, followingId);
    if (!removed) {
        return res.status(404).json({ error: "You do not follow this user" });
    }

    res.status(204).send();
}

// GET /api/social/:userId/followers
export async function followersController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    const followers = await getFollowers(userId);
    const counts = await getFollowCounts(userId);
    res.json({ followers, counts });
}

// GET /api/social/:userId/following
export async function followingController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    const following = await getFollowing(userId);
    const counts = await getFollowCounts(userId);
    res.json({ following, counts });
}

// GET /api/social/feed
export async function feedController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { page } = paginationQuerySchema.parse(req.query);
    const feed = await getFollowingFeed(userId, page);
    res.json(feed);
}

// POST /api/social/vote
export async function voteController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { targetType, targetId, value } = voteSchema.parse(req.body);

    await upsertVote(userId, targetType, targetId, value as 1 | -1);
    const score = await getVoteScore(targetType, targetId);
    res.status(200).json({ message: "Vote recorded", ...score, userVote: value });
}

// DELETE /api/social/vote
export async function removeVoteController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { targetType, targetId } = removeVoteSchema.parse(req.body);

    const removed = await removeVote(userId, targetType, targetId);
    if (!removed) {
        return res.status(404).json({ error: "Vote not found" });
    }

    const score = await getVoteScore(targetType, targetId);
    res.status(200).json({ message: "Vote removed", ...score, userVote: null });
}

// GET /api/social/votes/:targetType/:targetId
export async function voteScoreController(req: Request, res: Response) {
    const { targetType, targetId } = voteTargetParamSchema.parse(req.params);
    const score = await getVoteScore(targetType, targetId);

    let userVote: number | null = null;
    if (req.user?.id) {
        userVote = await getUserVote(req.user.id, targetType, targetId);
    }

    res.json({ ...score, userVote });
}
