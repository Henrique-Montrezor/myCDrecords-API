"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const artist_routes_1 = __importDefault(require("./modules/artist/artist.routes"));
const album_routes_1 = __importDefault(require("./modules/albums/album.routes"));
const track_search_routes_1 = __importDefault(require("./modules/tracks/track.search.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const user_routes_2 = __importDefault(require("./modules/users/user.routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./docs/swagger");
const init_database_1 = require("./mysql2/init.database");
const create_tables_1 = require("./mysql2/create.tables");
const profile_routes_1 = __importDefault(require("./modules/profile/profile.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
dotenv_1.default.config();
// Inicializa o Express
const app = (0, express_1.default)();
// Configurar CORS para permitir cookies
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173", // Vite development server
        "http://127.0.0.1:5173", // Vite with IP
        "http://localhost:5500", // Live Server
        "http://127.0.0.1:5500", // Live Server with IP
        process.env.FRONTEND_URL || "" // Custom frontend URL from env
    ].filter(Boolean),
    credentials: true, // Permite o envio de cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
// Middleware para parsear JSON
app.use(express_1.default.json());
// Middleware para parsear cookies
app.use((0, cookie_parser_1.default)());
// Função para inicializar o banco de dados e criar tabelas em ordem
const initializeApp = async () => {
    await (0, init_database_1.initDatabase)();
    try {
        // Cria tabelas em sequência para evitar condição de corrida
        await (0, create_tables_1.createUserTable)({}, {});
        await (0, create_tables_1.createProfileTable)({}, {});
        await (0, create_tables_1.createVerificationTokensTable)({}, {});
        await (0, create_tables_1.createRefreshTokensTable)({}, {});
        await (0, create_tables_1.createOAuthProvidersTable)({}, {});
        await (0, create_tables_1.createBannedUsersTable)({}, {});
        await (0, create_tables_1.createAdminTable)({}, {});
        // Só após a tabela `admins` existir, atribuímos os admins
        await (0, create_tables_1.addAdminRoleToUsers)({}, {});
        console.log('Database initialization complete');
    }
    catch (error) {
        console.error('Failed during database initialization:', error);
        process.exit(1);
    }
};
// Inicia a inicialização sem bloquear a definição das rotas
initializeApp();
// 🔥 Rate limit
app.use((0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 100
}));
// 📚 Swagger
app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
// Rotas de artistas, albuns e musicas (MusicBrainz)
app.use("/api/artistas", artist_routes_1.default);
app.use("/api/albuns", album_routes_1.default);
app.use("/api/musicas", track_search_routes_1.default);
// Rotas de usuário
app.use("/api/user", user_routes_1.default);
app.use("/api/user", user_routes_2.default);
// Rotas de perfil
app.use("/api/profile", profile_routes_1.default);
// Rotas de autenticação
app.use("/api/auth", auth_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
// Erros
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map