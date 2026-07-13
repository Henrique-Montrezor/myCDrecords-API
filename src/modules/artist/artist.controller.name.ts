import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";

export async function getArtistByName(req: Request, res: Response) {
  const { nome } = req.query;

  if (!nome) {
    return res.status(400).json({ error: "Name is required" });
  }

  // 1. Search for artist
  const search = await fetchMusicBrainz("artist/", {
    query: `artist:${nome}`,
    limit: 1
  });

  const artista = search.artists?.[0];

  if (!artista) {
    return res.status(404).json({ error: "Artist not found" });
  }

  // 2. Fetch details using ID
  const detalhes = await fetchMusicBrainz(`artist/${artista.id}`, {
    inc: "release-groups"
  });

  res.json(detalhes);
}