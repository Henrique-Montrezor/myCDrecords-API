import mysql, { Pool } from 'mysql2/promise';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

let pool: Pool | null = null;

// Creates (only once) and returns the shared connection pool.
function getPool(): Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
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
