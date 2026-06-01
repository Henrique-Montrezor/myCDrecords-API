import axios from 'axios';

interface SpotifyAlbum {
  id: string;
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
  artists: Array<{ name: string }>;
  release_date: string;
}

interface CombinedAlbum {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  releaseDate?: string;
  spotifyId?: string;
}

const SPOTIFY_API = 'https://api.spotify.com/v1';

class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async getAccessToken(): Promise<string | null> {
    // Tenta usar o token do backend se disponível
    try {
      // Se o token ainda é válido, retorna
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Tenta obter token através do backend
      const backendResponse = await axios.get('/api/spotify/token', {
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3004'
      }).catch(() => null);

      if (backendResponse?.data?.access_token) {
        this.accessToken = backendResponse.data.access_token;
        this.tokenExpiry = Date.now() + (backendResponse.data.expires_in || 3600) * 1000;
        return this.accessToken;
      }

      return null;
    } catch (error) {
      console.warn('Erro ao obter token Spotify:', error);
      return null;
    }
  }

  async searchAlbum(name: string, artist?: string): Promise<SpotifyAlbum | null> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        console.warn('Sem token Spotify disponível');
        return null;
      }

      const query = artist ? `${name} ${artist}` : name;
      const response = await axios.get(`${SPOTIFY_API}/search`, {
        params: {
          q: query,
          type: 'album',
          limit: 1
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const albums = response.data.albums?.items || [];
      return albums.length > 0 ? albums[0] : null;
    } catch (error) {
      console.warn('Erro ao buscar álbum no Spotify:', error);
      return null;
    }
  }

  async getAlbumImage(name: string, artist?: string): Promise<string | undefined> {
    try {
      const album = await this.searchAlbum(name, artist);
      return album?.images?.[0]?.url;
    } catch (error) {
      console.warn('Erro ao obter imagem do álbum:', error);
      return undefined;
    }
  }
}

export const spotifyService = new SpotifyService();
export type { SpotifyAlbum, CombinedAlbum };
