import { RowDataPacket } from "mysql2/typings/mysql/lib/protocol/packets/RowDataPacket";
import { initDatabase } from "../../mysql2/init.database";
import { Profile, UsernameProfile } from "./profile.entity";
import { logger } from "../../utils/logger";


// Function to create a new profile
export async function createOrUpdateProfile(user_id: number, Profile: Profile, avatar_url: any): Promise<Profile> {
    try {
        const connection = await initDatabase();

        // Get username from users table
        const [userRows] = await connection.query<RowDataPacket[]>(
            'SELECT username FROM users WHERE id = ?', [user_id]
        );

        if (userRows.length === 0) {
            throw new Error('User not found');
        }

        const username = userRows[0].username;

        // Check if a profile already exists for the given user_id
        const [existingProfile] = await connection.query<RowDataPacket[]>(
            'SELECT id FROM profiles WHERE user_id = ?', [Profile.user_id]
        );

        // If a profile already exists for the user, update it; otherwise, create a new one
        if (existingProfile.length > 0) {
            await connection.query('UPDATE profiles SET username = ?, bio = ?, avatar_url = ? WHERE user_id = ?', [username, Profile.bio, Profile.avatar_url, Profile.user_id]);
            return { ...Profile, username, id: existingProfile[0].id };
        } else {
            // Create a new profile if it doesn't exist
            await connection.query('INSERT INTO profiles (user_id, username, bio, avatar_url) VALUES (?, ?, ?, ?)', [Profile.user_id, username, Profile.bio, Profile.avatar_url]);
            const [result] = await connection.query<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id');
            return { ...Profile, username, id: result[0].id };
        }
    } catch (error) {
        logger.error('Error creating/updating profile', { error });
        throw error;
    }
}
        

// Get a user profile by username
export async function getProfileByUsername(UsernameProfile: UsernameProfile): Promise<UsernameProfile | null> {
    try {
        const connection = await initDatabase();

        const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM profiles WHERE username = ?', [UsernameProfile.username]);

        return rows.length > 0 ? { ...UsernameProfile, username: rows[0].username } : null;
    } catch (error) {
        logger.error('Error fetching profile', { error });
        throw error;
    }
}

export async function getmyprofile(user_id: number): Promise<Profile | null> {
    try {
        const connection = await initDatabase();

        const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM profiles WHERE user_id = ?', [user_id]);

        return rows.length > 0 ? { ...rows[0] } as Profile : null;
    } catch (error) {
        logger.error('Error fetching profile', { error });
        throw error;
    }
}



// Delete profile
//export async function deleteProfile(user_id: number)

// Get all user data with their profile (JOIN)
//export async function getUserWithProfile(user_id: number)