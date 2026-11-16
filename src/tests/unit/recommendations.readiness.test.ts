import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { analyzeSyntheticReadiness, createSyntheticReadinessDataset } from "../../modules/recommendations/recommendations.readiness";

describe("synthetic recommendation readiness diagnostic", () => {
    it("measures rating coverage, density and positive overlap without identifying users or albums", () => {
        const report = analyzeSyntheticReadiness(createSyntheticReadinessDataset());

        expect(report).toEqual({
            mode: "synthetic",
            capturedAt: "2026-11-16T12:00:00.000Z",
            counts: { usersWithRatings: 3, catalogAlbums: 5, ratedAlbums: 4, ratings: 6, positive: 4, neutral: 1, negative: 1, updatedRows: 1 },
            coverage: 0.8,
            density: 0.4,
            ratingsPerUser: { min: 2, max: 2, average: 2 },
            overlap: { sharedPositiveAlbums: 2, usersWithSharedPositiveAlbum: 3 },
            period: { firstCreatedAt: "2026-11-01T12:00:00.000Z", lastUpdatedAt: "2026-11-07T12:00:00.000Z" },
            temporalEvaluation: "blocked_missing_event_history",
            realWorldQuality: "not_measured",
            promotionAllowed: false,
        });
        const serialized = JSON.stringify(report);
        expect(serialized).not.toContain("synthetic-user");
        expect(serialized).not.toContain("00000000-0000-4000-8000-");
    });

    it("reports an empty snapshot explicitly without non-finite statistics or a readiness claim", () => {
        const dataset = createSyntheticReadinessDataset();
        const report = analyzeSyntheticReadiness({ ...dataset, catalog: [], ratings: [] });

        expect(report.counts.usersWithRatings).toBe(0);
        expect(report.coverage).toBe(0);
        expect(report.density).toBe(0);
        expect(report.ratingsPerUser).toEqual({ min: 0, max: 0, average: 0 });
        expect(report.period).toEqual({ firstCreatedAt: null, lastUpdatedAt: null });
        expect(report.promotionAllowed).toBe(false);
    });

    it("uses only users with ratings in density and measures unequal activity and shared positives", () => {
        const dataset = createSyntheticReadinessDataset();
        const report = analyzeSyntheticReadiness({ ...dataset, ratings: dataset.ratings.slice(0, 3) });

        expect(report.counts.usersWithRatings).toBe(2);
        expect(report.ratingsPerUser).toEqual({ min: 1, max: 2, average: 1.5 });
        expect(report.coverage).toBe(0.4);
        expect(report.density).toBe(0.3);
        expect(report.overlap).toEqual({ sharedPositiveAlbums: 1, usersWithSharedPositiveAlbum: 2 });
    });

    it.each(["spotify", "musicbrainz", "production"])("rejects non-synthetic input mode %s", (mode) => {
        expect(() => analyzeSyntheticReadiness({ ...createSyntheticReadinessDataset(), mode })).toThrow();
    });

    it("rejects extra metadata instead of accepting personal or provider content", () => {
        const dataset = createSyntheticReadinessDataset();
        expect(() => analyzeSyntheticReadiness({ ...dataset, email: "fixture@example.invalid" })).toThrow();
        expect(() => analyzeSyntheticReadiness({
            ...dataset,
            ratings: [{ ...dataset.ratings[0], text: "Synthetic text that is not an allowed field" }],
        })).toThrow();
        expect(() => analyzeSyntheticReadiness({
            ...dataset,
            catalog: [{ ...dataset.catalog[0], tags: ["synthetic-tag"] }],
        })).toThrow();
    });

    it("rejects duplicate catalog identities and user/album pairs, including different UUID casing", () => {
        const dataset = createSyntheticReadinessDataset();
        const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        expect(() => analyzeSyntheticReadiness({
            ...dataset,
            catalog: [{ albumId }, { albumId: albumId.toUpperCase() }],
            ratings: [],
        })).toThrow();
        expect(() => analyzeSyntheticReadiness({
            ...dataset,
            catalog: [{ albumId }],
            ratings: [
                { ...dataset.ratings[0], albumId },
                { ...dataset.ratings[0], albumId: albumId.toUpperCase() },
            ],
        })).toThrow();
    });

    it("rejects a rating for an album outside the declared catalog", () => {
        const dataset = createSyntheticReadinessDataset();
        expect(() => analyzeSyntheticReadiness({ ...dataset, catalog: [] })).toThrow();
    });

    it.each([
        { createdAt: "invalid" },
        { createdAt: "2026-11-08T12:00:00.000Z", updatedAt: "2026-11-07T12:00:00.000Z" },
        { updatedAt: "2026-11-17T12:00:00.000Z" },
        { rating: 6 },
        { rating: 4.5 },
        { userId: "real-user" },
    ])("rejects invalid chronology or rating input %j", (change) => {
        const dataset = createSyntheticReadinessDataset();
        expect(() => analyzeSyntheticReadiness({
            ...dataset,
            ratings: [{ ...dataset.ratings[0], ...change }],
        })).toThrow();
    });

    it("compares timestamp instants rather than offset strings and does not treat updates as event history", () => {
        const dataset = createSyntheticReadinessDataset();
        const report = analyzeSyntheticReadiness({
            ...dataset,
            ratings: [{
                ...dataset.ratings[0],
                createdAt: "2026-11-01T15:00:00+03:00",
                updatedAt: "2026-11-01T10:00:00-03:00",
            }],
        });

        expect(report.counts.updatedRows).toBe(1);
        expect(report.period).toEqual({ firstCreatedAt: "2026-11-01T12:00:00.000Z", lastUpdatedAt: "2026-11-01T13:00:00.000Z" });
        expect(report.temporalEvaluation).toBe("blocked_missing_event_history");
        expect(report.realWorldQuality).toBe("not_measured");
        expect(report.promotionAllowed).toBe(false);
    });
});

describe("synthetic readiness CLI", () => {
    const cwd = resolve(__dirname, "../../..");
    const cli = resolve(cwd, "src/modules/recommendations/recommendations.readiness.cli.ts");
    const run = (args: string[]) => spawnSync(process.execPath, ["-r", "ts-node/register", cli, ...args], {
        cwd,
        encoding: "utf8",
        timeout: 30000,
    });

    it("prints aggregate JSON only with explicit synthetic opt-in", () => {
        const result = run(["--synthetic"]);
        expect(result.error).toBeUndefined();
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual(analyzeSyntheticReadiness(createSyntheticReadinessDataset()));
    });

    it.each([[], ["--synthetic", "--real"], ["--input", "not-an-importable-file.json"]])("rejects unsupported arguments %j without a success report", (...args) => {
        const result = run(args);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(2);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Uso: npm run ml:readiness -- --synthetic.");
    });
});
