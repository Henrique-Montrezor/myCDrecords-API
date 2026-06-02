"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateProfileController = createOrUpdateProfileController;
exports.searchProfileByUsername = searchProfileByUsername;
const profile_repository_1 = require("./profile.repository");
// Criar ou atualizar perfil
async function createOrUpdateProfileController(req, res) {
    try {
        const user_id = req.user?.id; // get user_id from JWT token
        if (!user_id) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        const { bio, avatar_url } = req.body;
        if (!bio || !avatar_url) {
            return res.status(400).json({
                message: "Bio e avatar_url são obrigatórios"
            });
        }
        await (0, profile_repository_1.createOrUpdateProfile)(user_id, { user_id, bio, avatar_url }, avatar_url);
        res.status(200).json({
            message: "Perfil criado ou atualizado com sucesso",
            user_id
        });
    }
    catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}
// search the profile by username and return the profile data
async function searchProfileByUsername(req, res) {
    try {
        const { username } = req.params;
        const profile = await (0, profile_repository_1.getProfileByUsername)({ username });
        if (!profile) {
            return res.status(404).json({ message: "Perfil não encontrado" });
        }
        res.status(200).json(profile);
    }
    catch (error) {
        console.error('Erro ao obter perfil:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}
//# sourceMappingURL=profile.controller.js.map