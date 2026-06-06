import { getReviewsByAlbumId, postReview, deleteReview, getReviewsByUserId } from './reviews.repository';
import { Request, Response } from 'express';

// Get reviews for a specific album
export async function getReviewsByAlbumIdController(req: Request, res: Response) {
    const albumId = parseInt(req.params.albumId);
    const page = parseInt(req.query.page as string) || 1;

    try {
        const reviews = await getReviewsByAlbumId(albumId, page);
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function postReviewController(req: Request, res: Response) {
    const userId = req.user?.id; // Assuming user ID is available in the request object

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { albumId, albumTitle, albumImage, albumArtist, rating, text } = req.body;

    if (!albumId || !albumTitle || !albumArtist) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    } 

    try {
        const reviewId = await postReview(userId, albumId, albumTitle, albumImage, albumArtist, rating, text);
        res.status(201).json({ reviewId });
    } catch (error) {
        console.error('Error posting review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}