"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.banUserHandler = banUserHandler;
exports.unbanUserHandler = unbanUserHandler;
exports.deleteReviewHandler = deleteReviewHandler;
exports.deleteCommentHandler = deleteCommentHandler;
exports.listReports = listReports;
const admin_repository_1 = require("./admin.repository");
// GET /admin/users - List all users
async function listUsers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const users = await (0, admin_repository_1.getAllUsers)(page, limit);
        const total = await (0, admin_repository_1.getTotalUsersCount)();
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
    }
    catch (error) {
        console.error("List users error:", error);
        res.status(500).json({ message: "Erro ao listar usuários" });
    }
}
// PATCH /admin/users/:id/ban - Ban user
async function banUserHandler(req, res) {
    try {
        const userId = parseInt(req.params.id);
        const adminId = req.user?.id;
        const { reason } = req.body;
        if (!userId || !adminId) {
            return res.status(400).json({ message: "Dados inválidos" });
        }
        if (!reason) {
            return res.status(400).json({ message: "Motivo do banimento é obrigatório" });
        }
        // Check if user is already banned
        const isBanned = await (0, admin_repository_1.isUserBanned)(userId);
        if (isBanned) {
            return res.status(400).json({ message: "Usuário já está banido" });
        }
        await (0, admin_repository_1.banUser)(userId, adminId, reason);
        res.status(200).json({
            message: "Usuário banido com sucesso",
            user_id: userId,
            banned: true,
        });
    }
    catch (error) {
        console.error("Ban user error:", error);
        res.status(500).json({ message: "Erro ao banir usuário" });
    }
}
// PATCH /admin/users/:id/unban - Unban user
async function unbanUserHandler(req, res) {
    try {
        const userId = parseInt(req.params.id);
        if (!userId) {
            return res.status(400).json({ message: "ID do usuário inválido" });
        }
        // Check if user is banned
        const isBanned = await (0, admin_repository_1.isUserBanned)(userId);
        if (!isBanned) {
            return res.status(400).json({ message: "Usuário não está banido" });
        }
        await (0, admin_repository_1.unbanUser)(userId);
        res.status(200).json({
            message: "Usuário desbanido com sucesso",
            user_id: userId,
            banned: false,
        });
    }
    catch (error) {
        console.error("Unban user error:", error);
        res.status(500).json({ message: "Erro ao desbanir usuário" });
    }
}
// DELETE /admin/reviews/:id - Delete review
async function deleteReviewHandler(req, res) {
    try {
        const reviewId = parseInt(req.params.id);
        if (!reviewId) {
            return res.status(400).json({ message: "ID da review inválido" });
        }
        await (0, admin_repository_1.deleteReview)(reviewId);
        res.status(200).json({
            message: "Review deletada com sucesso",
            review_id: reviewId,
        });
    }
    catch (error) {
        console.error("Delete review error:", error);
        res.status(500).json({ message: "Erro ao deletar review" });
    }
}
// DELETE /admin/comments/:id - Delete comment
async function deleteCommentHandler(req, res) {
    try {
        const commentId = parseInt(req.params.id);
        if (!commentId) {
            return res.status(400).json({ message: "ID do comentário inválido" });
        }
        await (0, admin_repository_1.deleteComment)(commentId);
        res.status(200).json({
            message: "Comentário deletado com sucesso",
            comment_id: commentId,
        });
    }
    catch (error) {
        console.error("Delete comment error:", error);
        res.status(500).json({ message: "Erro ao deletar comentário" });
    }
}
// GET /admin/reports - Get all reports
async function listReports(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        let reports;
        if (status) {
            reports = await (0, admin_repository_1.getReportsByStatus)(status, page, limit);
        }
        else {
            reports = await (0, admin_repository_1.getAllReports)(page, limit);
        }
        res.status(200).json({
            message: "Denúncias listadas com sucesso",
            data: reports,
            pagination: {
                page,
                limit,
            },
        });
    }
    catch (error) {
        console.error("List reports error:", error);
        res.status(500).json({ message: "Erro ao listar denúncias" });
    }
}
//# sourceMappingURL=admin.controller.js.map