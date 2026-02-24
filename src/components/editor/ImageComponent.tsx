import { useEffect, useState, useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { assetService } from '../../services/AssetService';
import { extractAssetId } from '../../utils/assetUrlHandler';
import { Loader2, Trash2, ImageOff } from 'lucide-react';

const ImageComponent = ({ node, deleteNode }: any) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  // Track the blob URL in a ref so cleanup always has access to the latest value,
  // regardless of when the effect cleanup function was created.
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const src = node.attrs.src;

    const loadImage = async () => {
      try {
        const assetId = extractAssetId(src);

        if (assetId) {
          const asset = await assetService.getAsset(assetId);

          if (!active) return;

          if (asset) {
            const url = assetService.createObjectURL(asset.blob);
            blobUrlRef.current = url;
            setImageUrl(url);
            setLoading(false);
          } else {
            setError('Asset not found');
            setLoading(false);
          }
        } else {
          if (active) {
            // External URL — no blob to manage
            setImageUrl(src);
            setLoading(false);
          }
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
      // Always revoke whatever blob URL was created during this effect's lifetime.
      // Using a ref guarantees we revoke the URL that was actually set, not the
      // stale null captured at effect-creation time.
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        assetService.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [node.attrs.src]);

  const handleDelete = async () => {
    const src = node.attrs.src;
    const assetId = extractAssetId(src);

    if (assetId) {
      try {
        await assetService.deleteAsset(assetId);
      } catch (err) {
        console.error('Failed to delete asset:', err);
      }
    }
    deleteNode();
  };

  if (loading) {
    return (
      <NodeViewWrapper className="flex items-center justify-center p-4 bg-stone-800/30 rounded-lg my-2 border border-stone-800 border-dashed">
        <Loader2 className="w-5 h-5 text-bhagwa animate-spin mr-2" />
        <span className="text-xs text-stone-500">Loading...</span>
      </NodeViewWrapper>
    );
  }

  if (error || !imageUrl) {
    return (
      <NodeViewWrapper className="flex flex-col items-center justify-center p-4 bg-red-900/10 border border-red-900/30 rounded-lg my-2 relative group">
        <div className="flex items-center gap-2 mb-1">
          <ImageOff className="w-5 h-5 text-red-400" />
          <span className="text-sm font-medium text-red-400">Load Failed</span>
        </div>
        <button
          onClick={handleDelete}
          className="mt-2 text-xs flex items-center gap-1 text-stone-400 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900/20"
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-2">
      {/* inline-block so absolute children are scoped to image dimensions */}
      <span
        className="relative inline-block group"
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
      >
        <img
          src={imageUrl}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || ''}
          className="max-w-full h-auto rounded-lg border border-stone-700 bg-stone-900 block"
        />

        {showDelete && (
          <button
            onClick={handleDelete}
            className="absolute top-6 right-2 p-2 bg-red-500/90 hover:bg-red-600 rounded-lg transition-all shadow-lg backdrop-blur-sm"
            title="Delete image"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        )}
      </span>
    </NodeViewWrapper>
  );
};

export default ImageComponent;
