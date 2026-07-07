import { PoolConnection } from "mysql2/promise";
import { getPool } from "../mysql2/init.database";
import { logger } from "./logger";

/**
     * Execute a function within a database transaction.
     * Commits the transaction if the function succeeds and rolls back if an error occurs,
     * always releasing the connection back to the pool.
     */
export async function withTransaction<T>(
    fn: (connection: PoolConnection) => Promise<T>
): Promise<T> {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            logger.error("Error executing ROLLBACK", { error: rollbackError });
        }
        throw error;
    } finally {
        connection.release();
    }
}
