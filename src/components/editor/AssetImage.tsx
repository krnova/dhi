import React, { useEffect, useState, useRef } from 'react';
import { assetService } from '../../services/AssetService';
import { Loader2, ImageOff } from 'lucide-react';

interface AssetImageProps {
  assetId: string;
  alt?: string;
}

export const AssetImage: React.FC<AssetImageProps> = ({ assetId, alt }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // 🔥 OPTIMIZATION: Lazy load with Intersection Observer
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Load 200px before visible
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;

    let active = true;
    console.log(`[AssetImage] Loading ${assetId}`);

    const loadImage = async () => {
      try {
        const asset = await assetService.getAsset(assetId);

        if (!active) return;

        if (asset) {
          const url = assetService.createObjectURL(asset.blob);
          setImageUrl(url);
          setLoading(false);
        } else {
          setError('Asset not found in IndexedDB');
          setLoading(false);
        }
      } catch (err: any) {
        console.error(`[AssetImage] Error loading ${assetId}:`, err);
        if (active) {
          setError(err.message || 'Unknown error');
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      active = false;
      if (imageUrl && imageUrl.startsWith('blob:')) {
        console.log(`[AssetImage] Revoking URL: ${imageUrl}`);
        assetService.revokeObjectURL(imageUrl);
      }
    };
  }, [shouldLoad, assetId]);

  if (!shouldLoad || loading) {
    return (
      <div 
        ref={imgRef}
        className="flex items-center justify-center p-8 bg-stone-800/30 rounded-lg my-2 border border-stone-800 border-dashed min-h-[120px]"
      >
        {shouldLoad && <Loader2 className="w-5 h-5 text-bhagwa animate-spin" />}
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-red-900/10 border border-red-900/30 rounded-lg my-2">
        <ImageOff className="w-6 h-6 text-red-400 mb-2" />
        <span className="text-sm font-medium text-red-400">Image Error</span>
        <span className="text-xs text-red-400/70 font-mono mt-1">{error}</span>
        <span className="text-[10px] text-stone-500 mt-1">ID: {assetId}</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || 'Image'}
      className="max-w-full h-auto rounded-lg border border-stone-700 my-2 shadow-sm"
      loading="lazy"
      onError={(e) => {
        console.error('[AssetImage] Browser refused to render Blob URL');
        setError('Browser render error');
      }}
    />
  );
};
