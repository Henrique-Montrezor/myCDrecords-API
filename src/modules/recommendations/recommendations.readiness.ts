import { z } from "zod";

const timestampSchema = z.string().datetime({ offset: true });
const albumIdSchema = z.string().uuid().transform((id) => id.toLowerCase());
const datasetSchema = z.object({
    mode: z.literal("synthetic"),
    capturedAt: timestampSchema,
    catalog: z.array(z.object({ albumId: albumIdSchema }).strict()),
    ratings: z.array(z.object({
        userId: z.string().regex(/^synthetic-user-[1-9]\d*$/),
        albumId: albumIdSchema,
        rating: z.number().int().min(1).max(5),
        createdAt: timestampSchema,
        updatedAt: timestampSchema,
    }).strict()),
}).strict().superRefine((dataset, context) => {
    const catalog = new Set<string>();
    for (const [index, album] of dataset.catalog.entries()) {
        if (catalog.has(album.albumId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ["catalog", index, "albumId"], message: "Duplicate album identity." });
        }
        catalog.add(album.albumId);
    }

    const pairs = new Set<string>();
    const capturedAt = Date.parse(dataset.capturedAt);
    for (const [index, rating] of dataset.ratings.entries()) {
        const path = ["ratings", index];
        if (!catalog.has(rating.albumId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Rating album is outside the catalog." });
        }
        const pair = `${rating.userId}:${rating.albumId}`;
        if (pairs.has(pair)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Duplicate user/album rating." });
        }
        pairs.add(pair);
        const createdAt = Date.parse(rating.createdAt);
        const updatedAt = Date.parse(rating.updatedAt);
        if (createdAt > updatedAt || updatedAt > capturedAt) {
            context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Expected createdAt <= updatedAt <= capturedAt." });
        }
    }
});

export type SyntheticReadinessDataset = z.infer<typeof datasetSchema>;

export function analyzeSyntheticReadiness(input: unknown) {
    const dataset = datasetSchema.parse(input);
    const perUser = new Map<string, number>();
    const ratedAlbums = new Set<string>();
    const positiveUsersByAlbum = new Map<string, Set<string>>();
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let updatedRows = 0;
    let firstCreatedAt = Infinity;
    let lastUpdatedAt = -Infinity;

    for (const rating of dataset.ratings) {
        perUser.set(rating.userId, (perUser.get(rating.userId) ?? 0) + 1);
        ratedAlbums.add(rating.albumId);
        if (rating.rating >= 4) {
            positive += 1;
            const users = positiveUsersByAlbum.get(rating.albumId) ?? new Set<string>();
            users.add(rating.userId);
            positiveUsersByAlbum.set(rating.albumId, users);
        } else if (rating.rating === 3) {
            neutral += 1;
        } else {
            negative += 1;
        }
        const createdAt = Date.parse(rating.createdAt);
        const updatedAt = Date.parse(rating.updatedAt);
        if (updatedAt > createdAt) updatedRows += 1;
        firstCreatedAt = Math.min(firstCreatedAt, createdAt);
        lastUpdatedAt = Math.max(lastUpdatedAt, updatedAt);
    }

    let sharedPositiveAlbums = 0;
    const sharedUsers = new Set<string>();
    for (const users of positiveUsersByAlbum.values()) {
        if (users.size < 2) continue;
        sharedPositiveAlbums += 1;
        for (const user of users) sharedUsers.add(user);
    }
    const counts = [...perUser.values()];
    const users = perUser.size;
    const albums = dataset.catalog.length;
    const ratings = dataset.ratings.length;
    return {
        mode: dataset.mode,
        capturedAt: new Date(dataset.capturedAt).toISOString(),
        counts: { usersWithRatings: users, catalogAlbums: albums, ratedAlbums: ratedAlbums.size, ratings, positive, neutral, negative, updatedRows },
        coverage: albums > 0 ? ratedAlbums.size / albums : 0,
        density: users > 0 && albums > 0 ? ratings / (users * albums) : 0,
        ratingsPerUser: {
            min: counts.reduce((min, count) => Math.min(min, count), counts[0] ?? 0),
            max: counts.reduce((max, count) => Math.max(max, count), 0),
            average: users > 0 ? ratings / users : 0,
        },
        overlap: { sharedPositiveAlbums, usersWithSharedPositiveAlbum: sharedUsers.size },
        period: {
            firstCreatedAt: ratings > 0 ? new Date(firstCreatedAt).toISOString() : null,
            lastUpdatedAt: ratings > 0 ? new Date(lastUpdatedAt).toISOString() : null,
        },
        temporalEvaluation: "blocked_missing_event_history" as const,
        realWorldQuality: "not_measured" as const,
        promotionAllowed: false as const,
    };
}

export function createSyntheticReadinessDataset(): SyntheticReadinessDataset {
    const catalog = Array.from({ length: 5 }, (_, index) => ({
        albumId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    }));
    const entries = [
        { user: 1, album: 0, rating: 5 },
        { user: 1, album: 1, rating: 4 },
        { user: 2, album: 0, rating: 4 },
        { user: 2, album: 2, rating: 2 },
        { user: 3, album: 3, rating: 3 },
        { user: 3, album: 1, rating: 5 },
    ];
    return {
        mode: "synthetic",
        capturedAt: "2026-11-16T12:00:00.000Z",
        catalog,
        ratings: entries.map((entry, index) => {
            const createdAt = `2026-11-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`;
            return {
                userId: `synthetic-user-${entry.user}`,
                albumId: catalog[entry.album].albumId,
                rating: entry.rating,
                createdAt,
                updatedAt: index === 0 ? "2026-11-07T12:00:00.000Z" : createdAt,
            };
        }),
    };
}
