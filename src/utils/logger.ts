import path from "path";
import fs from "fs";
import winston from "winston";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// Diretório onde os arquivos de log serão salvos
const logDir = path.resolve(process.cwd(), "logs");

// Garante que o diretório de logs exista (apenas fora do ambiente de testes)
if (!isTest && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato legível para o console em desenvolvimento
const consoleFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaKeys = Object.keys(meta).filter((key) => key !== "splat");
    const metaStr = metaKeys.length
      ? ` ${JSON.stringify(metaKeys.reduce((acc, key) => ({ ...acc, [key]: (meta as Record<string, unknown>)[key] }), {}))}`
      : "";
    return `${ts} [${level}]: ${stack || message}${metaStr}`;
  })
);

// Formato estruturado (JSON) para arquivos e produção
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? fileFormat : consoleFormat,
    silent: isTest,
  }),
];

// Em ambientes que não são de teste, persistimos os logs em arquivos
if (!isTest) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: fileFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: "mycdrecords-api" },
  transports,
});

// Stream usado pelo morgan para encaminhar logs de requisições HTTP ao winston
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
