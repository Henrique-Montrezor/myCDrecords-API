import { z } from "zod";
import { getPool, initDatabase } from "../../mysql2/init.database";
import { logger } from "../../utils/logger";
import { catalogAlbumSchema } from "../albums/album.catalog";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";
import { getArtistModel, rankArtistModel } from "./recommendations.ml";
import { getMLCatalog } from "./recommendations.ml.repository";
import catalogSources from "./models/artist-catalog-sources-v1.json";

// Keep connection/provider diagnostics private; emit only explicit, redacted CLI results.
logger.silent = true;
const mode = process.argv[2] ?? "verify";
let stage = "model";
const coreAlbum = catalogAlbumSchema.pick({
    id: true, title: true, "artist-credit": true, "first-release-date": true,
    "primary-type": true, "secondary-types": true,
});

async function main() {
    z.enum(["seed", "verify"]).parse(mode);
    const model = getArtistModel();
    if (mode === "seed") {
        stage = "musicbrainz";
        const albums = new Map<string, z.infer<typeof coreAlbum>>();
        const sources = z.array(z.object({ name: z.string(), mbid: z.string().uuid() }).strict()).length(24).parse(catalogSources.artists);
        if (new Set(sources.map((source) => source.name)).size !== 24
            || sources.some((source) => !model.vectors.has(source.name))) throw new Error("ML_INVALID_CATALOG_SOURCES");
        for (const { name: artist, mbid } of sources) {
            const response: unknown = await fetchMusicBrainz("release-group", {
                artist: mbid, type: "album", inc: "artist-credits", limit: 12,
            });
            const result = z.object({ "release-groups": z.array(coreAlbum).max(12) }).parse(response);
            for (const album of result["release-groups"]) {
                if (album["primary-type"] !== "Album" || (album["secondary-types"]?.length ?? 0) > 0) continue;
                if (!(album["artist-credit"] ?? []).some((credit) => (credit.name ?? credit.artist?.name) === artist)) continue;
                albums.set(album.id, album);
            }
        }
        if (albums.size === 0) throw new Error("ML_EMPTY_UPSTREAM_CATALOG");
        stage = "mysql_seed";
        const pool = await initDatabase();
        await pool.query(`INSERT INTO album_catalog
            (source, external_id, title, artists, release_date, release_type, tags, source_url)
            VALUES ? ON DUPLICATE KEY UPDATE id = id`, [[...albums.values()].map((album) => [
            "musicbrainz", album.id, album.title,
            JSON.stringify((album["artist-credit"] ?? []).map((credit) => ({ name: credit.name ?? credit.artist?.name ?? "" }))),
            album["first-release-date"] || null, "Album", "[]", `https://musicbrainz.org/release-group/${album.id}`,
        ])]);
    }
    stage = "mysql_verify";
    const catalog = await getMLCatalog([...model.vectors.keys()]);
    const goth = rankArtistModel(model, [{ artist: "The Cure", weight: 1 }], new Set(), catalog);
    const jazz = rankArtistModel(model, [{ artist: "Miles Davis", weight: 1 }], new Set(), catalog);
    const differentRankings = goth.ranking.items.slice(0, 5).map((item) => item.candidate.albumId).join()
        !== jazz.ranking.items.slice(0, 5).map((item) => item.candidate.albumId).join();
    const passed = goth.status === "active" && jazz.status === "active" && differentRankings;
    console.log(JSON.stringify({
        status: passed ? "passed" : "failed", ...(passed ? {} : { code: "ML_CATALOG_SMOKE_FAILED" }),
        mode, modelVersion: model.version, embeddingSha256: model.checksum,
        catalogAlbums: catalog.length, fictionalProfileItems: [goth.ranking.items.length, jazz.ranking.items.length],
        fictionalProfileStatuses: [goth.status, jazz.status],
        differentRankings, realUserDataRead: false, source: "musicbrainz-core", license: "CC0-1.0",
    }, null, 2));
    if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
    const code = error instanceof Error && /^ML_[A-Z_]+$/.test(error.message) ? error.message
        : typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
            ? error.code : "ML_CATALOG_OPERATION_FAILED";
    const upstreamStatus = typeof error === "object" && error !== null && "status" in error
        && typeof error.status === "number" && Number.isInteger(error.status) ? error.status : undefined;
    console.error(JSON.stringify({ status: "failed", mode, stage, code, upstreamStatus }));
    process.exitCode = 1;
}).finally(() => getPool().end());
