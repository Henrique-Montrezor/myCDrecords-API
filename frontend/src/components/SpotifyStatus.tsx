import { useEffect, useState } from 'react';
import { spotifyService } from '../lib/spotifyService';

interface SpotifyStatusProps {
  className?: string;
}

interface TopItem {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
}

export const SpotifyStatus = ({ className = '' }: SpotifyStatusProps) => {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [topArtists, setTopArtists] = useState<TopItem[]>([]);
  const [topTracks, setTopTracks] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSpotifyConnection = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await spotifyService.getUserSpotifyToken();
        setConnected(!!token);

        if (token) {
          // Carrega dados adicionais
          const artists = await spotifyService.getTopArtists('medium_term', 5);
          const tracks = await spotifyService.getTopTracks('medium_term', 5);

          if (artists?.items) {
            setTopArtists(artists.items);
          }
          if (tracks?.items) {
            setTopTracks(tracks.items);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkSpotifyConnection();
  }, []);

  if (loading) {
    return <div className={`p-4 text-gray-500 ${className}`}>Verificando conexão Spotify...</div>;
  }

  if (!connected) {
    return null;
  }

  return (
    <div className={`p-4 bg-green-50 border border-green-200 rounded-lg ${className}`}>
      <h3 className="font-semibold text-green-900 mb-4">Conectado ao Spotify ✓</h3>

      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {topArtists.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Seus artistas favoritos:</h4>
          <ul className="space-y-1 text-sm">
            {topArtists.slice(0, 3).map((artist) => (
              <li key={artist.id} className="text-gray-600">
                • {artist.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {topTracks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Suas músicas favoritas:</h4>
          <ul className="space-y-1 text-sm">
            {topTracks.slice(0, 3).map((track) => (
              <li key={track.id} className="text-gray-600">
                • {track.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
