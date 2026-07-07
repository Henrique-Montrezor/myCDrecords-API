import app from "./app";
import dotenv from 'dotenv'
import { logger } from "./utils/logger";

dotenv.config();

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  logger.info(`🚀 Server running at http://localhost:${PORT}`);
  logger.info(`📚 Docs available at http://localhost:${PORT}/docs`);
});

// capture unhandled promise rejections and uncaught exceptions to prevent the server from crashing silently
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error });
});