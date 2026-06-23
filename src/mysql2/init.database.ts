import mysql, { Pool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | null = null;

// Cria (uma única vez) e retorna o pool de conexões compartilhado.
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

// Mantém a assinatura usada por todos os repositórios. O pool expõe a mesma
// API `.query()` / `.execute()` de uma conexão, portanto nenhum repositório
// precisa mudar.
export async function initDatabase(): Promise<Pool> {
    try {
        const currentPool = getPool();
        // Valida a conexão na primeira chamada (falha cedo se o banco estiver fora).
        const connection = await currentPool.getConnection();
        connection.release();
        return currentPool;
    } catch (error) {
        console.error('Error connecting to the database:', error);
        throw error;
    }
}

export { getPool };
