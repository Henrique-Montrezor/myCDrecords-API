// Recommendation engine v1 (F11a). Parameters are frozen in the F11 brief; changing them requires a new version.
export const RECOMMENDATION_VERSION = "f11b-v1";

export const RECOMMENDATION_PARAMS = {
    weights: { tags: 0.5, collaborative: 0.35, quality: 0.15 },
    adjacentTagWeight: 0.5,
    minCollaborativePeople: 2,
    minEvidence: 3,
    positiveRating: 4,
    negativeRating: 2,
    diversityWindow: 10,
    maxPerArtistInWindow: 2,
    explorationEvery: 5,
    qualityFullConfidenceReviews: 3,
    maxRanked: 120,
} as const;

// Related, never synonyms: an adjacent tag counts with adjacentTagWeight and is flagged as exploration.
const ADJACENT_TAGS: Record<string, string[]> = {
    "gothic rock": ["darkwave", "post-punk", "deathrock", "gothic metal", "coldwave"],
    darkwave: ["coldwave", "ethereal wave", "synthpop"],
    "post-punk": ["coldwave", "new wave", "deathrock"],
    "gothic metal": ["doom metal"],
    "ethereal wave": ["dream pop"],
};

const adjacency = new Map<string, Set<string>>();
for (const [tag, related] of Object.entries(ADJACENT_TAGS)) {
    for (const other of related) {
        if (!adjacency.has(tag)) adjacency.set(tag, new Set());
        if (!adjacency.has(other)) adjacency.set(other, new Set());
        adjacency.get(tag)!.add(other);
        adjacency.get(other)!.add(tag);
    }
}

export function adjacentTags(tag: string) {
    return [...(adjacency.get(tag) ?? [])];
}

export type TasteSignal = { albumId: string; rating: number; tags: string[] };
export type RecommendationPreferences = { genres: string[]; artists: string[] };
export type CatalogCandidate = { albumId: string; title: string; artists: string[]; releaseDate: string; tags: string[] };
export type CommunityStats = { reviews: number; averageRating: number };

export type RecommendationReason =
    | { type: "ml" }
    | { type: "tags"; tags: string[] }
    | { type: "collaborative"; people: number }
    | { type: "exploration"; tag: string; from: string }
    | { type: "community"; people: number }
    | { type: "preferences"; genres: string[]; artists: string[] };

export type RankedRecommendation = { candidate: CatalogCandidate; score: number; reasons: RecommendationReason[] };

export type RecommendationInput = {
    signals: TasteSignal[];
    preferences?: RecommendationPreferences;
    excluded: Set<string>;
    candidates: CatalogCandidate[];
    collaborative: Map<string, number>;
    community: Map<string, CommunityStats>;
    popular: { candidate: CatalogCandidate; people: number }[];
};

export type RecommendationResult = {
    kind: "personalizada" | "popular" | "vazio";
    evidence: number;
    items: RankedRecommendation[];
};

type Scored = RankedRecommendation & { exploration: boolean };

export function tasteEvidence(signals: TasteSignal[]) {
    return signals.filter((signal) => signal.rating >= RECOMMENDATION_PARAMS.positiveRating && signal.tags.length > 0).length;
}

function tagProfile(signals: TasteSignal[]) {
    const profile = new Map<string, number>();
    for (const signal of signals) {
        const weight = signal.rating >= RECOMMENDATION_PARAMS.positiveRating ? 1 : signal.rating <= RECOMMENDATION_PARAMS.negativeRating ? -1 : 0;
        if (weight === 0) continue;
        for (const tag of signal.tags) profile.set(tag, (profile.get(tag) ?? 0) + weight);
    }
    return profile;
}

function tagMatch(candidate: CatalogCandidate, profile: Map<string, number>) {
    let raw = 0;
    const exact: { tag: string; weight: number }[] = [];
    let bridge: { tag: string; from: string; weight: number } | null = null;
    for (const tag of candidate.tags) {
        const weight = profile.get(tag);
        if (weight !== undefined) {
            raw += weight;
            if (weight > 0) exact.push({ tag, weight });
            continue;
        }
        let best: { from: string; weight: number } | null = null;
        for (const from of adjacentTags(tag)) {
            const fromWeight = profile.get(from) ?? 0;
            if (fromWeight > 0 && (!best || fromWeight > best.weight)) best = { from, weight: fromWeight };
        }
        if (best) {
            raw += RECOMMENDATION_PARAMS.adjacentTagWeight * best.weight;
            if (!bridge || best.weight > bridge.weight) bridge = { tag, from: best.from, weight: best.weight };
        }
    }
    exact.sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
    return { raw: Math.max(raw, 0), exact: exact.slice(0, 3).map(({ tag }) => tag), bridge };
}

function quality(stats: CommunityStats | undefined) {
    if (!stats || stats.reviews === 0) return 0;
    return ((stats.averageRating - 1) / 4) * Math.min(stats.reviews / RECOMMENDATION_PARAMS.qualityFullConfidenceReviews, 1);
}

function artistKey(candidate: CatalogCandidate) {
    return (candidate.artists[0] ?? "").trim().toLowerCase();
}

// Diversity: at most N per artist inside the window; every Nth slot prefers an exploration item.
function arrange(sorted: Scored[]) {
    const { diversityWindow, maxPerArtistInWindow, explorationEvery, maxRanked } = RECOMMENDATION_PARAMS;
    const pool = [...sorted];
    const result: Scored[] = [];
    const perArtist = new Map<string, number>();
    while (pool.length > 0 && result.length < maxRanked) {
        const position = result.length + 1;
        const allowed = (item: Scored) => position > diversityWindow || (perArtist.get(artistKey(item.candidate)) ?? 0) < maxPerArtistInWindow;
        let index = position % explorationEvery === 0 ? pool.findIndex((item) => item.exploration && allowed(item)) : -1;
        if (index === -1) index = pool.findIndex(allowed);
        // Only over-represented artists remain inside the window: stop rather than break the diversity cap.
        if (index === -1) break;
        const [item] = pool.splice(index, 1);
        const key = artistKey(item.candidate);
        perArtist.set(key, (perArtist.get(key) ?? 0) + 1);
        result.push(item);
    }
    return result;
}

function byScore(a: Scored, b: Scored) {
    return b.score - a.score || a.candidate.albumId.localeCompare(b.candidate.albumId);
}

function personalized(input: RecommendationInput) {
    const { weights, minCollaborativePeople } = RECOMMENDATION_PARAMS;
    const profile = tagProfile(input.signals);
    const preferences = input.preferences ?? { genres: [], artists: [] };
    const preferredGenres = new Set(preferences.genres.map((genre) => genre.trim().toLowerCase()).filter(Boolean));
    const preferredArtists = new Set(preferences.artists.map((artist) => artist.trim().toLowerCase()).filter(Boolean));
    const raw = input.candidates
        .filter((candidate) => !input.excluded.has(candidate.albumId))
        .map((candidate) => {
            const tags = tagMatch(candidate, profile);
            const people = input.collaborative.get(candidate.albumId) ?? 0;
            const genres = candidate.tags.filter((tag) => preferredGenres.has(tag.toLowerCase()));
            const artists = candidate.artists.filter((artist) => preferredArtists.has(artist.trim().toLowerCase()));
            return { candidate, tags: { ...tags, raw: tags.raw + genres.length + artists.length }, people: people >= minCollaborativePeople ? people : 0, preferences: { genres, artists } };
        })
        .filter((entry) => entry.tags.raw > 0 || entry.people > 0);

    const maxTags = Math.max(0, ...raw.map((entry) => entry.tags.raw));
    const maxPeople = Math.max(0, ...raw.map((entry) => entry.people));
    const scored = raw.map(({ candidate, tags, people, preferences: matchedPreferences }): Scored => {
        const reasons: RecommendationReason[] = [];
        if (tags.exact.length > 0) reasons.push({ type: "tags", tags: tags.exact });
        else if (tags.raw > 0 && tags.bridge) reasons.push({ type: "exploration", tag: tags.bridge.tag, from: tags.bridge.from });
        if (matchedPreferences.genres.length > 0 || matchedPreferences.artists.length > 0) reasons.push({ type: "preferences", ...matchedPreferences });
        if (people > 0) reasons.push({ type: "collaborative", people });
        const score = weights.tags * (maxTags > 0 ? tags.raw / maxTags : 0)
            + weights.collaborative * (maxPeople > 0 ? people / maxPeople : 0)
            + weights.quality * quality(input.community.get(candidate.albumId));
        return { candidate, score, reasons, exploration: tags.exact.length === 0 && tags.bridge !== null && tags.raw > 0 };
    });
    return arrange(scored.sort(byScore));
}

function popular(input: RecommendationInput) {
    const scored = input.popular
        .filter(({ candidate }) => !input.excluded.has(candidate.albumId))
        .map(({ candidate, people }): Scored => ({ candidate, score: people, reasons: [{ type: "community", people }], exploration: false }));
    return arrange(scored.sort(byScore));
}

const strip = ({ candidate, score, reasons }: Scored): RankedRecommendation => ({ candidate, score, reasons });

export function buildRecommendations(input: RecommendationInput): RecommendationResult {
    const preferences = input.preferences ?? { genres: [], artists: [] };
    const explicitEvidence = new Set([...preferences.genres, ...preferences.artists].map((value) => value.trim().toLowerCase()).filter(Boolean)).size;
    const evidence = tasteEvidence(input.signals) + explicitEvidence;
    if (evidence >= RECOMMENDATION_PARAMS.minEvidence) {
        const items = personalized(input);
        if (items.length > 0) return { kind: "personalizada", evidence, items: items.map(strip) };
    }
    const items = popular(input);
    return { kind: items.length > 0 ? "popular" : "vazio", evidence, items: items.map(strip) };
}
