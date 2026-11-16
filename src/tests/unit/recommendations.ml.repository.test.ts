jest.mock("../../mysql2/init.database", () => ({ initDatabase: jest.fn() }));
import { initDatabase } from "../../mysql2/init.database";
import { getMLCatalog, getMLTaste } from "../../modules/recommendations/recommendations.ml.repository";

const id = "00000000-0000-4000-8000-000000000001";
const query = jest.fn();
beforeEach(() => {
    query.mockReset();
    (initDatabase as jest.Mock).mockResolvedValue({ query });
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
