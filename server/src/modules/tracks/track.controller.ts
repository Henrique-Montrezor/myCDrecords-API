import { Request, Response } from "express";
import { fetchMusicBrainz } from "../musicbrainz/musicbrainz.service";
import { searchSpotify } from "../spotify/spotify.service";

export async function searchTracks(req: Request, res: Response) {
  const queryName = (req.query.nome || req.query.name) as string;

  if (!queryName) return res.status(400).json({ message: "nome é obrigatório" });

  const musicbrainzData = await fetchMusicBrainz("recording/", {
    query: `recording:"${queryName}"`,
    limit: Number(10)
  });

  const results = await Promise.all(
    musicbrainzData.recordings.map(async (recording: any) => {
      const artist = recording["artist-credit"]?.[0]?.name;
      const query = `${recording.title} ${artist || ""}`;
      const spotifyData = await searchSpotify(query, "track");
      const spotifyTrack = spotifyData.tracks?.items?.[0];

      return {
        musicbrainz: recording,
        spotify: {
          id: spotifyTrack?.id,
          name: spotifyTrack?.name,
          album: spotifyTrack?.album?.name,
          image: spotifyTrack?.album?.images?.[0]?.url || null,
          artists: spotifyTrack?.artists?.map((a: any) => a.name)
        }
      };
    })
  );

  res.json(results);
}
