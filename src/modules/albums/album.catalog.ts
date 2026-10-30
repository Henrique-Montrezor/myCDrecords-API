import { z } from "zod";

export const catalogAlbumSchema = z.object({
    id: z.string().uuid().transform((id) => id.toLowerCase()),
    title: z.string().min(1).max(500),
    "artist-credit": z.array(z.object({
        name: z.string().optional(),
        artist: z.object({ name: z.string() }).optional(),
    })).optional(),
    "first-release-date": z.string().max(10).optional(),
    "primary-type": z.string().max(32).optional(),
    "secondary-types": z.array(z.string()).optional(),
    tags: z.array(z.object({ name: z.string() })).optional(),
    genres: z.array(z.object({ name: z.string() })).optional(),
});

export type CatalogAlbum = z.infer<typeof catalogAlbumSchema>;

export function catalogAlbumCard(album: CatalogAlbum) {
    return {
        id: album.id,
        source: "musicbrainz" as const,
        title: album.title,
        artistCredit: (album["artist-credit"] ?? []).map((credit) => ({ name: credit.name ?? credit.artist?.name ?? "" })),
        releaseDate: album["first-release-date"] ?? "",
        imageUrl: `https://coverartarchive.org/release-group/${album.id}/front-250`,
        type: album["primary-type"] ?? "",
        tags: [...new Set([...(album.tags ?? []), ...(album.genres ?? [])].map(({ name }) => name.trim().toLowerCase()).filter(Boolean))],
    };
}

export const editorialSelectionSchema = z.object({
    revision: z.number().int().min(0),
    items: z.array(z.object({
        albumId: z.string().uuid().transform((id) => id.toLowerCase()),
        note: z.string().trim().min(1).max(800),
    }).strict()).max(6),
}).strict().refine(({ items }) => new Set(items.map((item) => item.albumId)).size === items.length, {
    message: "A seleção não pode repetir álbuns.",
    path: ["items"],
});

export type EditorialSelectionInput = z.infer<typeof editorialSelectionSchema>;
