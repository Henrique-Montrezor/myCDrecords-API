import { useState, useEffect } from 'react';
import AlbumSearch from '../components/AlbumSearch';
import AlbumCarouselNew from '../components/AlbumCarouselNew';
import apiClient from '../lib/apiClient';

interface Album {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  releaseDate?: string;
}

export default function Home() {
  const [trendingAlbums, setTrendingAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrendingAlbums();
  }, []);

  const fetchTrendingAlbums = async () => {
    setLoading(true);
    try {
      // Buscar alguns álbuns populares como exemplo
      const response = await apiClient.get('/albuns/buscar', {
        params: {
          nome: 'album',
          limite: 12
        }
      });

      const albums = (response.data['release-groups'] || []).slice(0, 12).map((album: any) => ({
        id: album.id,
        name: album.title,
        artist: album['artist-credit']?.[0]?.name || 'Artista Desconhecido',
        imageUrl: undefined,
        releaseDate: album['first-release-date']
      }));

      setTrendingAlbums(albums);
    } catch (error) {
      console.error('Erro ao buscar álbuns trending:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section com Busca Principal */}
      <div className="relative bg-gray-800 rounded-2xl p-8 mb-12 overflow-visible shadow-2xl border border-gray-700 mx-4 md:mx-0">
        {/* Background decorativo sutil */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-green-500 rounded-full opacity-10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 font-poppins">
            Bem vindo ao
            <span className="text-green-400 font-bold"> myCDrecords</span>
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            Registre, avalie e descubra novas músicas com sua comunidade!
          </p>

          {/* Componente de Busca */}
          <div className="max-w-2xl mx-auto">
            <AlbumSearch />
          </div>
        </div>
      </div>

      {/* Container Principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Carregando álbuns...</div>
          </div>
        ) : (
          <>
            {/* Seção de Novidades */}
            <AlbumCarouselNew
              albums={trendingAlbums}
              title="🎵 Novidades e Lançamentos"
              onAlbumClick={(album) => console.log('Clicou em:', album)}
            />

            {/* Seção de Recomendações */}
            {trendingAlbums.length > 0 && (
              <AlbumCarouselNew
                albums={trendingAlbums.slice(0, 8)}
                title="⭐ Seus álbuns mais ouvidos"
                onAlbumClick={(album) => console.log('Clicou em:', album)}
              />
            )}

            {/* Seção Popular */}
            {trendingAlbums.length > 0 && (
              <AlbumCarouselNew
                albums={trendingAlbums.slice(4, 12)}
                title="🔥 Popular Esta Semana"
                onAlbumClick={(album) => console.log('Clicou em:', album)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
