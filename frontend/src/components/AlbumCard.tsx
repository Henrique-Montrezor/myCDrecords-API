import { useState } from 'react';

interface AlbumCardProps {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  releaseDate?: string;
  onClick?: () => void;
}

export default function AlbumCard({ 
  id, 
  name, 
  artist, 
  imageUrl, 
  releaseDate,
  onClick 
}: AlbumCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onClick?.();
  };

  return (
    <div 
      onClick={handleClick}
      className="flex-none w-[45%] sm:w-[30%] md:w-[22%] lg:w-[19%] snap-start relative group transition-all duration-300 hover:z-30 hover:scale-105 origin-center cursor-pointer"
    >
      <div className="block relative w-full aspect-[2/3] bg-gray-800 shadow-lg group-hover:shadow-green-500/30 group-hover:shadow-2xl rounded overflow-hidden">
        
        {/* Borda Verde Externa Animada */}
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-green-500 z-20 pointer-events-none transition-colors duration-300"></div>

        {imageUrl && !imageError ? (
          <img 
            src={imageUrl}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 text-gray-500 p-2 text-center border border-gray-700">
            <span className="text-[10px] uppercase font-bold mb-1">Álbum</span>
            <span className="text-xs font-serif italic line-clamp-3">{name}</span>
            {artist && <span className="text-[9px] text-gray-600 mt-2">{artist}</span>}
          </div>
        )}

        {/* Overlay Hover com Título */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none flex flex-col justify-end translate-y-2 group-hover:translate-y-0">
          <h3 className="text-white text-xs font-bold leading-tight line-clamp-2 drop-shadow-md tracking-wide">
            {name}
          </h3>
          <p className="text-green-400 text-[10px] truncate mt-1 font-medium">
            {artist}
          </p>
          {releaseDate && (
            <p className="text-gray-400 text-[9px] truncate mt-0.5">
              {new Date(releaseDate).getFullYear()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
