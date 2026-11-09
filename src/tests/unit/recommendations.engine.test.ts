import { buildRecommendations, CatalogCandidate, RecommendationInput, TasteSignal } from "../../modules/recommendations/recommendations.engine";

let seq = 0;
const album = (artist: string, tags: string[]): CatalogCandidate => {
    seq += 1;
    return { albumId: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`, title: `${artist} ${seq}`, artists: [artist], releaseDate: "", tags };
};

const loved = (tags: string[], rating = 5): TasteSignal => ({ albumId: album("Seed", tags).albumId, rating, tags });

function fixture() {
    const gothic = [
        album("Bauhaus", ["gothic rock", "post-punk"]),
        album("Bauhaus", ["gothic rock"]),
        album("Bauhaus", ["gothic rock", "deathrock"]),
        album("The Cure", ["gothic rock", "post-punk"]),
        album("The Cure", ["gothic rock"]),
        album("The Sisters of Mercy", ["gothic rock"]),
        album("Siouxsie and the Banshees", ["post-punk", "gothic rock"]),
    ];
    const bridges = [album("HIM", ["gothic metal"]), album("Type O Negative", ["gothic metal", "doom metal"]), album("Clan of Xymox", ["darkwave"])];
    const unrelated = Array.from({ length: 10 }, (_, index) => album(`Pop ${index}`, ["pop"]));
    const reviewed = album("Joy Division", ["post-punk"]);
    const dismissed = album("Christian Death", ["gothic rock", "deathrock"]);
    const candidates = [...gothic, ...bridges, ...unrelated, reviewed, dismissed];
    const input: RecommendationInput = {
        signals: [loved(["gothic rock", "post-punk"]), loved(["gothic rock"]), loved(["gothic rock"], 4), loved(["pop"], 1)],
        excluded: new Set([reviewed.albumId, dismissed.albumId]),
        candidates,
        collaborative: new Map(),
        community: new Map(),
        popular: [],
    };
    return { input, gothic, bridges, unrelated, reviewed, dismissed };
}

describe("recommendation engine f11b-v1", () => {
    it("favors the gothic rock profile with diversity, exploration and exclusions", () => {
        const { input, reviewed, dismissed, unrelated } = fixture();
        expect(input.candidates.length).toBeGreaterThanOrEqual(20);
        const result = buildRecommendations(input);
        expect(result.kind).toBe("personalizada");

        const top5 = result.items.slice(0, 5);
        expect(top5.filter((item) => item.candidate.tags.includes("gothic rock")).length).toBeGreaterThanOrEqual(3);

        const perArtist = new Map<string, number>();
        for (const item of result.items.slice(0, 10)) perArtist.set(item.candidate.artists[0], (perArtist.get(item.candidate.artists[0]) ?? 0) + 1);
        expect(Math.max(...perArtist.values())).toBeLessThanOrEqual(2);

        const ids = result.items.map((item) => item.candidate.albumId);
        expect(ids).not.toContain(reviewed.albumId);
        expect(ids).not.toContain(dismissed.albumId);
        expect(new Set(ids).size).toBe(ids.length);
        // Low ratings never raise affinity
        for (const pop of unrelated) expect(ids).not.toContain(pop.albumId);

        expect(result.items[4].reasons).toEqual([{ type: "exploration", tag: expect.any(String), from: expect.any(String) }]);
        expect(result.items.map((item) => item.candidate.artists[0])).toEqual(expect.arrayContaining(["HIM", "Type O Negative"]));
    });

    it("only explains with signals that were used", () => {
        const { input, gothic } = fixture();
        input.collaborative = new Map([[gothic[5].albumId, 3], [gothic[6].albumId, 1]]);
        const result = buildRecommendations(input);
        const sisters = result.items.find((item) => item.candidate.albumId === gothic[5].albumId);
        const siouxsie = result.items.find((item) => item.candidate.albumId === gothic[6].albumId);
        expect(sisters?.reasons).toEqual([{ type: "tags", tags: ["gothic rock"] }, { type: "collaborative", people: 3 }]);
        // Below the 2-person minimum the collaborative signal is not used nor mentioned
        expect(siouxsie?.reasons).toEqual([{ type: "tags", tags: ["gothic rock", "post-punk"] }]);
    });

    it("uses explicit genre and artist preferences without Spotify or review signals", () => {
        const candidate = album("My Favorite Artist", ["ambient"]);
        const input: RecommendationInput = {
            signals: [],
            preferences: { genres: ["ambient", "drone", "minimal"], artists: ["My Favorite Artist"] },
            excluded: new Set(),
            candidates: [candidate],
            collaborative: new Map(),
            community: new Map(),
            popular: [],
        };
        const result = buildRecommendations(input);
        expect(result.kind).toBe("personalizada");
        expect(result.evidence).toBe(4);
        expect(result.items[0].reasons).toEqual([{ type: "preferences", genres: ["ambient"], artists: ["My Favorite Artist"] }]);
    });

    it("does not present cold start as personalized", () => {
        const { input, gothic } = fixture();
        input.signals = input.signals.slice(0, 2);
        input.popular = [{ candidate: gothic[0], people: 4 }];
        const result = buildRecommendations(input);
        expect(result).toEqual({ kind: "popular", evidence: 2, items: [{ candidate: gothic[0], score: 4, reasons: [{ type: "community", people: 4 }] }] });
    });

    it("returns empty when there is nothing to recommend", () => {
        const result = buildRecommendations({ signals: [], excluded: new Set(), candidates: [], collaborative: new Map(), community: new Map(), popular: [] });
        expect(result).toEqual({ kind: "vazio", evidence: 0, items: [] });
    });
});
