import { createHash } from "node:crypto";
import { z } from "zod";
import persistedModel from "./models/artist-bpr-v1.json";
import { RecommendationResult } from "./recommendations.engine";

const weight = z.string().regex(/^-?\d+\.\d{8}$/).refine((value) => Math.abs(Number(value)) <= 1);
const signalSchema = z.object({ artist: z.string().min(1).max(120), weight: z.number().finite() }).strict();
const metrics = z.object({
    profiles: z.number().int().positive(), recallAt3: z.number().min(0.8).max(1),
    popularityRecallAt3: z.number().min(0).max(1),
}).strict().refine((value) => value.recallAt3 > value.popularityRecallAt3);
const artifactSchema = z.object({
    schemaVersion: z.literal(1), modelVersion: z.literal("artist-bpr-fictional-v1"),
    trainedOn: z.literal("fictional-profiles"), curation: z.literal("independent-manual-affinities-v1"),
    realWorldQuality: z.literal("not_measured"), dimensions: z.literal(4),
    minimumAffinity: z.literal(0.35),
    training: z.object({
        initialLoss: z.number().finite().positive(), finalLoss: z.number().finite().nonnegative(),
        epochs: z.literal(200), seed: z.literal(42), torchVersion: z.string().min(1).max(60),
        profiles: z.literal(24), interactions: z.literal(72),
    }).strict().refine((value) => value.finalLoss < value.initialLoss),
    evaluation: z.object({
        protocol: z.literal("fictional-new-profile-fold-in-v1"), validation: metrics, test: metrics,
    }).strict(),
    embeddingSha256: z.string().regex(/^[a-f0-9]{64}$/),
    artists: z.array(z.object({
        name: z.string().trim().min(1).max(120), vector: z.tuple([weight, weight, weight, weight]),
    }).strict()).length(24),
    probe: z.object({
        signals: z.array(signalSchema).min(1).max(24),
        scores: z.array(z.object({ artist: z.string(), score: z.number().finite().min(-1).max(1) }).strict()).length(24),
    }).strict(),
}).strict();

export type ModelSignal = z.infer<typeof signalSchema>;
export type ArtistModel = { version: string; checksum: string; minimumAffinity: number; vectors: Map<string, number[]> };
export type CoreAlbum = {
    source: "musicbrainz"; albumId: string; title: string; artists: string[]; releaseDate: string;
};
export type MLStatus = "active" | "cold_start" | "no_candidates";

function unit(vector: number[]) {
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm) || norm < 1e-9) throw new Error("ML_DEGENERATE_VECTOR");
    return vector.map((value) => value / norm);
}
const dot = (left: number[], right: number[]) => left.reduce((sum, value, axis) => sum + value * right[axis], 0);

function aggregateSignals(model: ArtistModel, signals: ModelSignal[]) {
    const weights = new Map<string, number>();
    for (const signal of signals) {
        signalSchema.parse(signal);
        if (model.vectors.has(signal.artist)) weights.set(signal.artist, (weights.get(signal.artist) ?? 0) + signal.weight);
    }
    return weights;
}

export function scoreArtists(model: ArtistModel, signals: ModelSignal[]) {
    const weights = aggregateSignals(model, signals);
    if (![...weights.values()].some((value) => value > 0)) return new Map<string, number>();
    const sum = Array.from({ length: 4 }, (_, axis) =>
        [...weights].reduce((value, [name, strength]) => value + model.vectors.get(name)![axis] * strength, 0));
    if (Math.hypot(...sum) < 1e-9) return new Map<string, number>();
    const profile = unit(sum);
    return new Map([...model.vectors].map(([name, vector]) => [name, dot(vector, profile)]));
}

export function parseArtistModel(input: unknown): ArtistModel {
    const artifact = artifactSchema.parse(input);
    const names = artifact.artists.map((artist) => artist.name);
    if (new Set(names).size !== names.length) throw new Error("ML_DUPLICATE_ARTIST");
    const checksum = createHash("sha256").update(JSON.stringify(artifact.artists.map((artist) => [artist.name, ...artist.vector]))).digest("hex");
    if (checksum !== artifact.embeddingSha256) throw new Error("ML_CHECKSUM_MISMATCH");
    const model: ArtistModel = {
        version: artifact.modelVersion, checksum, minimumAffinity: artifact.minimumAffinity,
        vectors: new Map(artifact.artists.map((artist) => [artist.name, unit(artist.vector.map(Number))])),
    };
    const probe = scoreArtists(model, artifact.probe.signals);
    if (new Set(artifact.probe.scores.map((entry) => entry.artist)).size !== names.length
        || artifact.probe.scores.some(({ artist, score }) => !probe.has(artist) || Math.abs(probe.get(artist)! - score) > 1e-6)) {
        throw new Error("ML_CONFORMANCE_MISMATCH");
    }
    return model;
}

let loaded: ArtistModel | undefined;
export function getArtistModel() {
    loaded ??= parseArtistModel(persistedModel);
    return loaded;
}

export function rankArtistModel(model: ArtistModel, signals: ModelSignal[], excluded: Set<string>, albums: CoreAlbum[]): {
    status: MLStatus; ranking: RecommendationResult;
} {
    const scores = scoreArtists(model, signals);
    const evidence = [...aggregateSignals(model, signals).values()].filter((value) => value > 0).length;
    const ranking: RecommendationResult = { kind: "vazio", evidence, items: [] };
    if (scores.size === 0) return { status: "cold_start", ranking };
    const scored = albums.flatMap((album) => {
        if (album.source !== "musicbrainz") throw new Error("ML_UNSUPPORTED_SOURCE");
        if (excluded.has(album.albumId.toLowerCase())) return [];
        const supported = album.artists.flatMap((name) => scores.has(name) ? [scores.get(name)!] : []);
        if (supported.length === 0) return [];
        const score = supported.reduce((sum, value) => sum + value, 0) / supported.length;
        if (score < model.minimumAffinity) return [];
        return [{ candidate: { ...album, tags: [] }, score, reasons: [{ type: "ml" as const }] }];
    }).sort((a, b) => b.score - a.score || a.candidate.albumId.localeCompare(b.candidate.albumId));
    const seen = new Set<string>();
    const artists = new Map<string, number>();
    for (const item of scored) {
        const names = [...new Set(item.candidate.artists)];
        if (seen.has(item.candidate.albumId) || names.some((name) => (artists.get(name) ?? 0) >= 2)) continue;
        ranking.items.push(item);
        seen.add(item.candidate.albumId);
        for (const name of names) artists.set(name, (artists.get(name) ?? 0) + 1);
    }
    if (ranking.items.length > 0) ranking.kind = "personalizada";
    return { status: ranking.items.length > 0 ? "active" : "no_candidates", ranking };
}
