"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = adminMiddleware;
const init_database_1 = require("../../mysql2/init.database");
// Admin middleware - checks if user is authenticated and has admin role
async function adminMiddleware(req, res, next) {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "Token não fornecido" });
        }
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Não autenticado" });
        }
        // Conectando e executando a query (assumindo uma biblioteca como mysql2 ou similar)
        const connection = await (0, init_database_1.initDatabase)();
        const query = `SELECT user_id FROM admins WHERE user_id = ?`;
        const [rows] = await connection.execute(query, [req.user.id]);
        // Se o array de resultados for vazio, o usuário não está na tabela admin
        if (rows.length === 0) {
            return res.status(403).json({ message: "Acesso negado - privilégios de admin necessários" });
        }
        next();
    }
    catch (error) {
        console.error("Erro no middleware de admin:", error);
        return res.status(500).json({ message: "Erro ao verificar permissões de admin" });
    }
}
exports.default = adminMiddleware;
//# sourceMappingURL=admin.middleware.js.map