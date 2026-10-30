import { RowDataPacket } from "mysql2";
import { initDatabase } from "../../mysql2/init.database";
import { withTransaction } from "../../utils/withTransaction";
import { ListDiscoveryQuery } from "./lists.schema";
import { LIST_IDENTITY_SELECT } from "./lists.identity.repository";

export const LIST_PAGE_SIZE = 20;
export const LIST_ITEMS_PAGE_SIZE = 24;
export const POPULAR_WINDOW_DAYS = 30;
export const POPULAR_MIN_SAVES = 3;

type PreviewRow = RowDataPacket & { list_id: number; album_id: string; album_title: string | null; album_image: string | null };
type ListRow = RowDataPacket & { id: number; user_id: number; item_count: number; save_count: number; is_saved: number; is_public: number };

export async function exploreLists(userId: number, query: ListDiscoveryQuery) {
    const connection = await initDatabase();
    const conditions = [query.scope === "mine" ? "l.user_id = ?" : "l.is_public = TRUE"];
    const params: (number | string)[] = query.scope === "mine" ? [userId] : [];
    if (query.scope === "following" || query.scope === "friends") {
        conditions.push("EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = l.user_id)");
        params.push(userId);
        if (query.scope === "friends") {
            conditions.push("EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = l.user_id AND f.following_id = ?)");
            params.push(userId);
        }
    }
    if (query.scope === "saved") {
        conditions.push("EXISTS (SELECT 1 FROM list_saves mine WHERE mine.list_id = l.id AND mine.user_id = ?)");
        params.push(userId);
    }
    if (query.q) {
        conditions.push("(l.title LIKE ? ESCAPE '!' OR u.username LIKE ? ESCAPE '!')");
        const term = `%${query.q.replace(/[!%_]/g, "!$&")}%`;
        params.push(term, term);
    }
    const base = `
        FROM lists l JOIN users u ON u.id = l.user_id
        LEFT JOIN (
            SELECT s.list_id, COUNT(DISTINCT s.user_id) AS save_count
            FROM list_saves s JOIN lists visible ON visible.id = s.list_id AND visible.is_public = TRUE
            WHERE s.user_id <> visible.user_id AND s.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${POPULAR_WINDOW_DAYS} DAY)
            GROUP BY s.list_id
        ) popularity ON popularity.list_id = l.id
        WHERE ${conditions.join(" AND ")}
    `;
    let mode: "popular" | "recent" = query.sort;
    let ranking = mode === "popular" ? ` AND COALESCE(popularity.save_count, 0) >= ${POPULAR_MIN_SAVES}` : "";
    const count = async () => {
        const [rows] = await connection.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total ${base}${ranking}`, params);
        return Number(rows[0].total);
    };
    let total = await count();
    if (mode === "popular" && total === 0) {
        mode = "recent";
        ranking = "";
        total = await count();
    }
    const order = mode === "popular" ? "save_count DESC, l.created_at DESC, l.id DESC" : "l.created_at DESC, l.id DESC";
    const [rows] = await connection.query<ListRow[]>(`
        SELECT l.id, l.user_id, l.title, l.description, l.is_public, l.created_at, l.updated_at, u.username, ${LIST_IDENTITY_SELECT},
            (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count,
            COALESCE(popularity.save_count, 0) AS save_count,
            EXISTS (SELECT 1 FROM list_saves mine WHERE mine.list_id = l.id AND mine.user_id = ?) AS is_saved
        ${base}${ranking} ORDER BY ${order} LIMIT ? OFFSET ?
    `, [userId, ...params, LIST_PAGE_SIZE, (query.page - 1) * LIST_PAGE_SIZE]);
    const ids = rows.map((row) => row.id);
    let previews: PreviewRow[] = [];
    if (ids.length > 0) {
        const branches = ids.map(() => `(
            SELECT li.list_id, li.album_id, li.album_title, li.album_image, COALESCE(li.position, 0) AS position, li.created_at, li.id
            FROM list_items li JOIN lists l ON l.id = li.list_id
            WHERE li.list_id = ? AND (l.is_public = TRUE OR l.user_id = ?)
            ORDER BY COALESCE(li.position, 0), li.created_at, li.id LIMIT 4
        )`);
        [previews] = await connection.query<PreviewRow[]>(
            `${branches.join(" UNION ALL ")} ORDER BY list_id, position, created_at, id`,
            ids.flatMap((id) => [id, userId]),
        );
    }
    return {
        items: rows.map((row) => ({
            ...row, item_count: Number(row.item_count), save_count: Number(row.save_count),
            is_saved: Boolean(row.is_saved), is_public: Boolean(row.is_public),
            previews: previews.filter((preview) => preview.list_id === row.id)
                .map(({ album_id, album_title, album_image }) => ({ album_id, album_title, album_image })),
        })),
        total, page: query.page, pageSize: LIST_PAGE_SIZE, totalPages: Math.ceil(total / LIST_PAGE_SIZE), mode,
    };
}

export async function setListSaved(listId: number, userId: number, saved: boolean) {
    await withTransaction(async (connection) => {
        const [rows] = await connection.query<(RowDataPacket & { user_id: number; is_public: number })[]>(
            "SELECT user_id, is_public FROM lists WHERE id = ? FOR UPDATE", [listId],
        );
        if (!rows[0]) throw Object.assign(new Error("Lista não encontrada."), { status: 404 });
        if (!saved) {
            await connection.query("DELETE FROM list_saves WHERE list_id = ? AND user_id = ?", [listId, userId]);
            return;
        }
        if (!rows[0].is_public) throw Object.assign(new Error("Esta lista é privada."), { status: 403 });
        if (Number(rows[0].user_id) === userId) throw Object.assign(new Error("Sua lista já está em Minhas listas."), { status: 400 });
        await connection.query("INSERT INTO list_saves (list_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)", [listId, userId]);
    });
}
