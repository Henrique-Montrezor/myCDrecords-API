import express from "express";
import { createRateLimiter } from "./utils/rateLimiter";
import artistRoutes from "./modules/artist/artist.routes";
import albumRoutes from "./modules/albums/album.routes";
import trackRoutes from "./modules/tracks/track.search.routes";
import createUser from "./modules/users/user.routes";
import userRoutes from "./modules/users/user.routes";
import { errorHandler } from "./middlewares/error.middleware";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";
import { initDatabase } from "./mysql2/init.database";
import { 
  createProfileTable, 
  createUserTable,
  createVerificationTokensTable,
  createRefreshTokensTable,
  createOAuthProvidersTable,
  createBannedUsersTable,
  addAdminRoleToUsers,
  createAdminTable,
  createReviewsTable,
  createFollowsTable,
  createVotesTable,
  createListsTable,
  createListItemsTable,
  createBadgesTable,
  createUserBadgesTable,
  seedDefaultBadges
} from "./mysql2/create.tables";
import profileRoutes from "./modules/profile/profile.routes";
import authRoutes from "./modules/auth/auth.routes";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import adminRoutes from "./modules/admin/admin.routes";
import spotifyRoutes from "./modules/spotify/spotify.routes";
import reviewsRoutes from "./modules/reviews/reviews.routes";
import recommendationsRoutes from "./modules/recommendations/recommendations.routes";
import socialRoutes from "./modules/social/social.routes";
import listsRoutes from "./modules/lists/lists.routes";
import gamificationRoutes from "./modules/gamification/gamification.routes";

dotenv.config();

// Inicializa o Express
const app = express();

// Configurar CORS para permitir cookies
app.use(cors({
    origin: [
        "http://localhost:5173",      // Vite development server
        "http://127.0.0.1:5173",      // Vite with IP
        "http://localhost:5500",      // Live Server
        "http://127.0.0.1:5500",      // Live Server with IP
        process.env.FRONTEND_URL || "" // Custom frontend URL from env
    ].filter(Boolean), 
    credentials: true, // Permite o envio de cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware para parsear JSON
app.use(express.json());

// Middleware para parsear cookies
app.use(cookieParser());

// Função para inicializar o banco de dados e criar tabelas em ordem
const initializeApp = async () => {
  await initDatabase();

  try {
    // Cria tabelas em sequência para evitar condição de corrida
    await createUserTable({} as express.Request, {} as express.Response);
    await createProfileTable({} as express.Request, {} as express.Response);
    await createVerificationTokensTable({} as express.Request, {} as express.Response);
    await createRefreshTokensTable({} as express.Request, {} as express.Response);
    await createOAuthProvidersTable({} as express.Request, {} as express.Response);
    await createBannedUsersTable({} as express.Request, {} as express.Response);
    await createAdminTable({} as express.Request, {} as express.Response);
    await createReviewsTable({} as express.Request, {} as express.Response);

    // Social: seguidores e votos
    await createFollowsTable({} as express.Request, {} as express.Response);
    await createVotesTable({} as express.Request, {} as express.Response);

    // Listas/coleções personalizadas
    await createListsTable({} as express.Request, {} as express.Response);
    await createListItemsTable({} as express.Request, {} as express.Response);

    // Gamificação: catálogo de emblemas + conquistas + seed padrão
    await createBadgesTable({} as express.Request, {} as express.Response);
    await createUserBadgesTable({} as express.Request, {} as express.Response);
    await seedDefaultBadges({} as express.Request, {} as express.Response);

    // Só após a tabela `admins` existir, atribuímos os admins
    await addAdminRoleToUsers({} as express.Request, {} as express.Response);
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Failed during database initialization:', error);
    process.exit(1);
  }
};

// Inicia a inicialização sem bloquear a definição das rotas
initializeApp();

// 🔥 Rate limit global (Redis quando disponível, memória como fallback)
app.use(createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  prefix: "rl:global:"
}));

// 🔐 Rate limit mais restrito para endpoints de autenticação (anti brute-force)
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: "rl:auth:",
  message: { error: "Muitas tentativas. Tente novamente em instantes." }
});


// 📚 Swagger
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas de artistas, albuns e musicas (MusicBrainz)
app.use("/api/artistas", artistRoutes);
app.use("/api/albuns", albumRoutes);
app.use("/api/musicas", trackRoutes);

// Rotas de usuário
app.use("/api/user", createUser);
app.use("/api/user", userRoutes);

// Rotas de perfil
app.use("/api/profile", profileRoutes);

// Rotas de autenticação
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);

// Rotas de Spotify
app.use("/api/spotify", spotifyRoutes);

// Rotas de reviews
app.use("/api/reviews", reviewsRoutes);

// Rotas sociais (seguidores e votos)
app.use("/api/social", socialRoutes);

// Rotas de listas/coleções
app.use("/api/lists", listsRoutes);

// Rotas de gamificação (emblemas)
app.use("/api/gamification", gamificationRoutes);

// Erros
app.use(errorHandler);

// Recomendacoes
app.use("/api/recommendations", recommendationsRoutes);


export default app;