import { Request, Response } from "express";
import { listIdParamSchema, listImageParamsSchema, listMoveSchema } from "./lists.schema";
import { prepareListImage } from "./lists.images";
import { moveListItem, readListImage, saveListImage } from "./lists.identity.repository";

export async function uploadListImageController(req: Request, res: Response) {
    const { listId, kind } = listImageParamsSchema.parse(req.params);
    if (!Buffer.isBuffer(req.body)) return res.status(415).json({ message: "Envie uma imagem JPEG, PNG ou WebP, não uma URL." });
    const content = await prepareListImage(req.body, kind);
    await saveListImage(listId, req.user!.id, kind, content);
    return res.status(204).send();
}

export async function deleteListImageController(req: Request, res: Response) {
    const { listId, kind } = listImageParamsSchema.parse(req.params);
    await saveListImage(listId, req.user!.id, kind, null);
    return res.status(204).send();
}

export async function readListImageController(req: Request, res: Response) {
    const { listId, kind } = listImageParamsSchema.parse(req.params);
    const content = await readListImage(listId, kind, req.user?.id);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    return res.type("image/jpeg").send(content);
}

export async function moveListItemController(req: Request, res: Response) {
    const { listId } = listIdParamSchema.parse(req.params);
    const input = listMoveSchema.parse(req.body);
    return res.json(await moveListItem(listId, req.user!.id, input));
}
