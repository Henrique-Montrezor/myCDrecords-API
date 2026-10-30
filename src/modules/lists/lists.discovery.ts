import { Request, Response } from "express";
import { exploreLists, setListSaved } from "./lists.discovery.repository";
import { listDiscoverySchema, listIdParamSchema } from "./lists.schema";

export async function exploreListsController(req: Request, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Autenticação necessária." });
    const query = listDiscoverySchema.parse(req.query);
    return res.json(await exploreLists(req.user.id, query));
}

export function saveListController(saved: boolean) {
    return async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: "Autenticação necessária." });
        const { listId } = listIdParamSchema.parse(req.params);
        await setListSaved(listId, req.user.id, saved);
        return res.status(204).send();
    };
}
