"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (req, res, next) => {
    try {
        // Tenta pegar o Access Token do Header primeiro
        let token = req.headers.authorization?.split(" ")[1];
        let secret = process.env.JWT_SECRET || "your-secret-key";
        // Se não veio pelo Header, pega o Refresh Token do cookie e troca a chave
        if (!token) {
            token = req.cookies.token;
            secret = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
        }
        if (!token) {
            return res.status(401).json({ message: "Token não fornecido" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = { id: decoded.user_id, email: decoded.email };
        next();
    }
    catch (error) {
        return res.status(401).json({ message: "Token inválido ou expirado" });
    }
};
exports.default = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map