import { Request, Response } from "express";
import { logger } from "../../utils/logger";
import {
  getAllUsers,
  getTotalUsersCount,
  banUser,
  unbanUser,
  isUserBanned,
  deleteReview,
  deleteComment,
  getAllReports,
  getReportsByStatus,
} from "./admin.repository";
import { idParamSchema, banUserSchema, adminPaginationQuerySchema } from "./admin.schema";


// GET /admin/users - List all users
export async function listUsers(req: Request, res: Response) {
  const { page, limit } = adminPaginationQuerySchema.parse(req.query);

  try {
    const users = await getAllUsers(page, limit);
    const total = await getTotalUsersCount();

    res.status(200).json({
      message: "Users listed successfully",
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error("List users error", { error });
    res.status(500).json({ message: "Error listing users" });
  }
}

// PATCH /admin/users/:id/ban - Ban user
export async function banUserHandler(req: Request, res: Response) {
  const { id: userId } = idParamSchema.parse(req.params);
  const { reason } = banUserSchema.parse(req.body);

  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Check if user is already banned
    const isBanned = await isUserBanned(userId);
    if (isBanned) {
      return res.status(400).json({ message: "User is already banned" });
    }

    await banUser(userId, adminId, reason);

    res.status(200).json({
      message: "User banned successfully",
      user_id: userId,
      banned: true,
    });
  } catch (error: any) {
    logger.error("Ban user error", { error });
    res.status(500).json({ message: "Error banning user" });
  }
}

// PATCH /admin/users/:id/unban - Unban user
export async function unbanUserHandler(req: Request, res: Response) {
  const { id: userId } = idParamSchema.parse(req.params);

  try {
    // Check if user is banned
    const isBanned = await isUserBanned(userId);
    if (!isBanned) {
      return res.status(400).json({ message: "User is not banned" });
    }

    await unbanUser(userId);

    res.status(200).json({
      message: "User unbanned successfully",
      user_id: userId,
      banned: false,
    });
  } catch (error: any) {
    logger.error("Unban user error", { error });
    res.status(500).json({ message: "Error unbanning user" });
  }
}

// DELETE /admin/reviews/:id - Delete review
export async function deleteReviewHandler(req: Request, res: Response) {
  const { id: reviewId } = idParamSchema.parse(req.params);

  try {
    await deleteReview(reviewId);

    res.status(200).json({
      message: "Review deleted successfully",
      review_id: reviewId,
    });
  } catch (error: any) {
    logger.error("Delete review error", { error });
    res.status(500).json({ message: "Error deleting review" });
  }
}

// DELETE /admin/comments/:id - Delete comment
export async function deleteCommentHandler(req: Request, res: Response) {
  const { id: commentId } = idParamSchema.parse(req.params);

  try {
    await deleteComment(commentId);

    res.status(200).json({
      message: "Comment deleted successfully",
      comment_id: commentId,
    });
  } catch (error: any) {
    logger.error("Delete comment error", { error });
    res.status(500).json({ message: "Error deleting comment" });
  }
}

// GET /admin/reports - Get all reports
export async function listReports(req: Request, res: Response) {
  const { page, limit, status } = adminPaginationQuerySchema.parse(req.query);

  try {
    let reports;
    if (status) {
      reports = await getReportsByStatus(status, page, limit);
    } else {
      reports = await getAllReports(page, limit);
    }

    res.status(200).json({
      message: "Reports listed successfully",
      data: reports,
      pagination: {
        page,
        limit,
      },
    });
  } catch (error: any) {
    logger.error("List reports error", { error });
    res.status(500).json({ message: "Error listing reports" });
  }
}
