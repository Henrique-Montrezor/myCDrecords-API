import { Request, Response } from "express";
import {
  getAllUsers,
  getTotalUsersCount,
  banUser,
  unbanUser,
  isUserBanned,
  getAllReviews,
  deleteReview,
  getAllComments,
  deleteComment,
  getAllReports,
  getReportsByStatus,
} from "./admin.repository";
import { BanUserPayload } from "./admin.entity";

// GET /admin/users - List all users
export async function listUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const users = await getAllUsers(page, limit);
    const total = await getTotalUsersCount();

    res.status(200).json({
      message: "Usuários listados com sucesso",
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Erro ao listar usuários" });
  }
}

// PATCH /admin/users/:id/ban - Ban user
export async function banUserHandler(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const adminId = req.user?.id;
    const { reason }: BanUserPayload = req.body;

    if (!userId || !adminId) {
      return res.status(400).json({ message: "Dados inválidos" });
    }

    if (!reason) {
      return res.status(400).json({ message: "Motivo do banimento é obrigatório" });
    }

    // Check if user is already banned
    const isBanned = await isUserBanned(userId);
    if (isBanned) {
      return res.status(400).json({ message: "Usuário já está banido" });
    }

    await banUser(userId, adminId, reason);

    res.status(200).json({
      message: "Usuário banido com sucesso",
      user_id: userId,
      banned: true,
    });
  } catch (error: any) {
    console.error("Ban user error:", error);
    res.status(500).json({ message: "Erro ao banir usuário" });
  }
}

// PATCH /admin/users/:id/unban - Unban user
export async function unbanUserHandler(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);

    if (!userId) {
      return res.status(400).json({ message: "ID do usuário inválido" });
    }

    // Check if user is banned
    const isBanned = await isUserBanned(userId);
    if (!isBanned) {
      return res.status(400).json({ message: "Usuário não está banido" });
    }

    await unbanUser(userId);

    res.status(200).json({
      message: "Usuário desbanido com sucesso",
      user_id: userId,
      banned: false,
    });
  } catch (error: any) {
    console.error("Unban user error:", error);
    res.status(500).json({ message: "Erro ao desbanir usuário" });
  }
}

// DELETE /admin/reviews/:id - Delete review
export async function deleteReviewHandler(req: Request, res: Response) {
  try {
    const reviewId = parseInt(req.params.id);

    if (!reviewId) {
      return res.status(400).json({ message: "ID da review inválido" });
    }

    await deleteReview(reviewId);

    res.status(200).json({
      message: "Review deletada com sucesso",
      review_id: reviewId,
    });
  } catch (error: any) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: "Erro ao deletar review" });
  }
}

// DELETE /admin/comments/:id - Delete comment
export async function deleteCommentHandler(req: Request, res: Response) {
  try {
    const commentId = parseInt(req.params.id);

    if (!commentId) {
      return res.status(400).json({ message: "ID do comentário inválido" });
    }

    await deleteComment(commentId);

    res.status(200).json({
      message: "Comentário deletado com sucesso",
      comment_id: commentId,
    });
  } catch (error: any) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Erro ao deletar comentário" });
  }
}

// GET /admin/reports - Get all reports
export async function listReports(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    let reports;
    if (status) {
      reports = await getReportsByStatus(status, page, limit);
    } else {
      reports = await getAllReports(page, limit);
    }

    res.status(200).json({
      message: "Denúncias listadas com sucesso",
      data: reports,
      pagination: {
        page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("List reports error:", error);
    res.status(500).json({ message: "Erro ao listar denúncias" });
  }
}
