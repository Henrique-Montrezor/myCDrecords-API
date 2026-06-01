import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <nav className="bg-surface border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <span className="text-3xl font-bold text-accent" style={{ fontFamily: 'Pacifico, cursive' }}>
              myCD
              <span className="text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>records</span>
            </span>
          </Link>

          {/* Center: Menu Links */}
          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            <Link
              to="/albums"
              className="text-gray-300 hover:text-accent transition font-medium"
            >
              Explorar
            </Link>
            <Link
              to="/artists"
              className="text-gray-300 hover:text-accent transition font-medium"
            >
              Artistas
            </Link>
            <Link
              to="/lists"
              className="text-gray-300 hover:text-accent transition font-medium"
            >
              Listas
            </Link>
          </div>

          {/* Auth Links */}
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <button className="text-gray-300 hover:text-accent transition font-medium">
                  Minha Coleção
                </button>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="bg-accent text-black px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-accent transition font-medium"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="bg-accent text-black px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Registrar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
