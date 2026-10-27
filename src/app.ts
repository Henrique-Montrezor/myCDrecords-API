import express from "express";
import { createRateLimiter } from "./utils/rateLimiter";
import artistRoutes from "./modules/artist/artist.routes";
import albumRoutes from "./modules/albums/album.routes";
import trackRoutes from "./modules/tracks/track.search.routes";
import userRoutes from "./modules/users/user.routes";
import { errorHandler } from "./middlewares/error.middleware";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";
import { initDatabase, getPool } from "./mysql2/init.database";
import { 
  createProfileTable, 
  createProfileFavoritesTable,
  createUserTable,
  createVerificationTokensTable,
  createRefreshTokensTable,
  createOAuthProvidersTable,
  createBannedUsersTable,
  addAdminRoleToUsers,
  createAdminTable,
  createReviewsTable,
  createCommentsTable,
  createReportsTable,
  createFollowsTable,
  createVotesTable,
  createListsTable,
  createListItemsTable,
  createBadgesTable,
  createUserBadgesTable,
  seedDefaultBadges
} from "./mysql2/create.tables";
import profileRoutes from "./modules/profile/profile.routes";
import { UPLOADS_DIR } from "./modules/profile/profile.images";
import authRoutes from "./modules/auth/auth.routes";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
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
const isProduction = process.env.NODE_ENV === "production";

app.use(requestIdMiddleware);

// JSON-only API: helmet defaults, but uploaded avatars must load from the client origin
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Production only trusts FRONTEND_URL; local dev servers are allowed outside production
const devOrigins = [
    "http://localhost:5173",      // Vite development server
    "http://127.0.0.1:5173",      // Vite with IP
    "http://localhost:5500",      // Live Server
    "http://127.0.0.1:5500",      // Live Server with IP
];
app.use(cors({
    origin: [...(isProduction ? [] : devOrigins), process.env.FRONTEND_URL || ""].filter(Boolean),
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"]
}));

// Middleware to parse JSON
app.use(express.json({ limit: "100kb" }));

// Middleware to parse cookies
app.use(cookieParser());

// Logging HTTP requests (disabled during tests)
if (process.env.NODE_ENV !== "test") {
  morgan.token("id", (req) => (req as express.Request).requestId ?? "-");
  const morganFormat = isProduction
    ? ':id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
    : ":method :url :status :response-time ms - :id";
  app.use(morgan(morganFormat, { stream }));
}

// Function to initialize the database and create tables in order
const initializeApp = async () => {
  await initDatabase();

  try {
    // Create tables in sequence to avoid race conditions
    await createUserTable({} as express.Request, {} as express.Response);
    await createProfileTable({} as express.Request, {} as express.Response);
    await createProfileFavoritesTable({} as express.Request, {} as express.Response);
    await createVerificationTokensTable({} as express.Request, {} as express.Response);
    await createRefreshTokensTable({} as express.Request, {} as express.Response);
    await createOAuthProvidersTable({} as express.Request, {} as express.Response);
    await createBannedUsersTable({} as express.Request, {} as express.Response);
    await createAdminTable({} as express.Request, {} as express.Response);
    await createReviewsTable({} as express.Request, {} as express.Response);

    // Review deletion and admin moderation query these tables
    await createCommentsTable({} as express.Request, {} as express.Response);
    await createReportsTable({} as express.Request, {} as express.Response);
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

// Liveness and readiness probes stay outside the rate limit and never touch Spotify
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Liveness probe
 *     description: Responds while the process is up, without touching the database or Spotify.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: "{ status: 'ok' }"
 * /ready:
 *   get:
 *     summary: Readiness probe
 *     description: Checks the MySQL connection (required dependency). Spotify and Redis are optional and not checked.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: "{ status: 'ready', database: 'up' }"
 *       503:
 *         description: "{ status: 'unavailable', database: 'down' }"
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", async (_req, res) => {
  try {
    await getPool().query("SELECT 1");
    res.json({ status: "ready", database: "up" });
  } catch (error) {
    logger.error("Readiness check failed", { error });
    res.status(503).json({ status: "unavailable", database: "down" });
  }
});

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

// Uploaded avatars and banners (random file names, so they can be cached for good)
app.use("/uploads", express.static(UPLOADS_DIR, {
  maxAge: "30d",
  immutable: true,
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}));

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