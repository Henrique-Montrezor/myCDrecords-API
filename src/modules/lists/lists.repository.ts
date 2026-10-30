import { initDatabase } from "../../mysql2/init.database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { withTransaction } from "../../utils/withTransaction";
import { LIST_ITEMS_PAGE_SIZE } from "./lists.discovery.repository";
import { LIST_IDENTITY_SELECT, lockOwnedList } from "./lists.identity.repository";

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
            ${LIST_IDENTITY_SELECT},
            (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count
         FROM lists l
         WHERE l.user_id = ? ${visibility}
         ORDER BY l.created_at DESC`,
        [userId]
    );
    return rows || [];
}

// Fetches a list by ID
export async function getListById(listId: number, userId?: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT l.id, l.user_id, l.title, l.description, l.is_public, l.created_at, l.updated_at, u.username, ${LIST_IDENTITY_SELECT},
            (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count,
            EXISTS (SELECT 1 FROM list_saves s WHERE s.list_id = l.id AND s.user_id = ?) AS is_saved
         FROM lists l JOIN users u ON u.id = l.user_id WHERE l.id = ?`,
        [userId ?? null, listId]
    );
    return rows[0] || null;
}

// Items of a list
export async function getListItems(listId: number, page = 1, userId?: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT li.id, li.list_id, li.album_id, li.album_title, li.album_image, li.album_artist, li.position, li.created_at
         FROM list_items li JOIN lists l ON l.id = li.list_id
         WHERE li.list_id = ? AND (l.is_public = TRUE OR l.user_id = ?)
         ORDER BY COALESCE(li.position, 0) ASC, li.created_at ASC, li.id ASC LIMIT ? OFFSET ?`,
        [listId, userId ?? null, LIST_ITEMS_PAGE_SIZE, (page - 1) * LIST_ITEMS_PAGE_SIZE]
    );
    return rows || [];
}

// Updates a list ensuring ownership
export async function updateList(
    listId: number,
    userId: number,
    fields: { title?: string; description?: string; isPublic?: boolean }
) {
    const sets: string[] = [];
    const params: (string | boolean | number)[] = [];

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
    return withTransaction(async (connection) => {
        const [result] = await connection.query<ResultSetHeader>(
            `UPDATE lists SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
            params
        );
        if (result.affectedRows > 0 && fields.isPublic === false) {
            await connection.query("DELETE FROM list_saves WHERE list_id = ?", [listId]);
        }
        return result.affectedRows > 0;
    });
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
export async function addListItem(listId: number, item: ListItemInput, userId: number) {
    return withTransaction(async (connection) => {
        await lockOwnedList(connection, listId, userId);
        const [existing] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM list_items WHERE list_id = ? AND album_id = ?", [listId, item.albumId],
        );
        if (existing.length > 0) return false;
        const [positions] = await connection.query<(RowDataPacket & { next_position: number })[]>(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM list_items WHERE list_id = ?", [listId],
        );
        await connection.query(
            `INSERT INTO list_items
               (list_id, album_id, album_title, album_image, album_artist, position)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
               listId,
               item.albumId,
               item.albumTitle ?? null,
               item.albumImage ?? null,
               item.albumArtist ?? null,
               item.position ?? Number(positions[0].next_position),
            ]
        );
        await connection.query("UPDATE lists SET order_revision = order_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [listId]);
        return true;
    });
}

// Removes an album from the list
export async function removeListItem(listId: number, albumId: string, userId: number) {
    return withTransaction(async (connection) => {
        await lockOwnedList(connection, listId, userId);
        const [result] = await connection.query<ResultSetHeader>(
            `DELETE FROM list_items WHERE list_id = ? AND album_id = ?`, [listId, albumId],
        );
        if (result.affectedRows > 0) {
            await connection.query("UPDATE lists SET order_revision = order_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [listId]);
        }
        return result.affectedRows > 0;
    });
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
