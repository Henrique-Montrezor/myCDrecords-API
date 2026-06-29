import {Request, Response} from 'express';
import {initDatabase} from "./init.database";
import { logger } from "../utils/logger";


// Function to create the users table
export async function createUserTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                spotify_access_token VARCHAR(500),
                spotify_refresh_token VARCHAR(500),
                spotify_token_expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        logger.info('Users table created successfully');
        
        // Try to add new columns if they don't exist (for existing tables)
        try {
            await connection.query(`ALTER TABLE users ADD COLUMN spotify_access_token VARCHAR(500) DEFAULT NULL`);
            await connection.query(`ALTER TABLE users ADD COLUMN spotify_refresh_token VARCHAR(500) DEFAULT NULL`);
            await connection.query(`ALTER TABLE users ADD COLUMN spotify_token_expires_at TIMESTAMP NULL`);
            logger.info('Spotify columns added successfully');
        } catch (alterError: any) {
            // Columns might already exist, that's fine
            if (!alterError.message.includes('Duplicate column')) {
                logger.warn('Spotify columns might already exist', { detail: alterError.message });
            }
        }
    } catch (error) {
        logger.error('Error creating users table', { error });
        throw error;
    }
}

// Function to create the profiles table
export async function createProfileTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('Profiles table created successfully'); 
    } catch (error) {
        logger.error('Error creating profiles table', { error });
        throw error;
    }
}

// Function to create verification tokens table
export async function createVerificationTokensTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('Verification tokens table created successfully');
    } catch (error) {
        logger.error('Error creating verification tokens table', { error });
        throw error;
    }
}

// Function to create refresh tokens table
export async function createRefreshTokensTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('Refresh tokens table created successfully');
    } catch (error) {
        logger.error('Error creating refresh tokens table', { error });
        throw error;
    }
}

// Function to create OAuth providers table
export async function createOAuthProvidersTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('OAuth providers table created successfully');
    } catch (error) {
        logger.error('Error creating OAuth providers table', { error });
        throw error;
    }
}

// Function to create reviews table
export async function createReviewsTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                album_id VARCHAR(255) NOT NULL,
                album_title VARCHAR(500),
                album_image VARCHAR(500),
                album_artist VARCHAR(500),
                album_genre VARCHAR(500),
                rating INT CHECK (rating >= 1 AND rating <= 5),
                text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        logger.info('Reviews table created successfully');
    } catch (error) {
        logger.error('Error creating reviews table', { error });
        throw error;
    }
}

// Function to create comments table
export async function createCommentsTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('Comments table created successfully');
    } catch (error) {
        logger.error('Error creating comments table', { error });
        throw error;
    }
}

// Function to create reports table
export async function createReportsTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('Reports table created successfully');
    } catch (error) {
        logger.error('Error creating reports table', { error });
        throw error;
    }
}

// Function to create banned users table
export async function createBannedUsersTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
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
        logger.info('Banned users table created successfully');
    } catch (error) {
        logger.error('Error creating banned users table', { error });
        throw error;
    }
}

export async function createAdminTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        logger.info('Admins table created successfully');
    } catch (error) {
        logger.error('Error creating admins table', { error });
        throw error;
    }
}

// Function to add admin role to users table if not exists
export async function addAdminRoleToUsers(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        
        const emailsToMakeAdmin = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : [];

        if (emailsToMakeAdmin.length === 0) {
            logger.info('No admin emails specified in environment variables');
            return;
        }

        const placeholders = emailsToMakeAdmin.map(() => '?').join(', ');
        
        // CORREÇÃO: Trocado UPDATE por INSERT IGNORE ... SELECT
        const query = `
            INSERT IGNORE INTO admins (user_id)
            SELECT id FROM users WHERE email IN (${placeholders})
        `;

        // Executa a query passando o array de emails para preencher os placeholders (?)
        const [result]: any = await connection.query(query, emailsToMakeAdmin);
        
        logger.info(`Admin role verification complete. Linhas afetadas: ${result.affectedRows}`);
    }
    catch (error) {
        logger.error('Error assigning admin role to users', { error });
        throw error;
    }
}

//function to create the Reviews tables
export async function createReviewTables(req: Request, res: Response) {
    const connection = await initDatabase();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                album_id VARCHAR(255) NOT NULL,
                rating INT NOT NULL,
                text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            )
        `);
        logger.info('Reviews table created successfully');
    } catch (error) {
        logger.error('Error creating reviews table', { error });
        throw error;
    }
};

// Function to create the follows table (social: seguir usuários)
export async function createFollowsTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS follows (
                id INT AUTO_INCREMENT PRIMARY KEY,
                follower_id INT NOT NULL,
                following_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_follow (follower_id, following_id),
                CHECK (follower_id <> following_id),
                FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        logger.info('Follows table created successfully');
    } catch (error) {
        logger.error('Error creating follows table', { error });
        throw error;
    }
}

// Function to create the votes table (social: up/downvotes em reviews e comentários)
export async function createVotesTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                target_type ENUM('review', 'comment') NOT NULL,
                target_id INT NOT NULL,
                value TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_vote (user_id, target_type, target_id),
                CHECK (value IN (-1, 1)),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        logger.info('Votes table created successfully');
    } catch (error) {
        logger.error('Error creating votes table', { error });
        throw error;
    }
}

// Function to create the lists table (coleções/listas personalizadas)
export async function createListsTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS lists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                is_public BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_list_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        logger.info('Lists table created successfully');
    } catch (error) {
        logger.error('Error creating lists table', { error });
        throw error;
    }
}

// Function to create the list_items table (álbuns dentro de uma lista)
export async function createListItemsTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS list_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                list_id INT NOT NULL,
                album_id VARCHAR(255) NOT NULL,
                album_title VARCHAR(500),
                album_image VARCHAR(500),
                album_artist VARCHAR(500),
                position INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_list_album (list_id, album_id),
                FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
            )
        `);
        logger.info('List items table created successfully');
    } catch (error) {
        logger.error('Error creating list_items table', { error });
        throw error;
    }
}

// Function to create the badges catalog table (gamificação)
export async function createBadgesTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS badges (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                threshold INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        logger.info('Badges table created successfully');
    } catch (error) {
        logger.error('Error creating badges table', { error });
        throw error;
    }
}

// Function to create the user_badges table (emblemas conquistados por usuário)
export async function createUserBadgesTable(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                badge_id INT NOT NULL,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_badge (user_id, badge_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
            )
        `);
        logger.info('User badges table created successfully');
    } catch (error) {
        logger.error('Error creating user_badges table', { error });
        throw error;
    }
}

// Seed dos emblemas padrão baseados em quantidade de avaliações
export async function seedDefaultBadges(req: Request, res: Response) {
    try {
        const connection = await initDatabase();
        await connection.query(`
            INSERT IGNORE INTO badges (code, name, description, threshold) VALUES
                ('critico_novato', 'Crítico Novato', 'Publicou 10 avaliações', 10),
                ('ouvinte_assiduo', 'Ouvinte Assíduo', 'Publicou 50 avaliações', 50),
                ('lenda_da_critica', 'Lenda da Crítica', 'Publicou 100 avaliações', 100)
        `);
        logger.info('Default badges seeded successfully');
    } catch (error) {
        logger.error('Error seeding default badges', { error });
        throw error;
    }
}