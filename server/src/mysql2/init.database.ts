import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Function to initialize the database connection
export async function initDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });
        return connection;
    } catch (error) {
        console.error('Error connecting to the database:', error);
        throw error;
    }
} 