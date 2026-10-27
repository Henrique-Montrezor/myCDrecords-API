import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";
import { logger } from "../../utils/logger";
import { fetchAlbumFromSpotify, searchSpotifyAlbum, searchSpotify} from "../spotify/spotify.service";
import { AlbumDetails, isMusicBrainzId, normalizeMusicBrainzAlbum, normalizeSpotifyAlbum, pickReleaseId } from "./album.details";

function isSpotifyConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

function formatMusicBrainzAlbums(albums: any[]) {
  return albums.map((album: any) => ({
    id: album.id,
    source: 'musicbrainz',
    title: album.title,
    artistCredit: album['artist-credit'],
    releaseDate: album['first-release-date'],
    imageUrl: `https://coverartarchive.org/release-group/${album.id}/front`,
    disambiguation: album.disambiguation,
    type: album['primary-type'],
    secondaryTypes: album['secondary-types'] || [],
    tags: album.tags?.map((tag: any) => tag.name) || [],
    genres: album.genres?.map((genre: any) => genre.name) || []
  }));
}

function formatSpotifyAlbums(albums: any[]) {
  return albums.map((album: any) => ({
    id: album.id,
    source: 'spotify',
    title: album.name || album.title,
    artistCredit: album.artists?.map((artist: any) => ({ name: artist.name })) || [],
    releaseDate: album.release_date,
    imageUrl: album.images?.[0]?.url,
    disambiguation: album.disambiguation,
    type: album.album_type,
    genres: album.genres || [],
    styles: album.styles || []
  }));
}

// Spotify caps `limit` at 50 and `offset` at 1000; MusicBrainz accepts the same window.
function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export async function searchAlbums(req: Request, res: Response) {
  const name = (req.query.name ?? req.query.nome) as string;
  const limite = boundedInt(req.query.limit ?? req.query.limite, 10, 1, 50);
  const offset = boundedInt(req.query.offset, 0, 0, 1000);

  let musicbrainzAlbums: any[] = [];
  let musicbrainzError: unknown;
  try {
    const musicbrainzData = await fetchMusicBrainz("release-group/", {
      query: `release:${name} AND primarytype:album`,
      limit: limite,
      offset,
      inc: "tags+genres"
    });
    musicbrainzAlbums = musicbrainzData?.["release-groups"] ?? [];
  } catch (error) {
    musicbrainzError = error;
  }

  let formattedSpotify: any[] = [];
  if (isSpotifyConfigured()) {
    try {
      const spotifySearch = await searchSpotifyAlbum(name as string, undefined, limite, offset);
      formattedSpotify = formatSpotifyAlbums(spotifySearch.albums?.items ?? []);
    } catch (error) {
      logger.warn("Spotify unavailable; returning MusicBrainz album results", { error });
    }
  }

  // MusicBrainz is rate limited; Spotify results alone are still a valid answer.
  if (musicbrainzError && formattedSpotify.length === 0) {
    logger.error("Error fetching album results", { error: musicbrainzError });
    return res.status(502).json({ message: "Error fetching albums" });
  }
  if (musicbrainzError) logger.warn("MusicBrainz unavailable; returning Spotify album results", { error: musicbrainzError });

  res.json({ spotify: formattedSpotify, musicbrainz: formatMusicBrainzAlbums(musicbrainzAlbums) });
};

export async function getAlbumInfo(req: Request, res: Response) {
  const queryName = (req.query.name as string) || (req.query.nome as string) || (req.params.name as string);

  if (!queryName) return res.status(400).json({ message: "name is required" });

  try {
    const musicbrainzData = await fetchMusicBrainz("release-group/", {
      query: `release:${queryName} AND primarytype:album`,
      limit: 1,
      inc: "tags+genres"
    });
    let albumData = null;
    if (isSpotifyConfigured()) {
      try {
        const spotifySearch = await searchSpotifyAlbum(queryName);
        albumData = spotifySearch.albums?.items?.[0] ?? null;
      } catch (error) {
        logger.warn("Spotify unavailable; returning MusicBrainz album information", { error });
      }
    }
    res.json({ spotify: albumData, musicbrainz: musicbrainzData });
  } catch (error) {
    logger.error("Error fetching album information", { error });
    res.status(502).json({ message: "Error fetching album information" });
  }
};

// Provider failures for unknown or malformed IDs are 404s; anything else is an upstream problem.
function upstreamStatus(error: any) {
  const status = error?.response?.status ?? error?.status;
  return status === 400 || status === 404 ? 404 : 502;
}

async function fetchMusicBrainzAlbumDetails(id: string): Promise<AlbumDetails> {
  const releaseGroup = await fetchMusicBrainz(`release-group/${id}`, { inc: "artist-credits+tags+genres+releases" });
  const releaseId = pickReleaseId(releaseGroup);
  let release;
  if (releaseId) {
    try {
      release = await fetchMusicBrainz(`release/${releaseId}`, { inc: "recordings+artist-credits" });
    } catch (error) {
      logger.warn("MusicBrainz tracklist unavailable; returning album without tracks", { albumId: id, error });
    }
  }
  return normalizeMusicBrainzAlbum(releaseGroup, release);
}

export async function getAlbumById(req: Request, res: Response) {
  const albumId = req.params.id?.trim();

  if (!albumId) return res.status(400).json({ message: "id is required" });

  try {
    if (isMusicBrainzId(albumId)) {
      return res.json(await fetchMusicBrainzAlbumDetails(albumId));
    }
    if (!isSpotifyConfigured()) {
      return res.status(404).json({ message: "Album not found" });
    }
    res.json(normalizeSpotifyAlbum(await fetchAlbumFromSpotify(albumId)));
  } catch (error) {
    const status = upstreamStatus(error);
    if (status === 502) logger.error("Error fetching album details", { albumId, error });
    res.status(status).json({ message: status === 404 ? "Album not found" : "Error fetching album information" });
  }
};

export async function getTrendingAlbums(req: Request, res: Response) {
  const currentYear = new Date().getFullYear();

  try {
    if (isSpotifyConfigured()) {
      try {
        const searchData = await searchSpotify(`year:${currentYear}`, 'album', 12);
        res.json({ spotify: formatSpotifyAlbums(searchData.albums?.items || []), musicbrainz: [] });
        return;
      } catch (error) {
        logger.warn("Spotify unavailable; falling back to MusicBrainz trends", { error });
      }
    }

    const musicbrainzData = await fetchMusicBrainz("release-group/", {
      query: `firstreleasedate:${currentYear}* AND primarytype:album`,
      limit: 12,
      inc: "tags+genres"
    });
    res.json({ spotify: [], musicbrainz: formatMusicBrainzAlbums(musicbrainzData?.["release-groups"] ?? []) });
  } catch (error) {
    logger.error("Error fetching global trending albums", { error });
    res.status(502).json({ message: "Error fetching trending albums" });
  }
}
