import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";
import { fetchAlbumFromSpotify, searchSpotifyAlbum, searchSpotify} from "../spotify/spotify.service";

export async function searchAlbums(req: Request, res: Response) {
  const { nome, limite = 10 } = req.query;

  const musicbrainzData = await fetchMusicBrainz("release-group/", {
    query: `release:${nome} AND primarytype:album`,
    limit: limite,
    inc: "tags+genres"
  });

  try {
    const limitNumber = Number(limite) || 10;
    const spotifySearch = await searchSpotifyAlbum(nome as string, undefined, limitNumber);
    const spotifyAlbums = spotifySearch.albums?.items ?? [];
    const musicbrainzAlbums = musicbrainzData?.["release-groups"] ?? [];

    const formattedSpotify = spotifyAlbums.map((album: any) => ({
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

    const formattedMusicBrainz = musicbrainzAlbums.map((album: any) => ({
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

    res.json({ spotify: formattedSpotify, musicbrainz: formattedMusicBrainz });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar álbuns" });
  }
};

export async function getAlbumInfo(req: Request, res: Response) {
  const queryName = (req.query.nome as string) || (req.params.name as string);

  if (!queryName) return res.status(400).json({ message: "nome é obrigatório" });

  const musicbrainzData = await fetchMusicBrainz("release-group/", {
    query: `release:${queryName} AND primarytype:album`,
    limit: 1,
    inc: "tags+genres"
  });

  try {
    const spotifySearch = await searchSpotifyAlbum(queryName);
    const albumData = spotifySearch.albums?.items?.[0] ?? null;
    res.json({ spotify: albumData, musicbrainz: musicbrainzData });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar informações do álbum" });
  }
};

export async function getAlbumById(req: Request, res: Response) {
  const albumId = req.params.id;

  if (!albumId) return res.status(400).json({ message: "id é obrigatório" });

  try {
    const albumData = await fetchAlbumFromSpotify(albumId);
    res.json(albumData);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar informações do álbum" });
  }
};

export async function getTrendingAlbums(req: Request, res: Response) {
  try {
    // 1. Descobre o ano em que estamos dinamicamente
    const currentYear = new Date().getFullYear();
    
    // 2. Faz uma busca por todos os álbuns deste ano. 
    // O grande segredo: O Spotify ordena os resultados do "search" por popularidade!
    const searchData = await searchSpotify(`year:${currentYear}`, 'album', 12);
    
    const trendingAlbums = searchData.albums?.items || [];
    
    // 3. Formata os dados para o frontend
    const formattedSpotify = trendingAlbums.map((album: any) => ({
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

    res.json({ spotify: formattedSpotify, musicbrainz: [] });
  } catch (error) {
    console.error("Erro ao buscar álbuns em alta globais:", error);
    res.status(500).json({ message: "Erro ao buscar álbuns em alta" });
  }
}
