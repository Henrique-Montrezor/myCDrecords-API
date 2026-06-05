import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, Music } from 'lucide-react';
import apiClient from '../lib/apiClient';

interface AlbumArtist {
  name: string;
  id?: string;
}

interface AlbumImage {
  url: string;
}

interface Track {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  artists?: AlbumArtist[];
}

interface AlbumDetails {
  id: string;
  name: string;
  artists: AlbumArtist[];
  release_date?: string;
  total_tracks?: number;
  label?: string;
  genres?: string[];
  tags?: string[];
  type?: string;
  secondaryTypes?: string[];
  images?: AlbumImage[];
  tracks?: {
    items: Track[];
  };
  external_urls?: {
    spotify?: string;
  };
}

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const nome = searchParams.get('nome')?.trim();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<AlbumDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id && !nome) {
      setError('ID ou nome do álbum não foi informado.');
      setLoading(false);
      return;
    }

    const fetchAlbumDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        let albumData: any = null;

        if (id) {
          const response = await apiClient.get(`/albuns/${id}`);
          albumData = response.data;
        } else {
          const response = await apiClient.get('/albuns/info', {
            params: {
              nome
            }
          });

          const spotifyAlbum = response.data?.spotify ?? null;
          const mbAlbum = response.data?.musicbrainz?.['release-groups']?.[0] ?? null;

          if (spotifyAlbum) {
            albumData = {
              ...spotifyAlbum,
              genres: spotifyAlbum.genres?.length ? spotifyAlbum.genres : mbAlbum?.genres?.map((genre: any) => genre.name) || [],
              tags: mbAlbum?.tags?.map((tag: any) => tag.name) || [],
              type: spotifyAlbum.album_type || mbAlbum?.['primary-type'],
              secondaryTypes: mbAlbum?.['secondary-types'] || []
            };
          } else if (mbAlbum) {
            albumData = {
              id: mbAlbum.id,
              name: mbAlbum.title,
              artists: mbAlbum['artist-credit']?.map((artist: any) => ({ name: artist.name })) || [],
              release_date: mbAlbum['first-release-date'],
              total_tracks: undefined,
              label: undefined,
              genres: mbAlbum.genres?.map((genre: any) => genre.name) || [],
              tags: mbAlbum.tags?.map((tag: any) => tag.name) || [],
              type: mbAlbum['primary-type'],
              secondaryTypes: mbAlbum['secondary-types'] || [],
              images: []
            };
          }
        }

        if (!albumData) {
          setError('Álbum não encontrado.');
          setAlbum(null);
        } else {
          setAlbum(albumData);
        }
      } catch (fetchError) {
        console.error('Erro ao buscar informações do álbum:', fetchError);
        setError('Não foi possível carregar os detalhes do álbum.');
        setAlbum(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumDetails();
  }, [id, nome]);

  const artistNames = album?.artists?.map((artist) => artist.name).join(', ') || 'Artista Desconhecido';
  const imageUrl = album?.images?.[0]?.url;
  const releaseYear = album?.release_date ? new Date(album.release_date).getFullYear() : '';

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Backdrop Fundo Borrado com Gradiente */}
      {imageUrl && (
        <>
          {/* Imagem de fundo borrada */}
          <div
            className="fixed top-0 left-0 right-0 h-full pointer-events-none"
            style={{
              backgroundImage: `url('${imageUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(80px) brightness(0.6) saturate(1.3)',
              zIndex: 0,
              opacity: 0.4
            }}
          />
          
          {/* Gradiente overlay: imagem -> transparente -> cor de fundo */}
          <div
            className="fixed top-0 left-0 right-0 h-full pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 30%, rgba(3,7,18,0.5) 60%, rgba(3,7,18,1) 100%)',
              zIndex: 1
            }}
          />
        </>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 mb-8 text-gray-300 hover:text-green-400 transition text-sm font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader className="w-8 h-8 text-green-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500 bg-gray-900 p-8 text-center text-red-300">
            <p>{error}</p>
          </div>
        ) : album ? (
          <>
            {/* HEADER DO ÁLBUM (Grid: Capa | Info) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              
              {/* COLUNA 1: CAPA E AÇÕES */}
              <div className="md:col-span-1 flex flex-col gap-4">
                {/* Capa */}
                <div className="rounded-lg overflow-hidden aspect-square bg-gray-800 shadow-lg border border-gray-700 hover:border-gray-500 transition">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900">
                      <Music className="w-16 h-16" />
                    </div>
                  )}
                </div>

                {/* Painel de Ações (Estilo Letterboxd) */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 flex justify-around items-center shadow-lg">
                  {/* Botão Listen List */}
                  <button
                    title="Quero Ouvir"
                    className="flex-1 text-center py-3 hover:bg-gray-700 transition text-gray-300 hover:text-green-400 rounded"
                  >
                    <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mt-1">Ouvir</span>
                  </button>

                  <div className="w-px h-8 bg-gray-600" />

                  {/* Botão Favorito */}
                  <button
                    title="Favoritar"
                    className="flex-1 text-center py-3 hover:bg-gray-700 transition text-gray-300 hover:text-yellow-400 rounded"
                  >
                    <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 006.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"></path>
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mt-1">Like</span>
                  </button>

                  <div className="w-px h-8 bg-gray-600" />

                  {/* Botão Review */}
                  <a href="#review-section" className="flex-1 text-center py-3 hover:bg-gray-700 transition text-gray-300 hover:text-blue-400 rounded">
                    <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mt-1">Review</span>
                  </a>
                </div>
              </div>

              {/* COLUNA 2: DETALHES E TRACKLIST */}
              <div className="md:col-span-3 text-gray-300">
                
                {/* Título e Ano */}
                <h1 className="text-5xl font-bold text-white mb-1 flex items-baseline gap-3">
                  {album.name}
                  <span className="text-2xl font-normal text-gray-500">{releaseYear}</span>
                </h1>
                
                {/* Créditos */}
                <div className="mb-6 text-sm">
                  <span className="text-gray-400">Um álbum de</span>
                  <span className="text-white font-bold uppercase tracking-wide"> {artistNames}</span>
                </div>

                {album.type || (album.secondaryTypes && album.secondaryTypes.length > 0) || (album.tags && album.tags.length > 0) ? (
                  <div className="mb-6 flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-gray-400">
                    {album.type && (
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-white">
                        {album.type}
                      </span>
                    )}
                    {album.secondaryTypes && album.secondaryTypes.length > 0 && (
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-white">
                        {album.secondaryTypes.join(', ')}
                      </span>
                    )}
                    {album.tags && album.tags.length > 0 && (
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-gray-300">
                        Tags: {album.tags.slice(0, 4).join(', ')}
                      </span>
                    )}
                  </div>
                ) : null}

                {/* Descrição */}
                <div className="font-serif text-lg leading-relaxed text-gray-300 mb-8 max-w-2xl">
                  <p>
                    Lançado oficialmente em {album.release_date ? new Date(album.release_date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'data desconhecida'} pela gravadora{' '}
                    <strong className="text-gray-200">{album.label || 'Independente'}</strong>.
                    
                    {album.total_tracks && (
                      <>
                        {' '}Esta obra contém <strong>{album.total_tracks}</strong> faixas
                        {album.tracks?.items && (
                          <> com uma duração total de aproximadamente <strong>{Math.floor(album.tracks.items.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / 60000)}</strong> minutos.</>
                        )}
                      </>
                    )}
                    
                    {album.genres && album.genres.length > 0 && (
                      <> Os gêneros predominantes incluem <span className="text-white capitalize">{album.genres.join(', ')}</span>.</>
                    )}
                  </p>
                </div>

                {/* Abas de Navegação */}
                <div className="border-b border-gray-700 mb-4 flex gap-6 text-xs font-bold uppercase tracking-widest text-gray-500">
                  <span className="text-green-400 border-b-2 border-green-400 pb-2">Faixas</span>
                  <span className="hover:text-white cursor-pointer transition-colors">Detalhes</span>
                </div>

                {/* Tracklist */}
                {album.tracks?.items && album.tracks.items.length > 0 ? (
                  <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden shadow-inner">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-800 text-gray-400 uppercase text-[10px] font-bold tracking-wider border-b border-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-center w-10">#</th>
                          <th className="px-4 py-3">Título</th>
                          <th className="px-4 py-3 text-right w-20">Duração</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {album.tracks.items.map((track) => (
                          <tr key={track.id} className="hover:bg-gray-800 transition-colors group">
                            <td className="px-4 py-3 text-center text-gray-600 group-hover:text-green-400 font-mono text-xs">{track.track_number}</td>
                            <td className="px-4 py-3">
                              <span className="text-gray-200 group-hover:text-white font-medium">{track.name}</span>
                              {track.artists && track.artists.length > 1 && (
                                <span className="text-xs text-gray-500 ml-2 block sm:inline">
                                  feat. {track.artists.slice(1).map(a => a.name).join(', ')}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                              {formatDuration(track.duration_ms)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center text-gray-500 italic">
                    Faixas indisponíveis
                  </div>
                )}

                {/* Link Spotify */}
                {album.external_urls?.spotify && (
                  <div className="mt-4 flex justify-end">
                    <a
                      href={album.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 text-green-400 hover:text-white transition-colors font-bold uppercase tracking-wider"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.9-.6 13.561 1.621.42.181.6.779.18 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      Ouvir no Spotify
                    </a>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-gray-700 my-12" />

            {/* SEÇÃO DE REVIEWS E ATIVIDADE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12" id="review-section">
              
              {/* Reviews (Esquerda - 2/3) */}
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Reviews Populares</h3>
                </div>

                <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg mb-8">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0" />
                    <div className="flex-grow">
                      <textarea
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors resize-none"
                        placeholder="Escreva sua opinião..."
                      />
                      
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex gap-1 text-gray-600">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <svg key={i} className="w-6 h-6 cursor-pointer hover:text-green-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                          ))}
                        </div>
                        
                        <button className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase px-6 py-2 rounded transition-colors">
                          Publicar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-gray-500 text-sm italic text-center py-8">
                  Ninguém avaliou este álbum ainda. Seja o primeiro!
                </div>
              </div>

              {/* Sidebar (Direita - 1/3) */}
              <div className="md:col-span-1 space-y-8">
                
                {/* Widget: Onde Ouvir */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-700 pb-1">Onde Ouvir</h4>
                  {album.external_urls?.spotify ? (
                    <a
                      href={album.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.9-.6 13.561 1.621.42.181.6.779.18 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                        <span className="text-sm font-medium text-white group-hover:text-green-400">Spotify</span>
                      </div>
                      <span className="text-xs text-gray-500">Stream</span>
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">Não disponível</p>
                  )}
                </div>

                {/* Widget: Detalhes Rápidos */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1">Detalhes</h4>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Faixas</span>
                    <p className="text-white font-semibold">{album.total_tracks ?? 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Gravadora</span>
                    <p className="text-white font-semibold text-sm">{album.label ?? 'Não informado'}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
