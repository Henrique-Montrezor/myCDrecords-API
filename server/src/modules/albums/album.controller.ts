import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";

export async function searchAlbums(req: Request, res: Response) {
  const { nome, limite = 10 } = req.query;

  const data = await fetchMusicBrainz("release-group/", {
    query: `release:${nome} AND primarytype:album`,
    limit: limite
  });

  res.json(data);
}