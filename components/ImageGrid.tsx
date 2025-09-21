import React from 'react';
import type { GeneratedImage } from '../types';

interface ImageGridProps {
  images: GeneratedImage[];
  isLoading: boolean;
  onRegenerate?: (imageId: number) => void;
  regeneratingImageId?: number | null;
}

const PlaceholderCard: React.FC<{ title: string }> = ({ title }) => (
  <div className="aspect-video bg-slate-800 rounded-lg flex flex-col items-center justify-center p-4 border border-slate-700">
    <svg className="w-16 h-16 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 14m6-6l.01.01"></path>
    </svg>
    <span className="text-slate-500 text-sm text-center">{title}</span>
  </div>
);

const Loader: React.FC = () => (
    <div className="absolute inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-10 rounded-lg">
      <svg className="animate-spin h-12 w-12 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="mt-4 text-slate-300">Generating your scene...</p>
      <p className="mt-1 text-sm text-slate-500">This may take a moment.</p>
    </div>
);

const CardLoader: React.FC = () => (
    <div className="absolute inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-20 rounded-lg">
      <svg className="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="mt-2 text-slate-400 text-xs">Regenerating...</p>
    </div>
);


const ImageGrid: React.FC<ImageGridProps> = ({ images, isLoading, onRegenerate, regeneratingImageId }) => {
  return (
    <div className="relative w-full">
      {isLoading && <Loader />}
      <div className={`grid grid-cols-2 gap-4 ${isLoading ? 'opacity-50' : ''}`}>
        {images.length > 0
          ? images.map((image) => {
              const isRegeneratingThis = regeneratingImageId === image.id;
              if (image.src) {
                return (
                  <div key={image.id} className="aspect-video bg-slate-800 rounded-lg overflow-hidden group relative border border-slate-700">
                    {isRegeneratingThis && <CardLoader />}
                    <img src={image.src} alt={image.title} className={`w-full h-full object-cover transition-opacity ${isRegeneratingThis ? 'opacity-20' : ''}`} />
                    <div className={`absolute inset-0 transition-opacity ${isRegeneratingThis ? 'opacity-0' : ''}`}>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-2 text-center text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                        {image.title}
                      </div>
                      <a
                        href={image.src}
                        download={`${image.title.replace(/\s+/g, '_')}.png`}
                        className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-opacity-75 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 z-10"
                        aria-label={`Download ${image.title}`}
                        title={`Download ${image.title}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </a>
                      {onRegenerate && (
                        <button
                          onClick={() => onRegenerate(image.id)}
                          disabled={regeneratingImageId !== null}
                          className="absolute top-2 left-2 p-2 bg-black bg-opacity-50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-opacity-75 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Regenerate ${image.title}`}
                          title={`Regenerate ${image.title}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm10 10a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 01-1 1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={image.id} className="aspect-video bg-slate-800 rounded-lg flex flex-col items-center justify-center p-4 border border-red-500/50 relative">
                    {isRegeneratingThis && <CardLoader />}
                    <div className={`flex flex-col items-center justify-center text-center transition-opacity ${isRegeneratingThis ? 'opacity-20' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400 mb-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-slate-300 text-xs font-semibold">{image.title}</p>
                      <p className="text-red-400 text-xs mt-1">Generation Failed</p>
                      {onRegenerate && (
                          <button
                              onClick={() => onRegenerate(image.id)}
                              disabled={regeneratingImageId !== null}
                              className="mt-2 text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Try Again
                          </button>
                      )}
                    </div>
                  </div>
                );
              }
            })
          : [
              { id: 1, title: 'Faucet Close-up' },
              { id: 2, title: 'Low Wide Shot' },
              { id: 3, title: 'Eye-Level Full Shot' },
              { id: 4, title: 'Drain Extreme Close-up' },
            ].map((p) => <PlaceholderCard key={p.id} title={p.title} />)
        }
      </div>
    </div>
  );
};

export default ImageGrid;
