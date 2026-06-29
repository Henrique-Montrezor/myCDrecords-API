import app from "./app";
import dotenv from 'dotenv'
import { logger } from "./utils/logger";

dotenv.config();

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  logger.info(`🚀 Servidor rodando em http://localhost:${PORT}`);
  logger.info(`📚 Docs em http://localhost:${PORT}/docs`);
});

// Captura erros não tratados para facilitar o diagnóstico em produção
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error });
});