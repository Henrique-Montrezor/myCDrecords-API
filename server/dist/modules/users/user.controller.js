"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterUser = RegisterUser;
exports.searchUsers = searchUsers;
exports.validateEmail = validateEmail;
exports.validateUsername = validateUsername;
exports.loginUser = loginUser;
exports.logoutUser = logoutUser;
const user_repository_1 = require("./user.repository");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
async function RegisterUser(req, res) {
    const { username, email, password } = req.body;
    // Check if the <email> is already registered
    const existingUser = await (0, user_repository_1.findByEmail)(email);
    if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
    }
    // Check if the <username> is already taken
    const existingUsername = await (0, user_repository_1.findByUsername)(username);
    if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
    }
    // Register the user in the database
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        await (0, user_repository_1.createUser)({ username, email, password: hashedPassword, is_active: true });
        res.status(201).json({ message: "User created successfully" });
    }
    catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
// searchUsers function
async function searchUsers(req, res) {
    const { username } = req.query;
    const search = await (0, user_repository_1.findByUsername)(username);
    if (!search) {
        return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(search);
}
// validateEmail function
async function validateEmail(req, res) {
    const { email } = req.query;
    const search = await (0, user_repository_1.findByEmail)(email);
    if (search) {
        return res.status(400).json({ message: "Email already registered" });
    }
    res.status(200).json({ message: "Email is available" });
}
async function validateUsername(req, res) {
    const { username } = req.query;
    const search = await (0, user_repository_1.findByUsername)(username);
    if (search) {
        return res.status(400).json({ message: "Username already taken" });
    }
    res.status(200).json({ message: "Username is available" });
}
// loginUser function
async function loginUser(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }
    try {
        const user = await (0, user_repository_1.findByEmail)(email);
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        // Compares the provided password with the hashed password in the database
        const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Senha incorreta" });
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ user_id: user.id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });
        // sends the token as an HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true, // Não acessível por JavaScript (seguro)
            secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
            sameSite: "strict", // Proteção contra CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
        });
        res.status(200).json({
            message: "Login realizado com sucesso",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    }
    catch (error) {
        console.error("Erro ao fazer login:", error);
        res.status(500).json({ message: "Erro interno do servidor" });
    }
}
async function logoutUser(req, res) {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout realizado com sucesso" });
}
//# sourceMappingURL=user.controller.js.map