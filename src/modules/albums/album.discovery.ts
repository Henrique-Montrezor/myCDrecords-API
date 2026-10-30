import { Request, Response } from "express";
import { z } from "zod";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";
import { logger } from "../../utils/logger";
import { catalogAlbumSchema, catalogAlbumCard } from "./album.catalog";
import { saveCatalogAlbums } from "./album.catalog.repository";

const PAGE_SIZE = 12;
const MAX_OFFSET = 1000;
const genres = ["rock", "pop", "jazz", "electronic", "hip hop", "gothic rock", "post-punk", "darkwave", "gothic metal"] as const;
const resultSchema = z.object({
    count: z.number().int().nonnegative(),
    "release-groups": z.array(catalogAlbumSchema).max(PAGE_SIZE),
});

export async function discoverAlbums(req: Request, res: Response) {
    const filters = z.object({
        genre: z.enum(genres).optional(),
        year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1).default(new Date().getFullYear()),
        type: z.enum(["album", "ep", "single"]).default("album"),
        offset: z.coerce.number().int().min(0).max(MAX_OFFSET).default(0),
    }).strict().parse(req.query);

    const query = [
        `primarytype:${filters.type}`,
        `firstreleasedate:${filters.year}`,
        ...(filters.genre ? [`tag:"${filters.genre}"`] : []),
    ].join(" AND ");

    let data: z.infer<typeof resultSchema>;
    try {
        const payload: unknown = await fetchMusicBrainz("release-group/", { query, limit: PAGE_SIZE, offset: filters.offset });
        data = resultSchema.parse(payload);
    } catch (error) {
        logger.error("Error fetching discovery catalog", { error, requestId: req.requestId });
        return res.status(502).json({ message: "Não foi possível consultar o catálogo MusicBrainz.", requestId: req.requestId });
    }

    try {
        await saveCatalogAlbums(data["release-groups"]);
    } catch (error) {
        logger.error("Error persisting discovery catalog", { error, requestId: req.requestId });
        return res.status(503).json({ message: "Não foi possível atualizar o catálogo local.", requestId: req.requestId });
    }
    const nextOffset = filters.offset + PAGE_SIZE;
    return res.json({
        source: "musicbrainz",
        updatedAt: new Date().toISOString(),
        items: data["release-groups"].map(catalogAlbumCard),
        total: data.count,
        nextOffset: data["release-groups"].length > 0 && nextOffset < data.count && nextOffset <= MAX_OFFSET ? nextOffset : null,
    });
}
