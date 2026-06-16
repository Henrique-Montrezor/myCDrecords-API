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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Inicia o fluxo de login com Spotify
   * Redireciona o usuário para o servidor de autorização do Spotify
   */
  initiateSpotifyLogin(): void {
    window.location.href = `${API_BASE_URL}/api/spotify/login-spotify`;
  }

  /**
   * Obtém o token de acesso do usuário a partir do backend
   * Usado para chamadas à API do Spotify que requerem autenticação do usuário
   */
  async getUserSpotifyToken(): Promise<string | null> {
    try {
      // Tenta obter token através do backend (requer autenticação do usuário)
      const response = await axios.get(`${API_BASE_URL}/api/spotify/user-token`, {
        withCredentials: true
      }).catch(() => null);

      if (response?.data?.accessToken) {
        this.accessToken = response.data.accessToken;
        this.tokenExpiry = Date.now() + (response.data.expiresIn || 3600) * 1000;
        return this.accessToken;
      }

      return null;
    } catch (error) {
      console.warn('Erro ao obter token Spotify do usuário:', error);
      return null;
    }
  }

  /**
   * Busca um álbum usando a API do Spotify através do backend
   * Não requer autenticação do usuário
   */
  async searchAlbum(name: string, artist?: string): Promise<SpotifyAlbum | null> {
    try {
      const query = artist ? `${name} ${artist}` : name;
      const response = await axios.get(`${API_BASE_URL}/api/spotify/search`, {
        params: {
          query: query
        },
        withCredentials: true
      });

      const albums = response.data.albums?.items || [];
      return albums.length > 0 ? albums[0] : null;
    } catch (error) {
      console.warn('Erro ao buscar álbum no Spotify:', error);
      return null;
    }
  }

  /**
   * Obtém dados de artistas top do usuário (requer autenticação Spotify)
   */
  async getTopArtists(timeRange: string = 'medium_term', limit: number = 20): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/spotify/top/artists`, {
        params: { timeRange, limit },
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.warn('Erro ao obter artistas top:', error);
      return null;
    }
  }

  /**
   * Obtém dados de músicas top do usuário (requer autenticação Spotify)
   */
  async getTopTracks(timeRange: string = 'medium_term', limit: number = 20): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/spotify/top/tracks`, {
        params: { timeRange, limit },
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.warn('Erro ao obter músicas top:', error);
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
