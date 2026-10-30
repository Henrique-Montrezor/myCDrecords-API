import { RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { initDatabase } from "../../mysql2/init.database";
import { withTransaction } from "../../utils/withTransaction";
import type { ListImageKind } from "./lists.images";
import { LIST_ITEMS_PAGE_SIZE } from "./lists.discovery.repository";

export const LIST_IDENTITY_SELECT = `l.order_revision, l.image_revision,
    EXISTS (SELECT 1 FROM list_images image WHERE image.list_id = l.id AND image.kind = 'thumbnail') AS has_thumbnail,
    EXISTS (SELECT 1 FROM list_images image WHERE image.list_id = l.id AND image.kind = 'banner') AS has_banner`;

export async function lockOwnedList(connection: PoolConnection, listId: number, userId: number) {
    const [rows] = await connection.query<(RowDataPacket & { user_id: number; order_revision: number })[]>(
        "SELECT user_id, order_revision FROM lists WHERE id = ? FOR UPDATE", [listId],
    );
    if (!rows[0]) throw Object.assign(new Error("Lista não encontrada."), { status: 404 });
    if (Number(rows[0].user_id) !== userId) throw Object.assign(new Error("Somente o autor pode alterar esta lista."), { status: 403 });
    return rows[0];
}

export async function saveListImage(listId: number, userId: number, kind: ListImageKind, content: Buffer | null) {
    await withTransaction(async (connection) => {
        await lockOwnedList(connection, listId, userId);
        if (content) {
            await connection.query("INSERT INTO list_images (list_id, kind, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)", [listId, kind, content]);
        } else {
            await connection.query("DELETE FROM list_images WHERE list_id = ? AND kind = ?", [listId, kind]);
        }
        await connection.query("UPDATE lists SET image_revision = image_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [listId]);
    });
}

export async function readListImage(listId: number, kind: ListImageKind, userId?: number): Promise<Buffer> {
    const connection = await initDatabase();
    const [rows] = await connection.query<(RowDataPacket & { is_public: number; user_id: number; content: Buffer | null })[]>(`
        SELECT l.is_public, l.user_id,
            CASE WHEN l.is_public = TRUE OR l.user_id = ? THEN image.content ELSE NULL END AS content
        FROM lists l LEFT JOIN list_images image ON image.list_id = l.id AND image.kind = ? WHERE l.id = ?
    `, [userId ?? null, kind, listId]);
    const row = rows[0];
    if (!row) throw Object.assign(new Error("Lista não encontrada."), { status: 404 });
    if (!row.is_public && Number(row.user_id) !== userId) throw Object.assign(new Error("Esta lista é privada."), { status: 403 });
    if (!row.content) throw Object.assign(new Error("Esta lista não tem esta imagem."), { status: 404 });
    return row.content;
}

export async function moveListItem(listId: number, userId: number, input: { revision: number; itemId: number; toPosition: number }) {
    return withTransaction(async (connection) => {
        const list = await lockOwnedList(connection, listId, userId);
        if (Number(list.order_revision) !== input.revision) {
            throw Object.assign(new Error("A ordem mudou em outra sessão. Atualize a lista antes de mover novamente."), { status: 409 });
        }
        // Only IDs are read on the server; the client never downloads the whole list.
        const [rows] = await connection.query<(RowDataPacket & { id: number })[]>(
            "SELECT id FROM list_items WHERE list_id = ? ORDER BY COALESCE(position, 0), created_at, id FOR UPDATE", [listId],
        );
        const from = rows.findIndex((row) => row.id === input.itemId);
        if (from < 0) throw Object.assign(new Error("Álbum não encontrado nesta lista."), { status: 404 });
        if (input.toPosition > rows.length) throw Object.assign(new Error("A posição deve estar dentro da lista."), { status: 400 });
        const page = Math.ceil(input.toPosition / LIST_ITEMS_PAGE_SIZE);
        if (from === input.toPosition - 1) return { revision: input.revision, page };
        const [moved] = rows.splice(from, 1);
        rows.splice(input.toPosition - 1, 0, moved);
        // Normalize legacy tied positions while preserving their stable creation/ID order.
        const cases = rows.map(() => "WHEN ? THEN ?").join(" ");
        await connection.query(
            `UPDATE list_items SET position = CASE id ${cases} ELSE position END WHERE list_id = ?`,
            [...rows.flatMap((row, index) => [row.id, index]), listId],
        );
        await connection.query("UPDATE lists SET order_revision = order_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [listId]);
        return { revision: input.revision + 1, page };
    });
}
