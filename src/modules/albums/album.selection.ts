import { Request, Response } from "express";
import { catalogAlbumSchema, editorialSelectionSchema } from "./album.catalog";
import { getEditorialSelection, publishEditorialSelection, saveCatalogAlbums } from "./album.catalog.repository";
import { logger } from "../../utils/logger";
import { z } from "zod";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";

export async function readDiscoverySelection(req: Request, res: Response) {
    try {
        const selection = await getEditorialSelection();
        return res.json({ ...selection, status: selection.items.length > 0 ? "ready" : "empty" });
    } catch (error) {
        logger.error("Error reading discovery selection", { error, requestId: req.requestId });
        return res.status(503).json({ message: "Não foi possível carregar a seleção editorial.", requestId: req.requestId });
    }
}

export async function publishDiscoverySelection(req: Request, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Autenticação necessária." });
    const input = editorialSelectionSchema.parse(req.body);
    const revision = await publishEditorialSelection(req.user.id, input);
    return res.json({ revision });
}

export async function importDiscoveryAlbum(req: Request, res: Response) {
    const albumId = z.string().uuid().parse(req.params.albumId).toLowerCase();
    let album: z.infer<typeof catalogAlbumSchema>;
    try {
        const payload: unknown = await fetchMusicBrainz(`release-group/${albumId}`, { inc: "artist-credits+tags+genres" });
        album = catalogAlbumSchema.parse(payload);
        if (album.id !== albumId) throw new Error("MusicBrainz returned a different release-group");
    } catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error && error.status === 404 ? 404 : 502;
        logger.error("Error importing discovery album", { error, requestId: req.requestId });
        return res.status(status).json({ message: status === 404 ? "Álbum não encontrado no MusicBrainz." : "Não foi possível consultar o MusicBrainz.", requestId: req.requestId });
    }
    try {
        await saveCatalogAlbums([album]);
    } catch (error) {
        logger.error("Error saving imported discovery album", { error, requestId: req.requestId });
        return res.status(503).json({ message: "Não foi possível atualizar o catálogo local.", requestId: req.requestId });
    }
    return res.json({ albumId, source: "musicbrainz" });
}
