import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";

// GET /artistas?nome=xxx&limite=10
export async function searchArtists(req: Request, res: Response) {
  const { nome, limite = 10 } = req.query;

  const data = await fetchMusicBrainz("artist/", {
    query: `artist:"${nome}"`,
    limit: limite
  });

  res.json(data);
}
// GET /artistas/:mbid
export async function getArtist(req: Request, res: Response) {
  const { mbid } = req.params;
  const { incluir_albuns } = req.query;

  const params: any = {};

  if (incluir_albuns === "true") {
    params.inc = "release-groups";
  }

  const data = await fetchMusicBrainz(`artist/${mbid}`, params);
  res.json(data);

  
}