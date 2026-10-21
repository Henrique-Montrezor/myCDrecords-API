export type AlbumTrack = {
  id: string;
  number: number;
  discNumber: number;
  title: string;
  durationMs: number | null;
  artists: string[];
};

export type AlbumDetails = {
  id: string;
  source: "spotify" | "musicbrainz";
  title: string;
  artists: Array<{ name: string }>;
  releaseDate: string | null;
  type: string | null;
  coverUrl: string | null;
  genres: string[];
  externalUrl: string | null;
  totalTracks: number;
  tracks: AlbumTrack[];
};

const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMusicBrainzId(id: string) {
  return MBID_PATTERN.test(id);
}

export function normalizeSpotifyAlbum(raw: any): AlbumDetails {
  const tracks: AlbumTrack[] = (raw.tracks?.items ?? []).map((track: any) => ({
    id: track.id,
    number: track.track_number,
    discNumber: track.disc_number ?? 1,
    title: track.name,
    durationMs: track.duration_ms ?? null,
    artists: (track.artists ?? []).map((artist: any) => artist.name),
  }));

  return {
    id: raw.id,
    source: "spotify",
    title: raw.name,
    artists: (raw.artists ?? []).map((artist: any) => ({ name: artist.name })),
    releaseDate: raw.release_date ?? null,
    type: raw.album_type ?? null,
    coverUrl: raw.images?.[0]?.url ?? null,
    genres: raw.genres ?? [],
    externalUrl: raw.external_urls?.spotify ?? null,
    totalTracks: raw.total_tracks ?? tracks.length,
    tracks,
  };
}

// MusicBrainz lists releases (editions) under a release group; the earliest official one carries the tracklist.
export function pickReleaseId(releaseGroup: any): string | null {
  const releases: any[] = releaseGroup.releases ?? [];
  const official = releases.filter((release) => release.status === "Official");
  const candidates = (official.length > 0 ? official : releases)
    .slice()
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  return candidates[0]?.id ?? null;
}

export function normalizeMusicBrainzAlbum(releaseGroup: any, release?: any): AlbumDetails {
  const tracks: AlbumTrack[] = [];
  for (const [mediumIndex, medium] of (release?.media ?? []).entries()) {
    for (const track of medium.tracks ?? []) {
      tracks.push({
        id: track.recording?.id ?? track.id,
        number: track.position,
        discNumber: medium.position ?? mediumIndex + 1,
        title: track.title,
        durationMs: track.length ?? track.recording?.length ?? null,
        artists: (track["artist-credit"] ?? []).map((credit: any) => credit.name),
      });
    }
  }

  const names = new Set<string>();
  const genres = [...(releaseGroup.genres ?? []), ...(releaseGroup.tags ?? [])]
    .map((item: any) => item.name as string)
    .filter((name) => !names.has(name) && names.add(name));

  return {
    id: releaseGroup.id,
    source: "musicbrainz",
    title: releaseGroup.title,
    artists: (releaseGroup["artist-credit"] ?? []).map((credit: any) => ({ name: credit.name })),
    releaseDate: releaseGroup["first-release-date"] || null,
    type: releaseGroup["primary-type"]?.toLowerCase() ?? null,
    coverUrl: `https://coverartarchive.org/release-group/${releaseGroup.id}/front`,
    genres: genres.slice(0, 6),
    externalUrl: `https://musicbrainz.org/release-group/${releaseGroup.id}`,
    totalTracks: tracks.length,
    tracks,
  };
}
