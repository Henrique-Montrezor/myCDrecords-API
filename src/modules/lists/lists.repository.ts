import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface ListItemInput {
    albumId: string;
    albumTitle?: string;
    albumImage?: string;
    albumArtist?: string;
    position?: number;
}

// Creates a new list
export async function createList(
    userId: number,
    title: string,
    description: string | undefined,
    isPublic: boolean
) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO lists (user_id, title, description, is_public) VALUES (?, ?, ?, ?)`,
        [userId, title, description ?? null, isPublic]
    );
    return result.insertId;
}

// Lists a user's lists (optionally only the public ones) with item count
export async function getListsByUser(userId: number, onlyPublic: boolean) {
    const connection = await initDatabase();
    const visibility = onlyPublic ? "AND l.is_public = TRUE" : "";
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
            l.id,
            l.user_id,
            l.title,
            l.description,
            l.is_public,
            l.created_at,
            l.updated_at,
            (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count
         FROM lists l
         WHERE l.user_id = ? ${visibility}
         ORDER BY l.created_at DESC`,
        [userId]
    );
    return rows || [];
}

// Fetches a list by ID
export async function getListById(listId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, user_id, title, description, is_public, created_at, updated_at
         FROM lists WHERE id = ?`,
        [listId]
    );
    return rows[0] || null;
}

// Items of a list
export async function getListItems(listId: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, list_id, album_id, album_title, album_image, album_artist, position, created_at
         FROM list_items
         WHERE list_id = ?
         ORDER BY position ASC, created_at ASC`,
        [listId]
    );
    return rows || [];
}

// Updates a list ensuring ownership
export async function updateList(
    listId: number,
    userId: number,
    fields: { title?: string; description?: string; isPublic?: boolean }
) {
    const connection = await initDatabase();
    const sets: string[] = [];
    const params: any[] = [];

    if (fields.title !== undefined) {
        sets.push("title = ?");
        params.push(fields.title);
    }
    if (fields.description !== undefined) {
        sets.push("description = ?");
        params.push(fields.description);
    }
    if (fields.isPublic !== undefined) {
        sets.push("is_public = ?");
        params.push(fields.isPublic);
    }

    if (sets.length === 0) {
        return false;
    }

    params.push(listId, userId);
    const [result] = await connection.query<ResultSetHeader>(
        `UPDATE lists SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
        params
    );
    return result.affectedRows > 0;
}

// Removes a list (items are removed via ON DELETE CASCADE)
export async function deleteList(listId: number, userId: number) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM lists WHERE id = ? AND user_id = ?`,
        [listId, userId]
    );
    return result.affectedRows > 0;
}

// Adds an album to the list (idempotent via UNIQUE list_id+album_id)
export async function addListItem(listId: number, item: ListItemInput) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `INSERT IGNORE INTO list_items
            (list_id, album_id, album_title, album_image, album_artist, position)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            listId,
            item.albumId,
            item.albumTitle ?? null,
            item.albumImage ?? null,
            item.albumArtist ?? null,
            item.position ?? 0,
        ]
    );
    return result.affectedRows > 0;
}

// Removes an album from the list
export async function removeListItem(listId: number, albumId: string) {
    const connection = await initDatabase();
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM list_items WHERE list_id = ? AND album_id = ?`,
        [listId, albumId]
    );
    return result.affectedRows > 0;
}

// Returns the owner of a list (or null)
export async function getListOwner(listId: number): Promise<number | null> {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT user_id FROM lists WHERE id = ?`,
        [listId]
    );
    return rows.length > 0 ? Number(rows[0].user_id) : null;
}
