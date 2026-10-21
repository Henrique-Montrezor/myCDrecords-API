import { RowDataPacket } from "mysql2/typings/mysql/lib/protocol/packets/RowDataPacket";
import { initDatabase } from "../../mysql2/init.database";
import { Profile, UsernameProfile } from "./profile.entity";
import { logger } from "../../utils/logger";
import { withTransaction } from "../../utils/withTransaction";
import type { FavoriteAlbumInput } from "./profile.schema";


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

// Public profile with counters and whether the viewer follows the user
export async function getPublicProfile(username: string, viewerId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
            u.id,
            u.username,
            p.bio,
            p.avatar_url,
            p.banner_url,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following,
            (SELECT COUNT(*) FROM reviews WHERE user_id = u.id) AS reviews,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.username = ? AND u.is_active = 1`,
        [viewerId, username]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
        id: row.id as number,
        username: row.username as string,
        bio: (row.bio as string | null) ?? null,
        avatar_url: (row.avatar_url as string | null) ?? null,
        banner_url: (row.banner_url as string | null) ?? null,
        followers: Number(row.followers),
        following: Number(row.following),
        reviews: Number(row.reviews),
        is_following: Boolean(row.is_following),
        is_self: row.id === viewerId,
    };
}

// Sets (or clears) the avatar/banner URL, creating the profile row if needed; returns the previous URL
export async function setProfileImage(userId: number, kind: "avatar" | "banner", url: string | null) {
    const column = kind === "avatar" ? "avatar_url" : "banner_url";
    const connection = await initDatabase();
    const [previous] = await connection.query<RowDataPacket[]>(`SELECT ${column} AS url FROM profiles WHERE user_id = ?`, [userId]);
    await connection.query(
        `INSERT INTO profiles (user_id, username, ${column})
         SELECT id, username, ? FROM users WHERE id = ?
         ON DUPLICATE KEY UPDATE ${column} = VALUES(${column})`,
        [url, userId]
    );
    return (previous[0]?.url as string | null | undefined) ?? null;
}

// Favorite albums of a user, ordered by slot
export async function getFavorites(userId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT position, album_id, album_title, album_image, album_artist
         FROM profile_favorites
         WHERE user_id = ?
         ORDER BY position ASC`,
        [userId]
    );
    return rows || [];
}

// Replaces the whole favorites set atomically; array order defines the slot
export async function replaceFavorites(userId: number, albums: FavoriteAlbumInput[]) {
    await withTransaction(async (connection) => {
        await connection.query(`DELETE FROM profile_favorites WHERE user_id = ?`, [userId]);
        for (const [index, album] of albums.entries()) {
            await connection.query(
                `INSERT INTO profile_favorites (user_id, position, album_id, album_title, album_image, album_artist)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, index + 1, album.albumId, album.albumTitle ?? null, album.albumImage ?? null, album.albumArtist ?? null]
            );
        }
    });
}

// Reviews written and reviews liked by a user, newest first
export async function getUserActivity(userId: number, page: number) {
    const connection = await initDatabase();
    const offset = (page - 1) * 10;
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM (
            SELECT 'review' AS type, r.id AS review_id, r.album_id, r.album_title, r.album_image, r.album_artist,
                   r.rating, r.text, NULL AS author_username, r.created_at
            FROM reviews r
            WHERE r.user_id = ?
            UNION ALL
            SELECT 'like' AS type, r.id AS review_id, r.album_id, r.album_title, r.album_image, r.album_artist,
                   r.rating, r.text, a.username AS author_username, v.created_at
            FROM votes v
            JOIN reviews r ON r.id = v.target_id
            JOIN users a ON a.id = r.user_id
            WHERE v.user_id = ? AND v.target_type = 'review' AND v.value = 1 AND r.user_id <> v.user_id
         ) activity
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, userId, 10, offset]
    );
    return rows || [];
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