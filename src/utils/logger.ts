import path from "path";
import fs from "fs";
import winston from "winston";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// directory for log files
const logDir = path.resolve(process.cwd(), "logs");

// Ensure the log directory exists (only outside the test environment)
if (!isTest && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Readable format for the console in development
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

// structured format for log files in production
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

// In environments that are not test, persist logs to files
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

// Stream used by morgan to forward HTTP request logs to winston
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
