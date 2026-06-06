import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AlbumCard from './AlbumCard';

interface Album {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  releaseDate?: string;
}

interface AlbumCarouselProps {
  albums: Album[];
  title?: string;
  onAlbumClick?: (album: Album) => void;
}

export default function AlbumCarousel({ 
  albums, 
  title = 'Álbuns',
  onAlbumClick 
}: AlbumCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (albums.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <span className="bg-green-500 w-2 h-8 mr-3 rounded-full"></span>
          {title}
          <span className="ml-4 inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
            {albums.length} álbuns
          </span>
        </h2>
      </div>

      <div className="relative group/carousel">
        {/* Botão Anterior */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-4 z-20 w-16 bg-gradient-to-r from-gray-900 via-gray-900/70 to-transparent flex items-center justify-start pl-2 opacity-100 group-hover/carousel:opacity-100 transition-all duration-500 cursor-pointer group/btn"
          >
            <ChevronLeft className="w-8 h-8 text-gray-200 drop-shadow-lg transition-transform duration-300 group-hover/btn:scale-125 group-hover/btn:-translate-x-1" />
          </button>
        )}

        {/* Lista de Álbuns */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-2 py-4 px-1 scroll-smooth scrollbar-hide snap-x snap-mandatory"
        >
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              id={album.id}
              name={album.name}
              artist={album.artist}
              imageUrl={album.imageUrl}
              releaseDate={album.releaseDate}
              onClick={() => onAlbumClick?.(album)}
            />
          ))}
          <div className="flex-none w-4"></div>
        </div>

        {/* Botão Próximo */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-4 z-20 w-16 bg-gradient-to-l from-gray-900 via-gray-900/70 to-transparent flex items-center justify-end pr-2 opacity-100 group-hover/carousel:opacity-100 transition-all duration-500 cursor-pointer group/btn"
          >
            <ChevronRight className="w-8 h-8 text-gray-200 drop-shadow-lg transition-transform duration-300 group-hover/btn:scale-125 group-hover/btn:translate-x-1" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-4 border-t border-gray-800 pt-3">
        <div className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Mostrando {albums.length} álbuns
        </div>
      </div>
    </section>
  );
}
