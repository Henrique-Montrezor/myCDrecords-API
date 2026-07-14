import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";

// GET /artists/search?name=xxx&limit=10
export async function searchArtists(req: Request, res: Response) {
  const name = req.query.name ?? req.query.nome;
  const limit = req.query.limit ?? req.query.limite ?? 10;

  const data = await fetchMusicBrainz("artist/", {
    query: `artist:"${name}"`,
    limit
  });

  res.json(data);
}
// GET /artists/:mbid
export async function getArtist(req: Request, res: Response) {
  const { mbid } = req.params;
  const includeAlbums = req.query.include_albums ?? req.query.incluir_albuns;

  const params: any = {};

  if (includeAlbums === "true") {
    params.inc = "release-groups";
  }

  const data = await fetchMusicBrainz(`artist/${mbid}`, params);
  res.json(data);

  
}