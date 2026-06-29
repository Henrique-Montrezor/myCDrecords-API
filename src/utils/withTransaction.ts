import { PoolConnection } from "mysql2/promise";
import { getPool } from "../mysql2/init.database";
import { logger } from "./logger";

/**
 * Executa `fn` dentro de uma transação SQL usando uma única conexão do pool.
 * Faz COMMIT em caso de sucesso e ROLLBACK em caso de erro, sempre liberando
 * a conexão de volta para o pool.
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
            logger.error("Erro ao executar ROLLBACK", { error: rollbackError });
        }
        throw error;
    } finally {
        connection.release();
    }
}
