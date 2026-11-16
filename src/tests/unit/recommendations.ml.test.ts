import artifact from "../../modules/recommendations/models/artist-bpr-v1.json";
import { parseArtistModel, rankArtistModel, scoreArtists, CoreAlbum } from "../../modules/recommendations/recommendations.ml";

const model = () => parseArtistModel(artifact);
const disc = (id: number, artist: string): CoreAlbum => ({
    source: "musicbrainz", albumId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    title: `Fixture ${id}`, artists: [artist], releaseDate: "1980",
});

it("replays the Python conformance probe after reloading the published weights", () => {
    const scores = scoreArtists(model(), artifact.probe.signals);
    for (const expected of artifact.probe.scores) expect(scores.get(expected.artist)).toBeCloseTo(expected.score, 6);
});

it("personalizes new profiles, excludes known discs and limits artist repetition", () => {
    const albums = [disc(1, "Bauhaus"), disc(2, "Bauhaus"), disc(3, "Bauhaus"), disc(4, "John Coltrane"), disc(5, "The Cure")];
    const goth = rankArtistModel(model(), [{ artist: "The Cure", weight: 1 }], new Set([albums[4].albumId]), albums);
    const jazz = rankArtistModel(model(), [{ artist: "Miles Davis", weight: 1 }], new Set(), albums);
    expect(goth.status).toBe("active");
    expect(goth.ranking.items[0].candidate.artists).toEqual(["Bauhaus"]);
    expect(goth.ranking.items.every(({ candidate }) => candidate.albumId !== albums[4].albumId)).toBe(true);
    expect(goth.ranking.items.filter(({ candidate }) => candidate.artists[0] === "Bauhaus")).toHaveLength(2);
    expect(jazz.ranking.items[0].candidate.artists).toEqual(["John Coltrane"]);
});

it("does not claim cold, unsupported or negative-only profiles are personalized", () => {
    for (const signals of [[], [{ artist: "Unsupported", weight: 1 }], [{ artist: "The Cure", weight: -1 }]]) {
        expect(rankArtistModel(model(), signals, new Set(), [disc(1, "Bauhaus")]).status).toBe("cold_start");
    }
    expect(rankArtistModel(model(), [{ artist: "The Cure", weight: 1 }], new Set(), [disc(1, "Unsupported")]).status).toBe("no_candidates");
    expect(rankArtistModel(model(), [{ artist: "The Cure", weight: 1 }], new Set(), [disc(1, "Miles Davis")]).status).toBe("no_candidates");
});

it("negative signals lower affinity; corrupt, duplicate and degenerate weights cannot be loaded", () => {
    expect(scoreArtists(model(), [{ artist: "The Cure", weight: 1 }, { artist: "Bauhaus", weight: -1 }]).get("Bauhaus"))
        .toBeLessThan(scoreArtists(model(), [{ artist: "The Cure", weight: 1 }]).get("Bauhaus")!);
    const changed = structuredClone(artifact);
    changed.artists[0].vector[0] = "0.50000000";
    expect(() => parseArtistModel(changed)).toThrow();
    expect(() => parseArtistModel({ ...artifact, trainedOn: "real-users" })).toThrow();
    expect(() => parseArtistModel({ ...artifact, artists: [artifact.artists[0], artifact.artists[0]] })).toThrow();
});
