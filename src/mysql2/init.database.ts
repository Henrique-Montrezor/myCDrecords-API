import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

let pool: Pool | null = null;

// Builds the SSL config. Aiven requires SSL (ssl-mode=REQUIRED).
// If a CA certificate path is provided, it is used to verify the server
// certificate; otherwise SSL is still enabled without CA verification.
function buildSslConfig(): PoolOptions['ssl'] | undefined {
    if (String(process.env.MYSQL_SSL).toLowerCase() === 'false') {
        return undefined;
    }

    const caPath = process.env.MYSQL_SSL_CA;
    if (caPath && fs.existsSync(caPath)) {
        return {
            ca: fs.readFileSync(caPath, 'utf8'),
            rejectUnauthorized: true
        };
    }

    return {
        rejectUnauthorized:
            String(process.env.MYSQL_SSL_REJECT_UNAUTHORIZED).toLowerCase() !== 'false'
    };
}

// Creates (only once) and returns the shared connection pool.
function getPool(): Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            port: Number(process.env.MYSQL_PORT) || 3306,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            ssl: buildSslConfig(),
            waitForConnections: true,
            connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 10,
            queueLimit: 0
        });
    }
    return pool;
}

// Keeps the signature used by all repositories. The pool exposes the same
// `.query()` / `.execute()` API as a connection, so no repository
// needs to change.
export async function initDatabase(): Promise<Pool> {
    try {
        const currentPool = getPool();
        // Validates the connection on the first call (fails early if the database is down).
        const connection = await currentPool.getConnection();
        connection.release();
        return currentPool;
    } catch (error) {
        logger.error('Error connecting to the database', { error });
        throw error;
    }
}

export { getPool };
