import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AlbumSearch from '../components/AlbumSearch';
import AlbumCarouselNew from '../components/AlbumCarousel';
import apiClient from '../lib/apiClient';

interface Album {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  releaseDate?: string;
}

interface User {
  id: string;
  name: string;
}

export default function Home() {
  // Estado para controlar o usuário logado (null = deslogado)
  const [user, setUser] = useState<User | null>(null);
  
  // Estados para as listas de álbuns
  const [friendsAlbums, setFriendsAlbums] = useState<Album[]>([]);
  const [topArtistsAlbums, setTopArtistsAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Para testar a visão de LOGADO, mude temporariamente para: setUser({ id: '1', name: 'Henrique' });
      setUser(null); 
    } catch (error) {
      setUser(null);
    }
  };

  // Dispara a busca correta sempre que o estado do usuário mudar
  useEffect(() => {
    fetchRecommendations(user !== null);
  }, [user]);

  const fetchRecommendations = async (isLoggedIn: boolean) => {
    setLoading(true);
    try {
      if (isLoggedIn) {
        setFriendsAlbums([]); 
      } else {
        // Tente com /albums em vez de /albuns caso o seu backend use inglês
        const response = await apiClient.get('/albuns/em-alta');
        
        // ESPIÃO: Veja no console do navegador o que está chegando!
        console.log("RESPOSTA DA API EM-ALTA:", response.data);

        const albums = (response.data.spotify || []).map((album: any) => ({
          id: album.id,
          name: album.title, 
          artist: album.artistCredit?.[0]?.name || 'Artista Desconhecido', 
          imageUrl: album.imageUrl, 
          releaseDate: album.releaseDate 
        }));

        setTopArtistsAlbums(albums);
      }
    } catch (error) {
      // ESPIÃO DE ERRO: Vai avisar se a rota deu 404 ou 500
      console.error('Erro na requisição /em-alta:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {user ? (
        /* =========================================================
           CENÁRIO: USUÁRIO LOGADO
           ========================================================= */
        <div className="max-w-7xl mx-auto px-4 py-12">
          <header className="mb-12">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 font-poppins">
              Bem-vindo(a) de volta, <span className="text-green-400">{user.name}</span>! 👋
            </h1>
            <p className="text-gray-400 text-lg">Confira o que seus amigos andam escutando.</p>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-gray-400">Carregando recomendações dos amigos...</div>
            </div>
          ) : friendsAlbums.length > 0 ? (
            <AlbumCarouselNew
              albums={friendsAlbums}
              title="🎧 Recomendados pelos seus amigos"
              onAlbumClick={(album) => navigate(`/album/${album.id}`)}
            />
          ) : (
            /* Mensagem incentivando nova review se a lista de amigos estiver vazia */
            <div className="bg-gray-800 p-10 rounded-2xl border border-gray-700 text-center shadow-lg mt-8">
              <h3 className="text-2xl font-bold text-white mb-4">Seus amigos estão quietos... 🤫</h3>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                Nenhum amigo avaliou um álbum recentemente. Que tal quebrar o gelo, pesquisar um álbum abaixo e fazer uma nova review?
              </p>
              <div className="max-w-md mx-auto mb-6">
                <AlbumSearch />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================
           CENÁRIO: USUÁRIO DESLOGADO (VISITANTE)
           ========================================================= */
        <>
          {/* Hero Section / Banner de convite para Login ou Registro */}
          <div className="relative bg-gray-800 rounded-b-2xl p-12 mb-12 overflow-hidden shadow-2xl border-b border-gray-700">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-green-500 rounded-full opacity-10 blur-3xl pointer-events-none"></div>

            <div className="relative z-10 max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 font-poppins">
                Sua coleção musical no <span className="text-green-400">myCDrecords</span> 💿
              </h1>
              <p className="text-gray-300 mb-10 text-xl max-w-2xl mx-auto">
                Descubra músicas incríveis, veja o que seus amigos estão ouvindo e crie seu diário musical definitivo.
              </p>

              <div className="flex justify-center gap-4">
                <Link to="/login" className="bg-green-500 hover:bg-green-400 text-gray-900 font-bold py-3 px-8 rounded-full transition-colors text-lg">
                  Fazer Login
                </Link>
                <Link to="/register" className="bg-transparent border-2 border-gray-500 text-white hover:border-green-400 hover:text-green-400 font-bold py-3 px-8 rounded-full transition-colors text-lg">
                  Criar Conta
                </Link>
              </div>
            </div>
          </div>

          {/* Seção de Recomendações: Top 50 Global */}
          <div className="max-w-7xl mx-auto px-4 py-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-gray-400">Carregando os mais tocados no mundo...</div>
              </div>
            ) : (
              <AlbumCarouselNew
                albums={topArtistsAlbums}
                title="🌍 Em alta: Novos Lançamentos!"
                onAlbumClick={(album) => navigate(`/album/${album.id}`)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}