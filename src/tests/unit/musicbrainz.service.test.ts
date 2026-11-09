jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));

import axios from "axios";
import { fetchMusicBrainz } from "../../modules/musicbrainz/musicbrainz.service";
import { cache } from "../../utils/cache";

const get = axios.get as jest.Mock;

beforeEach(() => {
    get.mockReset();
    cache.flushAll();
});

describe("fetchMusicBrainz", () => {
    it("shares one upstream request between identical concurrent calls and caches it", async () => {
        get.mockResolvedValue({ data: { count: 1 } });
        const [first, second] = await Promise.all([fetchMusicBrainz("release-group/", { query: "a" }), fetchMusicBrainz("release-group/", { query: "a" })]);
        expect(first).toEqual({ count: 1 });
        expect(second).toBe(first);
        await fetchMusicBrainz("release-group/", { query: "a" });
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("spaces different requests to respect the MusicBrainz rate limit", async () => {
        const times: number[] = [];
        get.mockImplementation(async () => { times.push(Date.now()); return { data: {} }; });
        await Promise.all([fetchMusicBrainz("artist/", { query: "x" }), fetchMusicBrainz("artist/", { query: "y" })]);
        expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
    });

    it("retries once after a 503 and reports a second failure", async () => {
        const busy = { response: { status: 503, data: { error: "busy" }, headers: {} } };
        get.mockRejectedValueOnce(busy).mockResolvedValueOnce({ data: { ok: true } });
        await expect(fetchMusicBrainz("release-group/", { query: "r1" })).resolves.toEqual({ ok: true });

        get.mockRejectedValueOnce(busy).mockRejectedValueOnce(busy);
        await expect(fetchMusicBrainz("release-group/", { query: "r2" })).rejects.toEqual({ status: 503, message: { error: "busy" } });
        expect(get).toHaveBeenCalledTimes(4);
    }, 15000);
});
