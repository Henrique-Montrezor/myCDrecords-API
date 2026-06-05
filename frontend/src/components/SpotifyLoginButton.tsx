import { spotifyService } from '../lib/spotifyService';

interface SpotifyLoginButtonProps {
  className?: string;
  text?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const SpotifyLoginButton = ({
  className = '',
  text = 'Conectar com Spotify',
  onSuccess,
  onError
}: SpotifyLoginButtonProps) => {
  const handleSpotifyLogin = () => {
    try {
      spotifyService.initiateSpotifyLogin();
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao iniciar login com Spotify:', error);
      onError?.(errorMessage);
    }
  };

  return (
    <button
      onClick={handleSpotifyLogin}
      className={`flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${className}`}
    >
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.491 17.412c-.212.336-.668.441-1.004.229-2.748-1.684-6.212-2.064-10.291-1.130-.388.092-.777-.133-.869-.52-.092-.388.133-.777.52-.869 4.568-.987 8.422-.534 11.643 1.305.336.212.441.668.229 1.004zm1.468-3.267c-.268.436-.837.564-1.273.296-3.145-1.927-7.957-2.488-11.705-1.360-.491.150-1.008-.133-1.159-.624-.150-.491.133-1.008.624-1.159 4.324-1.267 9.520-.680 13.131 1.551.436.268.564.837.296 1.273zm.127-3.403c-3.775-2.242-10.013-2.448-13.623-1.354-.589.180-1.212-.147-1.391-.736-.180-.589.147-1.212.736-1.391 4.087-1.242 10.925-1.010 15.261 1.568.471.288.616.928.328 1.399-.288.471-.928.616-1.399.328z" />
      </svg>
      {text}
    </button>
  );
};
