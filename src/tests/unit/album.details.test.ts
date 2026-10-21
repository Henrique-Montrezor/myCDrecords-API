import { isMusicBrainzId, normalizeMusicBrainzAlbum, normalizeSpotifyAlbum, pickReleaseId } from "../../modules/albums/album.details";
import { buildRatingSummary } from "../../modules/reviews/reviews.summary";

describe("album.details", () => {
  it("recognizes MusicBrainz UUIDs and rejects Spotify IDs", () => {
    expect(isMusicBrainzId("12a6363a-213c-3d21-aa59-8b2f0e7227b6")).toBe(true);
    expect(isMusicBrainzId("2UJcKiJxNryhL050F5Z1Fk")).toBe(false);
  });

  it("normalizes a Spotify album into AlbumDetails", () => {
    const album = normalizeSpotifyAlbum({
      id: "abc",
      name: "Patient Zero",
      album_type: "single",
      release_date: "2026-01-02",
      total_tracks: 1,
      genres: [],
      images: [{ url: "https://img/1.jpg" }],
      external_urls: { spotify: "https://open.spotify.com/album/abc" },
      artists: [{ name: "Taylor Swift" }],
      tracks: { items: [{ id: "t1", track_number: 1, disc_number: 1, name: "Patient Zero", duration_ms: 225000, artists: [{ name: "Taylor Swift" }] }] },
    });

    expect(album).toMatchObject({
      id: "abc",
      source: "spotify",
      title: "Patient Zero",
      type: "single",
      coverUrl: "https://img/1.jpg",
      externalUrl: "https://open.spotify.com/album/abc",
      totalTracks: 1,
      artists: [{ name: "Taylor Swift" }],
    });
    expect(album.tracks[0]).toEqual({ id: "t1", number: 1, discNumber: 1, title: "Patient Zero", durationMs: 225000, artists: ["Taylor Swift"] });
  });

  it("picks the earliest official release of a release group", () => {
    const id = pickReleaseId({
      releases: [
        { id: "late", status: "Official", date: "2001-05-01" },
        { id: "bootleg", status: "Bootleg", date: "1999-01-01" },
        { id: "early", status: "Official", date: "1991-09-24" },
      ],
    });
    expect(id).toBe("early");
    expect(pickReleaseId({})).toBeNull();
  });

  it("normalizes MusicBrainz data with tracks, deduplicated genres and no tracklist fallback", () => {
    const group = {
      id: "12a6363a-213c-3d21-aa59-8b2f0e7227b6",
      title: "Nevermind",
      "primary-type": "Album",
      "first-release-date": "1991-09-24",
      "artist-credit": [{ name: "Nirvana" }],
      genres: [{ name: "grunge" }],
      tags: [{ name: "grunge" }, { name: "rock" }],
    };
    const release = {
      media: [{ position: 1, tracks: [{ id: "tr1", position: 1, title: "Smells Like Teen Spirit", length: 301000, recording: { id: "rec1" }, "artist-credit": [{ name: "Nirvana" }] }] }],
    };

    const album = normalizeMusicBrainzAlbum(group, release);
    expect(album).toMatchObject({ source: "musicbrainz", type: "album", releaseDate: "1991-09-24", genres: ["grunge", "rock"], totalTracks: 1 });
    expect(album.tracks[0]).toMatchObject({ id: "rec1", title: "Smells Like Teen Spirit", durationMs: 301000, discNumber: 1 });
    expect(normalizeMusicBrainzAlbum(group).tracks).toEqual([]);
  });
});

describe("reviews.summary - buildRatingSummary", () => {
  it("returns a null average when there are no reviews", () => {
    expect(buildRatingSummary([])).toEqual({ average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });

  it("computes the average rounded to one decimal and the distribution", () => {
    const summary = buildRatingSummary([
      { rating: 5, count: 2 },
      { rating: 4, count: 1 },
      { rating: 1, count: 1 },
    ]);
    expect(summary.count).toBe(4);
    expect(summary.average).toBe(3.8);
    expect(summary.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 });
  });

  it("ignores ratings outside 1-5 and accepts string counts from MySQL", () => {
    const summary = buildRatingSummary([{ rating: 7, count: 3 }, { rating: 3, count: "2" as unknown as number }]);
    expect(summary.count).toBe(2);
    expect(summary.average).toBe(3);
  });
});
