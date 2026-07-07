import express from "express";
import { createRateLimiter } from "./utils/rateLimiter";
import artistRoutes from "./modules/artist/artist.routes";
import albumRoutes from "./modules/albums/album.routes";
import trackRoutes from "./modules/tracks/track.search.routes";
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
import morgan from "morgan";
import { logger, stream } from "./utils/logger";
import adminRoutes from "./modules/admin/admin.routes";
import spotifyRoutes from "./modules/spotify/spotify.routes";
import reviewsRoutes from "./modules/reviews/reviews.routes";
import recommendationsRoutes from "./modules/recommendations/recommendations.routes";
import socialRoutes from "./modules/social/social.routes";
import listsRoutes from "./modules/lists/lists.routes";
import gamificationRoutes from "./modules/gamification/gamification.routes";

dotenv.config();

// initialize express app
const app = express();

// Configure CORS to allow cookies
app.use(cors({
    origin: [
        "http://localhost:5173",      // Vite development server
        "http://127.0.0.1:5173",      // Vite with IP
        "http://localhost:5500",      // Live Server
        "http://127.0.0.1:5500",      // Live Server with IP
        process.env.FRONTEND_URL || "" // Custom frontend URL from env
    ].filter(Boolean), 
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware to parse JSON
app.use(express.json());

// Middleware to parse cookies
app.use(cookieParser());

// Logging HTTP requests (disabled during tests)
if (process.env.NODE_ENV !== "test") {
  const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
  app.use(morgan(morganFormat, { stream }));
}

// Function to initialize the database and create tables in order
const initializeApp = async () => {
  await initDatabase();

  try {
    // Create tables in sequence to avoid race conditions
    await createUserTable({} as express.Request, {} as express.Response);
    await createProfileTable({} as express.Request, {} as express.Response);
    await createVerificationTokensTable({} as express.Request, {} as express.Response);
    await createRefreshTokensTable({} as express.Request, {} as express.Response);
    await createOAuthProvidersTable({} as express.Request, {} as express.Response);
    await createBannedUsersTable({} as express.Request, {} as express.Response);
    await createAdminTable({} as express.Request, {} as express.Response);
    await createReviewsTable({} as express.Request, {} as express.Response);

    // Social: followers and votes
    await createFollowsTable({} as express.Request, {} as express.Response);
    await createVotesTable({} as express.Request, {} as express.Response);

    // Custom lists/collections
    await createListsTable({} as express.Request, {} as express.Response);
    await createListItemsTable({} as express.Request, {} as express.Response);

    // Gamification: badges catalog + achievements + default seed
    await createBadgesTable({} as express.Request, {} as express.Response);
    await createUserBadgesTable({} as express.Request, {} as express.Response);
    await seedDefaultBadges({} as express.Request, {} as express.Response);

    // Only after the `admins` table exists, we assign the admins
    await addAdminRoleToUsers({} as express.Request, {} as express.Response);
    logger.info('Database initialization complete');
  } catch (error) {
    logger.error('Failed during database initialization', { error });
    process.exit(1);
  }
};

// Start initialization without blocking route definitions
initializeApp();

// 🔥 Rate limit global (Redis when available, memory as fallback)
app.use(createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  prefix: "rl:global:"
}));

// 🔐 Rate limit more restrictive for authentication endpoints (anti brute-force)
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: "rl:auth:",
  message: { error: "Too many attempts. Please try again later." }
});


// 📚 Swagger
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes for artists, albums, and tracks (MusicBrainz)
app.use("/api/artists", artistRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/tracks", trackRoutes);

// User routes
app.use("/api/user", userRoutes);

// Profile routes
app.use("/api/profile", profileRoutes);

// Authentication routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);

// Spotify routes
app.use("/api/spotify", spotifyRoutes);

// Reviews routes
app.use("/api/reviews", reviewsRoutes);

// Social routes (followers and votes)
app.use("/api/social", socialRoutes);

// Custom lists/collections routes
app.use("/api/lists", listsRoutes);

// Gamification routes (badges)
app.use("/api/gamification", gamificationRoutes);

// Recommendations routes
app.use("/api/recommendations", recommendationsRoutes);

// Error handling
app.use(errorHandler);

export default app;