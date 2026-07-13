import { getReviewsByAlbumId, postReview, deleteReview, getReviewsByUserId, updateReview, checkReview} from './reviews.repository';
import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { evaluateUserBadges } from '../gamification/gamification.service';
import {
    postReviewSchema,
    updateReviewSchema,
    reviewIdParamSchema,
    albumIdParamSchema,
    userIdParamSchema,
    paginationQuerySchema,
} from './reviews.schema';

// Get reviews for a specific album
export async function getReviewsByAlbumIdController(req: Request, res: Response) {
    const { albumId } = albumIdParamSchema.parse(req.params);
    const { page } = paginationQuerySchema.parse(req.query);

    try {
        const reviews = await getReviewsByAlbumId(albumId, page);
        res.json(reviews);
    } catch (error) {
        logger.error('Error fetching reviews', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Post
export async function postReviewController(req: Request, res: Response) {
    const userId = req.user?.id; 

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate and normalize the request body
    const { albumId, albumTitle, albumImage, albumArtist, genre, rating, text } =
        postReviewSchema.parse(req.body);

    try {
        const existingReview = await checkReview(userId, albumId);
        if (existingReview) {
            return res.status(409).json({ error: 'User has already reviewed this album' });
        }

        // Pass all fields to the repository function
        const reviewId = await postReview(
            userId, albumId, albumTitle ?? '', albumImage ?? '', albumArtist ?? '', genre ?? '', rating, text ?? ''
        );

        // Evaluate and grant gamification badges (does not block on failure)
        await evaluateUserBadges(userId);

        res.status(201).json({ reviewId });
    } catch (error) {
        logger.error('Error posting review', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function deleteReviewController(req: Request, res: Response) {
    const { reviewId } = reviewIdParamSchema.parse(req.params);

    // 1. Ensure the user is authenticated
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // 2. Pass the reviewId and userId to the repository
        const success = await deleteReview(reviewId, userId);
        
        // 3. If affectedRows was 0 (success = false), the review does not exist or is not theirs
        if (!success) {
            return res.status(404).json({ 
                error: 'Review not found or you do not have permission to delete it' 
            });
        }

        // Status 204 indicates success, but with no content in the response body
        res.status(204).send();
    } catch (error) {
        logger.error('Error deleting review', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getReviewsByUserIdController(req: Request, res: Response) {
    const { userId } = userIdParamSchema.parse(req.params);
    const { page } = paginationQuerySchema.parse(req.query);

    try {
        const reviews = await getReviewsByUserId(userId, page);
        res.json(reviews);
    } catch (error) {
        logger.error('Error getting the review', { error });
        res.status(500).json({ error: 'Internal server error'})
    }
}

export async function updateReviewController(req: Request, res: Response) {
    const { reviewId } = reviewIdParamSchema.parse(req.params);
    const { rating, text } = updateReviewSchema.parse(req.body);

    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // 3 and 4. Try to update ensuring review ownership in the same query
        const success = await updateReview(reviewId, userId, rating, text ?? '');
        
        if (!success) {
            // If affectedRows is 0, the review does not exist OR does not belong to the user
            return res.status(404).json({ error: 'Review not found or access denied' });
        }
        
        res.status(200).json('Update review successfully');
    } catch(error) {
        logger.error('Error updating the review', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}