import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";

export async function getArtistByName(req: Request, res: Response) {
  const name = req.query.name ?? req.query.nome;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  // 1. Search for artist
  const search = await fetchMusicBrainz("artist/", {
    query: `artist:${name}`,
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