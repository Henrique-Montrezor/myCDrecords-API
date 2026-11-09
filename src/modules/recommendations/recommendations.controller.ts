import { Request, Response } from "express";
import { z } from "zod";
import { cache } from "../../utils/cache";
import {
    addDismissal, getCatalogAlbums, getCollaborativeCandidates, getCommunityStats, getPopularCandidates,
    getDismissedRecommendations, getPreferenceCandidates, getRecommendationPreferences, getTagCandidates,
    getTasteProfile, getUserTaste, isMbid, removeDismissal, saveRecommendationPreferences,
} from "./recommendations.repository";
import {
    adjacentTags, buildRecommendations, RECOMMENDATION_PARAMS, RECOMMENDATION_VERSION, RecommendationPreferences,
    RecommendationResult, TasteSignal,
} from "./recommendations.engine";

const CACHE_TTL_SECONDS = 600;
const MAX_PROFILE_TAGS = 30;

const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(48).default(12),
    offset: z.coerce.number().int().min(0).max(RECOMMENDATION_PARAMS.maxRanked).default(0),
});
const preferencesSchema = z.object({
    genres: z.array(z.string().trim().min(1).max(80).transform((value) => value.toLowerCase())).max(20),
    artists: z.array(z.string().trim().min(1).max(120)).max(20),
}).strict().refine(({ genres, artists }) =>
    new Set(genres.map((value) => value.toLowerCase())).size === genres.length
    && new Set(artists.map((value) => value.toLowerCase())).size === artists.length,
"Preferências duplicadas não são permitidas.");
const albumParamSchema = z.object({ albumId: z.string().refine(isMbid, "albumId must be a MusicBrainz ID").transform((id) => id.toLowerCase()) });

// Called whenever the user's taste signals change (review posted/edited/deleted, favorites saved, dismissals)
export function clearRecommendationsCache(userId: number) {
    const prefix = `recommendations_${userId}_`;
    cache.del(cache.keys().filter((key) => key.startsWith(prefix)));
}

async function rankFor(userId: number): Promise<RecommendationResult> {
    const { ratings, excluded } = await getUserTaste(userId);
    const preferences = await getRecommendationPreferences(userId);
    const signalAlbums = await getCatalogAlbums([...ratings.keys()]);
    const signals: TasteSignal[] = signalAlbums.map((album) => ({ albumId: album.albumId, rating: ratings.get(album.albumId) ?? 0, tags: album.tags }));
    const positiveIds = [...ratings].filter(([, rating]) => rating >= RECOMMENDATION_PARAMS.positiveRating).map(([id]) => id);

    const tagWeights = new Map<string, number>();
    for (const signal of signals) {
        if (signal.rating < RECOMMENDATION_PARAMS.positiveRating) continue;
        for (const tag of signal.tags) tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + 1);
    }
    const profileTags = [...tagWeights].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_PROFILE_TAGS).map(([tag]) => tag);
    const preferredTags = [...profileTags, ...preferences.genres];
    const searchTags = [...new Set([...preferredTags, ...preferredTags.flatMap(adjacentTags)])];
    const excludedMbids = [...excluded].filter(isMbid);

    const [tagCandidates, preferenceCandidates, collaborative, popular] = await Promise.all([
        getTagCandidates(searchTags, excludedMbids),
        getPreferenceCandidates(preferences, excludedMbids),
        getCollaborativeCandidates(userId, positiveIds, RECOMMENDATION_PARAMS.minCollaborativePeople),
        getPopularCandidates(userId),
    ]);
    const known = new Set([...tagCandidates, ...preferenceCandidates].map((candidate) => candidate.albumId));
    const collaborativeAlbums = await getCatalogAlbums([...collaborative.keys()].filter((id) => !known.has(id)));
    const candidates = [...new Map([...tagCandidates, ...preferenceCandidates, ...collaborativeAlbums].map((candidate) => [candidate.albumId, candidate])).values()];
    const community = await getCommunityStats(userId, candidates.map((candidate) => candidate.albumId));

    return buildRecommendations({ signals, preferences, excluded, candidates, collaborative, community, popular });
}

export async function getRecommendations(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }
    const { limit, offset } = querySchema.parse(req.query);
    const cacheKey = `recommendations_${userId}_ranking`;

    // Taste counters are cheap and must be fresh so the client can ask for reviews right away
    const perfil = await getTasteProfile(userId);
    let ranking = cache.get<RecommendationResult>(cacheKey);
    if (!ranking) {
        ranking = await rankFor(userId);
        cache.set(cacheKey, ranking, CACHE_TTL_SECONDS);
    }

    const page = ranking.items.slice(offset, offset + limit);
    const nextOffset = offset + page.length < ranking.items.length ? offset + page.length : null;
    res.set("Cache-Control", "private, no-store");
    res.status(200).json({
        tipo: ranking.kind,
        version: RECOMMENDATION_VERSION,
        evidence: { signals: ranking.evidence, required: RECOMMENDATION_PARAMS.minEvidence },
        perfil,
        total: ranking.items.length,
        offset,
        limit,
        nextOffset,
        data: page.map(({ candidate, reasons }) => ({
            album_id: candidate.albumId,
            album_title: candidate.title,
            album_artist: candidate.artists.join(", "),
            album_image: `https://coverartarchive.org/release-group/${candidate.albumId}/front-250`,
            release_date: candidate.releaseDate || null,
            source: "musicbrainz",
            reasons,
        })),
    });
}

export async function getRecommendationPreferencesHandler(req: Request, res: Response) {
    const preferences = await getRecommendationPreferences(req.user!.id);
    res.set("Cache-Control", "private, no-store").status(200).json(preferences);
}

export async function updateRecommendationPreferences(req: Request, res: Response) {
    const preferences: RecommendationPreferences = preferencesSchema.parse(req.body);
    await saveRecommendationPreferences(req.user!.id, preferences);
    clearRecommendationsCache(req.user!.id);
    res.set("Cache-Control", "private, no-store").status(200).json(preferences);
}

export async function getDismissedRecommendationsHandler(req: Request, res: Response) {
    const { limit, offset } = querySchema.parse(req.query);
    const page = await getDismissedRecommendations(req.user!.id, limit, offset);
    res.set("Cache-Control", "private, no-store").status(200).json({
        ...page,
        offset,
        limit,
        nextOffset: offset + page.data.length < page.total ? offset + page.data.length : null,
    });
}

export async function dismissRecommendation(req: Request, res: Response) {
    const { albumId } = albumParamSchema.parse(req.params);
    await addDismissal(req.user!.id, albumId);
    clearRecommendationsCache(req.user!.id);
    res.status(204).end();
}

export async function undoDismissRecommendation(req: Request, res: Response) {
    const { albumId } = albumParamSchema.parse(req.params);
    await removeDismissal(req.user!.id, albumId);
    clearRecommendationsCache(req.user!.id);
    res.status(204).end();
}
