"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.logoutUser = logoutUser;
exports.refresh = refresh;
exports.requestReset = requestReset;
exports.reset = reset;
exports.verify = verify;
exports.updateEmailAddress = updateEmailAddress;
exports.googleOAuth = googleOAuth;
exports.spotifyOAuth = spotifyOAuth;
exports.discordOAuth = discordOAuth;
const auth_service_1 = require("./auth.service");
const user_repository_1 = require("../users/user.repository");
// POST /auth/register
async function register(req, res) {
    try {
        const { username, email, password, confirmPassword } = req.body;
        // Validação básica
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Dados obrigatórios ausentes" });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Senhas não correspondem" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" });
        }
        // Register user
        const user = await (0, auth_service_1.registerUser)({ username, email, password });
        // Generate tokens
        const tokens = await (0, auth_service_1.createTokensPair)(user.id, user.email);
        // Generate email verification token and send
        const verificationToken = (0, auth_service_1.generateEmailVerificationToken)(user.id);
        // TODO: Send verification email with token
        // Set refresh token as secure cookie
        res.cookie("token", tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        // Return access token
        res.status(201).json({
            message: "Usuário registrado com sucesso",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
            accessToken: tokens.accessToken,
            expiresIn: tokens.expiresIn,
        });
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(400).json({ message: error.message || "Erro ao registrar" });
    }
}
// POST /auth/login
async function login(req, res) {
    try {
        const { email, password } = req.body;
        // Validação básica
        if (!email || !password) {
            return res.status(400).json({ message: "Email e senha são obrigatórios" });
        }
        // Find user
        const user = await (0, user_repository_1.findByEmail)(email);
        if (!user) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }
        // Compare password
        const passwordMatch = await (0, auth_service_1.comparePassword)(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }
        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({ message: "Usuário inativo" });
        }
        // Generate tokens
        const tokens = await (0, auth_service_1.createTokensPair)(user.id, user.email);
        // Set refresh token as secure cookie
        res.cookie("token", tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.status(200).json({
            message: "Login realizado com sucesso",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                emailVerified: user.email_verified,
            },
            accessToken: tokens.accessToken,
            expiresIn: tokens.expiresIn,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Erro ao fazer login" });
    }
}
// POST /auth/logout
async function logoutUser(req, res) {
    try {
        res.clearCookie("token");
        res.status(200).json({ message: "Logout realizado com sucesso" });
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Erro ao fazer logout" });
    }
}
// POST /auth/refresh
async function refresh(req, res) {
    try {
        const refreshToken = req.cookies.token || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: "Refresh token não fornecido" });
        }
        // Refresh access token
        const result = await (0, auth_service_1.refreshAccessToken)(refreshToken);
        res.status(200).json({
            message: "Token renovado com sucesso",
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
        });
    }
    catch (error) {
        console.error("Refresh error:", error);
        res.status(401).json({ message: "Refresh token inválido" });
    }
}
// POST /auth/password/request-reset
async function requestReset(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email é obrigatório" });
        }
        await (0, auth_service_1.requestPasswordReset)(email);
        // Always return success for security reasons
        res.status(200).json({
            message: "Se o email existe em nossa base de dados, você receberá um link de reset",
        });
    }
    catch (error) {
        console.error("Password reset request error:", error);
        res.status(500).json({ message: "Erro ao processar requisição" });
    }
}
// POST /auth/password/reset
async function reset(req, res) {
    try {
        const { token, password, confirmPassword } = req.body;
        if (!token || !password) {
            return res.status(400).json({ message: "Token e senha são obrigatórios" });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Senhas não correspondem" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" });
        }
        await (0, auth_service_1.resetPassword)(token, password);
        res.status(200).json({
            message: "Senha redefinida com sucesso",
        });
    }
    catch (error) {
        console.error("Password reset error:", error);
        res.status(400).json({ message: error.message || "Erro ao redefinir senha" });
    }
}
// POST /auth/email/verify
async function verify(req, res) {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: "Token é obrigatório" });
        }
        await (0, auth_service_1.verifyEmail)(token);
        res.status(200).json({
            message: "Email verificado com sucesso",
        });
    }
    catch (error) {
        console.error("Email verification error:", error);
        res.status(400).json({ message: error.message || "Erro ao verificar email" });
    }
}
// PATCH /auth/email
async function updateEmailAddress(req, res) {
    try {
        const userId = req.user?.id;
        const { email } = req.body;
        if (!userId) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        if (!email) {
            return res.status(400).json({ message: "Email é obrigatório" });
        }
        await (0, auth_service_1.updateEmail)(userId, email);
        res.status(200).json({
            message: "Email atualizado com sucesso",
        });
    }
    catch (error) {
        console.error("Update email error:", error);
        res.status(400).json({ message: error.message || "Erro ao atualizar email" });
    }
}
// GET /auth/oauth/google
async function googleOAuth(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ message: "Authorization code ausente" });
        }
        // TODO: Exchange code for tokens with Google
        // TODO: Get user info from Google
        // TODO: Create or find user
        // TODO: Generate JWT tokens
        // TODO: Redirect to frontend with tokens
        res.status(200).json({
            message: "OAuth Google iniciado",
            // Will redirect to frontend with tokens
        });
    }
    catch (error) {
        console.error("Google OAuth error:", error);
        res.status(500).json({ message: "Erro ao processar OAuth Google" });
    }
}
// GET /auth/oauth/spotify
async function spotifyOAuth(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ message: "Authorization code ausente" });
        }
        // TODO: Exchange code for tokens with Spotify
        // TODO: Get user info from Spotify
        // TODO: Create or find user
        // TODO: Generate JWT tokens
        // TODO: Redirect to frontend with tokens
        res.status(200).json({
            message: "OAuth Spotify iniciado",
            // Will redirect to frontend with tokens
        });
    }
    catch (error) {
        console.error("Spotify OAuth error:", error);
        res.status(500).json({ message: "Erro ao processar OAuth Spotify" });
    }
}
// GET /auth/oauth/discord
async function discordOAuth(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ message: "Authorization code ausente" });
        }
        // TODO: Exchange code for tokens with Discord
        // TODO: Get user info from Discord
        // TODO: Create or find user
        // TODO: Generate JWT tokens
        // TODO: Redirect to frontend with tokens
        res.status(200).json({
            message: "OAuth Discord iniciado",
            // Will redirect to frontend with tokens
        });
    }
    catch (error) {
        console.error("Discord OAuth error:", error);
        res.status(500).json({ message: "Erro ao processar OAuth Discord" });
    }
}
//# sourceMappingURL=auth.controller.js.map