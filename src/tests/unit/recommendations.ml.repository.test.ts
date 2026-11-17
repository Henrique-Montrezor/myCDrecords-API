jest.mock("../../mysql2/init.database", () => ({ initDatabase: jest.fn() }));
import { initDatabase } from "../../mysql2/init.database";
import { getMLCatalog, getMLTaste } from "../../modules/recommendations/recommendations.ml.repository";
import { getRecommendationEngine, saveRecommendationEngine, saveRecommendationPreferences } from "../../modules/recommendations/recommendations.repository";
import { migrateRecommendationEngine } from "../../mysql2/migrations/010-recommendation-engine";

const id = "00000000-0000-4000-8000-000000000001";
const query = jest.fn();
beforeEach(() => {
    query.mockReset();
    (initDatabase as jest.Mock).mockResolvedValue({ query });
});

it("defaults unconfigured accounts to disabled and rejects corrupt stored choices", async () => {
    query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ ml_enabled: 1 }]]).mockResolvedValueOnce([[{ ml_enabled: 2 }]]);
    expect(await getRecommendationEngine(7)).toBe(false);
    expect(await getRecommendationEngine(8)).toBe(true);
    await expect(getRecommendationEngine(9)).rejects.toThrow("INVALID_RECOMMENDATION_ENGINE");
    expect(query.mock.calls.map(([, values]) => values)).toEqual([[7], [8], [9]]);
});

it("persists only the actor's engine choice without overwriting taste or pilot consent, and vice versa", async () => {
    query.mockResolvedValue([{}]);
    await saveRecommendationEngine(7, true);
    await saveRecommendationEngine(8, false);
    await saveRecommendationPreferences(7, { genres: ["jazz"], artists: ["Miles Davis"] });
    expect(query.mock.calls[0][1]).toEqual([7, 1]);
    expect(query.mock.calls[1][1]).toEqual([8, 0]);
    expect(query.mock.calls[0][0].split("ON DUPLICATE KEY UPDATE")[1].trim()).toBe("ml_enabled = VALUES(ml_enabled)");
    expect(query.mock.calls[2][0].split("ON DUPLICATE KEY UPDATE")[1]).not.toContain("ml_enabled");
    expect(query.mock.calls.flat().join(" ")).not.toMatch(/ml_pilot|consent/);
});

it("adds a disabled-by-default engine column once without retroactive acceptance", async () => {
    query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ COLUMN_NAME: "ml_enabled" }]]);
    await migrateRecommendationEngine({ query });
    await migrateRecommendationEngine({ query });
    const changes = query.mock.calls.filter(([sql]) => sql.startsWith("ALTER"));
    expect(changes).toEqual([["ALTER TABLE recommendation_preferences ADD COLUMN ml_enabled TINYINT(1) NOT NULL DEFAULT 0"]]);
});

it("reads only actor-owned fields and independently sourced credits, not tags, text or peers", async () => {
    query.mockResolvedValueOnce([[{ album_id: id, artists: [{ name: "The Cure" }], rating: 1 }]])
        .mockResolvedValueOnce([[{ album_id: id, artists: [{ name: "The Cure" }] }]])
        .mockResolvedValueOnce([[{ album_id: "00000000-0000-4000-8000-000000000002" }]])
        .mockResolvedValueOnce([[{ artists: '["Miles Davis"]' }]]);
    const taste = await getMLTaste(7);
    expect(taste.signals).toEqual([{ artist: "The Cure", weight: -1 }, { artist: "Miles Davis", weight: 1 }]);
    expect(taste.excluded.size).toBe(2);
    for (const [sql, params] of query.mock.calls) {
        expect(sql).toMatch(/WHERE (?:r\.|f\.|d\.)?user_id = \?/);
        expect(params).toEqual([7]);
        expect(sql).not.toMatch(/\btags\b|\bgenres\b|\btext\b|\balbum_image\b/);
        if (sql.includes("JOIN")) expect(sql).toContain("c.source = 'musicbrainz'");
    }
});

it("selects only bounded core MusicBrainz albums and rejects forbidden source/invalid identities", async () => {
    const row = { source: "musicbrainz", external_id: id, title: "Independent fixture", artists: '[{"name":"The Cure"}]', release_date: "1989" };
    query.mockResolvedValueOnce([[row]]);
    expect(await getMLCatalog(["The Cure"])).toEqual([{
        source: "musicbrainz", albumId: id, title: "Independent fixture", artists: ["The Cure"], releaseDate: "1989",
    }]);
    expect(query.mock.calls[0][0]).toContain("source = 'musicbrainz'");
    expect(query.mock.calls[0][0]).toContain("LIMIT 20");
    expect(query.mock.calls[0][0]).not.toMatch(/\btags\b|\bgenres\b|\busers\b|\breviews\b/);
    query.mockResolvedValueOnce([[{ ...row, source: "spotify" }]]);
    await expect(getMLCatalog(["The Cure"])).rejects.toThrow();
    query.mockResolvedValueOnce([[{ ...row, external_id: "spotify-id" }]]);
    await expect(getMLCatalog(["The Cure"])).rejects.toThrow();
});
