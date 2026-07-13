import { Request, Response } from "express";
import {
    createList,
    getListsByUser,
    getListById,
    getListItems,
    updateList,
    deleteList,
    addListItem,
    removeListItem,
    getListOwner,
} from "./lists.repository";
import {
    createListSchema,
    updateListSchema,
    listItemSchema,
    listIdParamSchema,
    listItemParamSchema,
    userIdParamSchema,
} from "./lists.schema";

// POST /api/lists
export async function createListController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { title, description, isPublic } = createListSchema.parse(req.body);
    const listId = await createList(userId, title, description, isPublic);
    res.status(201).json({ listId });
}

// GET /api/lists/me
export async function myListsController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const lists = await getListsByUser(userId, false);
    res.json(lists);
}

// GET /api/lists/user/:userId  (only public lists, unless it is the owner)
export async function userListsController(req: Request, res: Response) {

    const { userId } = userIdParamSchema.parse(req.params);
    const isOwner = req.user?.id === Number(userId);
    const lists = await getListsByUser(Number(userId), !isOwner);
    res.json(lists);
}

// GET /api/lists/:listId
export async function getListController(req: Request, res: Response) {

    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { listId } = listIdParamSchema.parse(req.params);

    const list = await getListById(listId);
    if (!list) {
        return res.status(404).json({ error: "List not found" });
    }

    const isOwner = req.user?.id === Number(list.user_id);
    if (!list.is_public && !isOwner) {
        return res.status(403).json({ error: "Private list" });
    }

    const items = await getListItems(listId);
    res.json({ ...list, items });
}

// PUT /api/lists/:listId
export async function updateListController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { listId } = listIdParamSchema.parse(req.params);
    const fields = updateListSchema.parse(req.body);

    const updated = await updateList(listId, userId, fields);
    if (!updated) {
        return res.status(404).json({ error: "List not found or access denied" });
    }

    res.status(200).json({ message: "List updated successfully" });
}

// DELETE /api/lists/:listId
export async function deleteListController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { listId } = listIdParamSchema.parse(req.params);
    const removed = await deleteList(listId, userId);
    if (!removed) {
        return res.status(404).json({ error: "List not found or access denied" });
    }

    res.status(204).send();
}

// POST /api/lists/:listId/items
export async function addListItemController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { listId } = listIdParamSchema.parse(req.params);
    const item = listItemSchema.parse(req.body);

    const owner = await getListOwner(listId);
    if (owner === null) {
        return res.status(404).json({ error: "List not found" });
    }
    if (owner !== userId) {
        return res.status(403).json({ error: "Access denied" });
    }

    const added = await addListItem(listId, item);
    if (!added) {
        return res.status(409).json({ error: "Album is already in the list" });
    }

    res.status(201).json({ message: "Album added to the list" });
}

// DELETE /api/lists/:listId/items/:albumId
export async function removeListItemController(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const { listId, albumId } = listItemParamSchema.parse(req.params);

    const owner = await getListOwner(listId);
    if (owner === null) {
        return res.status(404).json({ error: "List not found" });
    }
    if (owner !== userId) {
        return res.status(403).json({ error: "Access denied" });
    }

    const removed = await removeListItem(listId, albumId);
    if (!removed) {
        return res.status(404).json({ error: "Album not found in the list" });
    }

    res.status(204).send();
}
