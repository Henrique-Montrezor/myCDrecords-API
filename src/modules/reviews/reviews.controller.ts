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

    // Valida e normaliza o corpo da requisição
    const { albumId, albumTitle, albumImage, albumArtist, genre, rating, text } =
        postReviewSchema.parse(req.body);

    try {
        const existingReview = await checkReview(userId, albumId);
        if (existingReview) {
            return res.status(409).json({ error: 'User has already reviewed this album' });
        }

        // Passe todos os campos para a função do repositório
        const reviewId = await postReview(
            userId, albumId, albumTitle ?? '', albumImage ?? '', albumArtist ?? '', genre ?? '', rating, text ?? ''
        );

        // Avalia e concede emblemas de gamificação (não bloqueia em caso de falha)
        await evaluateUserBadges(userId);

        res.status(201).json({ reviewId });
    } catch (error) {
        logger.error('Error posting review', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function deleteReviewController(req: Request, res: Response) {
    const { reviewId } = reviewIdParamSchema.parse(req.params);

    // 1. Garante que o usuário está autenticado
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    try {
        // 2. Passa o reviewId e o userId para o repositório
        const success = await deleteReview(reviewId, userId);
        
        // 3. Se affectedRows foi 0 (success = false), significa que a review não existe ou não é dele
        if (!success) {
            return res.status(404).json({ 
                error: 'Review não encontrada ou você não tem permissão para deletá-la' 
            });
        }

        // Status 204 indica sucesso, mas sem conteúdo no corpo da resposta
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
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    try {
        // 3 e 4. Tenta atualizar garantindo a propriedade da review na mesma query
        const success = await updateReview(reviewId, userId, rating, text ?? '');
        
        if (!success) {
            // Se affectedRows for 0, significa que a review não existe OU não pertence ao usuário
            return res.status(404).json({ error: 'Review não encontrada ou acesso negado' });
        }
        
        res.status(200).json('Update review successfully');
    } catch(error) {
        logger.error('Error updating the review', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}