import { Request, Response } from "express";
import {
    deleteComment,
    getCommentById,
    getCommentsByReviewId,
    postComment,
    reviewExists,
    updateComment,
} from "./comments.repository";
import { commentBodySchema, commentIdParamSchema, paginationQuerySchema, reviewIdParamSchema } from "./reviews.schema";

export async function listCommentsController(req: Request, res: Response) {
    const { reviewId } = reviewIdParamSchema.parse(req.params);
    const { page } = paginationQuerySchema.parse(req.query);

    if (!(await reviewExists(reviewId))) {
        return res.status(404).json({ error: "Review not found" });
    }
    res.json(await getCommentsByReviewId(reviewId, page));
}

export async function postCommentController(req: Request, res: Response) {
    const { reviewId } = reviewIdParamSchema.parse(req.params);
    const { text } = commentBodySchema.parse(req.body);

    const commentId = await postComment(req.user!.id, reviewId, text);
    if (commentId === null) {
        return res.status(404).json({ error: "Review not found" });
    }
    res.status(201).json(await getCommentById(commentId));
}

export async function updateCommentController(req: Request, res: Response) {
    const { commentId } = commentIdParamSchema.parse(req.params);
    const { text } = commentBodySchema.parse(req.body);

    if (!(await updateComment(commentId, req.user!.id, text))) {
        return res.status(404).json({ error: "Comment not found or access denied" });
    }
    res.json(await getCommentById(commentId));
}

export async function deleteCommentController(req: Request, res: Response) {
    const { commentId } = commentIdParamSchema.parse(req.params);

    if (!(await deleteComment(commentId, req.user!.id))) {
        return res.status(404).json({ error: "Comment not found or access denied" });
    }
    res.status(204).send();
}
