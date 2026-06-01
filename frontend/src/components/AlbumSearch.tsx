import { useState, useRef, useEffect } from 'react';
import { Search, Loader } from 'lucide-react';
import apiClient from '../lib/apiClient';

interface SearchResult {
  id: string;
  title: string;
  artistCredit?: Array<{ name: string }>;
  releaseDate?: string;
  imageUrl?: string;
  disambiguation?: string;
}

export default function AlbumSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 2) {
        searchAlbums(query);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const searchAlbums = async (searchQuery: string) => {
    setLoading(true);
    try {
      console.log('Buscando:', searchQuery);
      const response = await apiClient.get('/albuns/buscar', {
        params: {
          nome: searchQuery,
          limite: 12
        }
      });

      console.log('Resposta:', response.data);
      const albums = response.data['release-groups'] || [];
      
      const formattedResults: SearchResult[] = albums.map((album: any) => ({
        id: album.id,
        title: album.title,
        artistCredit: album['artist-credit'],
        releaseDate: album['first-release-date'],
        disambiguation: album.disambiguation
      }));

      setResults(formattedResults);
      setIsOpen(true);
    } catch (error) {
      console.error('Erro ao buscar álbuns:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const getArtistName = (artistCredit?: Array<{ name: string }>) => {
    if (!artistCredit || artistCredit.length === 0) return 'Artista Desconhecido';
    return artistCredit.map(a => a.name).join(', ');
  };

  const handleResultClick = (album: SearchResult) => {
    console.log('Álbum selecionado:', album);
    setQuery('');
    setIsOpen(false);
    setResults([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Campo de Busca */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400 group-focus-within:text-green-400 transition-colors" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length > 2 && setIsOpen(true)}
          placeholder="Buscar um álbum para adicionar ou criticar..."
          className="w-full p-4 pl-12 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base shadow-inner transition-all"
        />
        {loading && (
          <Loader className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 animate-spin" />
        )}
      </div>

      {/* Resultados da Busca */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
          <div className="divide-y divide-gray-800">
            {results.map((album) => (
              <div
                key={album.id}
                onClick={() => handleResultClick(album)}
                className="p-4 hover:bg-gray-800 transition-colors cursor-pointer flex gap-4 items-start"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">
                    {album.title}
                  </h3>
                  <p className="text-gray-400 text-sm truncate">
                    {getArtistName(album.artistCredit)}
                  </p>
                  {album.releaseDate && (
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(album.releaseDate).getFullYear()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado: Nenhum resultado */}
      {isOpen && query.trim().length > 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-8 text-center">
          <p className="text-gray-400">Nenhum álbum encontrado para "{query}"</p>
        </div>
      )}
    </div>
  );
}
