"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserTable = createUserTable;
exports.createProfileTable = createProfileTable;
exports.createVerificationTokensTable = createVerificationTokensTable;
exports.createRefreshTokensTable = createRefreshTokensTable;
exports.createOAuthProvidersTable = createOAuthProvidersTable;
exports.createReviewsTable = createReviewsTable;
exports.createCommentsTable = createCommentsTable;
exports.createReportsTable = createReportsTable;
exports.createBannedUsersTable = createBannedUsersTable;
exports.createAdminTable = createAdminTable;
exports.addAdminRoleToUsers = addAdminRoleToUsers;
const init_database_1 = require("./init.database");
// Function to create the users table
async function createUserTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Users table created successfully');
    }
    catch (error) {
        console.error('Error creating users table:', error);
        throw error;
    }
}
// Function to create the profiles table
async function createProfileTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                username VARCHAR(255) NOT NULL,
                bio TEXT,
                avatar_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Profiles table created successfully');
    }
    catch (error) {
        console.error('Error creating profiles table:', error);
        throw error;
    }
}
// Function to create verification tokens table
async function createVerificationTokensTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS verification_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL UNIQUE,
                type ENUM('email_verify', 'password_reset') NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Verification tokens table created successfully');
    }
    catch (error) {
        console.error('Error creating verification tokens table:', error);
        throw error;
    }
}
// Function to create refresh tokens table
async function createRefreshTokensTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL UNIQUE,
                is_valid BOOLEAN DEFAULT TRUE,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Refresh tokens table created successfully');
    }
    catch (error) {
        console.error('Error creating refresh tokens table:', error);
        throw error;
    }
}
// Function to create OAuth providers table
async function createOAuthProvidersTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS oauth_providers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                provider VARCHAR(50) NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_provider (user_id, provider),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('OAuth providers table created successfully');
    }
    catch (error) {
        console.error('Error creating OAuth providers table:', error);
        throw error;
    }
}
// Function to create reviews table
async function createReviewsTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                album_id VARCHAR(255) NOT NULL,
                album_title VARCHAR(500),
                album_image VARCHAR(500),
                album_artist VARCHAR(500),
                rating INT CHECK (rating >= 1 AND rating <= 5),
                text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Reviews table created successfully');
    }
    catch (error) {
        console.error('Error creating reviews table:', error);
        throw error;
    }
}
// Function to create comments table
async function createCommentsTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                review_id INT,
                album_id VARCHAR(255),
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
            )
        `);
        console.log('Comments table created successfully');
    }
    catch (error) {
        console.error('Error creating comments table:', error);
        throw error;
    }
}
// Function to create reports table
async function createReportsTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reporter_id INT NOT NULL,
                reported_type ENUM('review', 'comment', 'user') NOT NULL,
                reported_id INT NOT NULL,
                reason VARCHAR(255) NOT NULL,
                description TEXT,
                status ENUM('open', 'investigating', 'resolved', 'dismissed') DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Reports table created successfully');
    }
    catch (error) {
        console.error('Error creating reports table:', error);
        throw error;
    }
}
// Function to create banned users table
async function createBannedUsersTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS banned_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                banned_by INT,
                reason TEXT,
                banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unbanned_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('Banned users table created successfully');
    }
    catch (error) {
        console.error('Error creating banned users table:', error);
        throw error;
    }
}
async function createAdminTable(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Admins table created successfully');
    }
    catch (error) {
        console.error('Error creating admins table:', error);
        throw error;
    }
}
// Function to add admin role to users table if not exists
async function addAdminRoleToUsers(req, res) {
    try {
        const connection = await (0, init_database_1.initDatabase)();
        const emailsToMakeAdmin = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : [];
        if (emailsToMakeAdmin.length === 0) {
            console.log('No admin emails specified in environment variables');
            return;
        }
        const placeholders = emailsToMakeAdmin.map(() => '?').join(', ');
        // CORREÇÃO: Trocado UPDATE por INSERT IGNORE ... SELECT
        const query = `
            INSERT IGNORE INTO admins (user_id)
            SELECT id FROM users WHERE email IN (${placeholders})
        `;
        // Executa a query passando o array de emails para preencher os placeholders (?)
        const [result] = await connection.query(query, emailsToMakeAdmin);
        console.log(`Admin role verification complete. Linhas afetadas: ${result.affectedRows}`);
    }
    catch (error) {
        console.error('Error assigning admin role to users:', error);
        throw error;
    }
}
//# sourceMappingURL=create.tables.js.map