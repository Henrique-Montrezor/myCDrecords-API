import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";
import { fetchAlbumFromSpotify, searchSpotifyAlbum } from "../spotify/spotify.service";

export async function searchAlbums(req: Request, res: Response) {
  const { nome, limite = 10 } = req.query;

  const data = await fetchMusicBrainz("release-group/", {
    query: `release:${nome} AND primarytype:album`,
    limit: limite
  });

  try {
    const limitNumber = Number(limite) || 10;
    const spotifySearch = await searchSpotifyAlbum(nome as string, undefined, limitNumber);
    const albums = spotifySearch.albums?.items ?? [];
    res.json({ spotify: albums, musicbrainz: data });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar álbuns" });
  }
};

export async function getAlbumInfo(req: Request, res: Response) {
  const queryName = (req.query.nome as string) || (req.params.name as string);

  if (!queryName) return res.status(400).json({ message: "nome é obrigatório" });

  const musicbrainzData = await fetchMusicBrainz("release-group/", {
    query: `release:${queryName} AND primarytype:album`,
    limit: 1
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