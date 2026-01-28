import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    let active = true;
    console.log(`[AssetImage] Mounting for ID: ${assetId}`);

    const loadImage = async () => {
      try {
        const asset = await assetService.getAsset(assetId);
        console.log(`[AssetImage] DB Result for ${assetId}:`, asset ? 'Found' : 'Not Found');

        if (!active) return;

        if (asset) {
          const url = assetService.createObjectURL(asset.blob);
          console.log(`[AssetImage] Generated Blob URL: ${url}`);
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
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-stone-800/30 rounded-lg my-2 border border-stone-800 border-dashed">
        <Loader2 className="w-5 h-5 text-bhagwa animate-spin" />
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
      onError={(e) => {
        console.error('[AssetImage] Browser refused to render Blob URL');
        setError('Browser render error');
      }}
    />
  );
};
