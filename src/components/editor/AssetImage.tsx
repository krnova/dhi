import React, { useEffect, useState, useRef, useMemo } from 'react';
import { assetService } from '../../services/AssetService';
import { Loader2, ImageOff } from 'lucide-react';

interface AssetImageProps {
  assetId: string;
  alt?: string;
}

const AssetImageComponent: React.FC<AssetImageProps> = ({ assetId, alt }) => {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef<HTMLSpanElement>(null);

  // Lazy load with Intersection Observer
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  // Load asset from IndexedDB
  useEffect(() => {
    if (!shouldLoad) return;

    let active = true;

    const loadImage = async () => {
      try {
        const asset = await assetService.getAsset(assetId);

        if (!active) return;

        if (asset) {
          setImageBlob(asset.blob);
          setLoading(false);
        } else {
          setError('Asset not found in IndexedDB');
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Unknown error');
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      active = false;
    };
  }, [shouldLoad, assetId]);

  // Memoize blob URL - only create once per blob
  const imageUrl = useMemo(() => {
    if (!imageBlob) return null;
    return assetService.createObjectURL(imageBlob);
  }, [imageBlob]);

  // Cleanup blob URL when component unmounts or blob changes
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        assetService.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  if (!shouldLoad || loading) {
    return (
      <span 
        ref={imgRef}
        className="flex items-center justify-center p-8 bg-stone-800/30 rounded-lg my-2 border border-stone-800 border-dashed min-h-[120px]"
        style={{ display: 'block' }}
      >
        {shouldLoad && <Loader2 className="w-5 h-5 text-bhagwa animate-spin" />}
      </span>
    );
  }

  if (error || !imageUrl) {
    return (
      <span 
        className="flex flex-col items-center justify-center p-4 bg-red-900/10 border border-red-900/30 rounded-lg my-2"
        style={{ display: 'block' }}
      >
        <ImageOff className="w-6 h-6 text-red-400 mb-2" />
        <span className="text-sm font-medium text-red-400">Image Error</span>
        <span className="text-xs text-red-400/70 font-mono mt-1">{error}</span>
        <span className="text-[10px] text-stone-500 mt-1">ID: {assetId}</span>
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || 'Image'}
      className="max-w-full h-auto rounded-lg border border-stone-700 my-2 shadow-sm"
      loading="lazy"
      onError={() => {
        setError('Browser render error');
      }}
    />
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const AssetImage = React.memo(AssetImageComponent);
