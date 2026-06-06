import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Album {
  id: string;
  title: string;
  artist: string;
  image: string;
}

interface AlbumCarouselProps {
  title: string;
  albums: Album[];
}

export default function AlbumCarousel({ title, albums }: AlbumCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const newScrollPosition =
        direction === 'left'
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>

      <div className="relative group">
        {/* Left scroll button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Carousel */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {albums.map((album) => (
            <div
              key={album.id}
              className="flex-shrink-0 cursor-pointer group/item transition-transform"
            >
              {/* Album Poster */}
              <div className="relative w-48 h-48 overflow-hidden rounded-lg border-2 border-gray-800 hover:border-accent transition-colors">
                <img
                  src={album.image}
                  alt={album.title}
                  className="w-full h-full object-cover"
                />
                {/* Dark Overlay on Hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="bg-accent text-black px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition">
                    Ver detalhes
                  </button>
                </div>
              </div>

              {/* Album Info */}
              <div className="mt-3">
                <h3 className="text-white font-semibold truncate text-sm">
                  {album.title}
                </h3>
                <p className="text-gray-400 truncate text-xs">{album.artist}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Right scroll button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
