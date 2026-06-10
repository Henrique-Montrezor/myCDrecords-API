import { getReviewsByAlbumId, postReview, deleteReview, getReviewsByUserId, updateReview, checkReview} from './reviews.repository';
import { Request, Response } from 'express';

// Get reviews for a specific album
export async function getReviewsByAlbumIdController(req: Request, res: Response) {
    const albumId = parseInt(req.params.albumId);
    const page = parseInt(req.query.page as string) || 1;

    if (!albumId){
        return res.json({ error: 'Please provide a AlbumId '})
    }

    try {
        const reviews = await getReviewsByAlbumId(albumId, page);
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Post
export async function postReviewController(req: Request, res: Response) {
    const userId = req.user?.id; // Assuming user ID is available in the request object
    console.log(userId);

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { albumId, rating, text } = req.body;
    console.log(albumId, rating, text);

    if (!albumId || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    } 

    try {
        const existingReview = await checkReview(userId, albumId);
        if (existingReview) {
            return res.status(409).json({ error: 'User has already reviewed this album' });
        }

        const reviewId = await postReview(userId, albumId, rating, text);
        res.status(201).json({ reviewId });
    } catch (error) {
        console.error('Error posting review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function deleteReviewController(req: Request, res: Response) {
    const reviewId = parseInt(req.params.reviewId);

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
        console.error('Error deleting review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getReviewsByUserIdController(req: Request, res: Response) {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;

    try {
        const reviews = await getReviewsByUserId(userId, page);
        res.json(reviews);
    } catch (error) {
        console.error('Error getting the review', error);
        res.status(500).json({ error: 'Internal server error'})
    }
}

export async function updateReviewController(req: Request, res: Response) {
    const reviewId = parseInt(req.params.reviewId);
    const { rating, text } = req.body;

    if (!rating) {
        return res.status(400).json({ error: 'O campo rating é obrigatório' });
    }

    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    try {
        // 3 e 4. Tenta atualizar garantindo a propriedade da review na mesma query
        const success = await updateReview(reviewId, userId, rating, text);
        
        if (!success) {
            // Se affectedRows for 0, significa que a review não existe OU não pertence ao usuário
            return res.status(404).json({ error: 'Review não encontrada ou acesso negado' });
        }
        
        res.status(200).json('Update review successfully');
    } catch(error) {
        console.error('Error updating the review', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}