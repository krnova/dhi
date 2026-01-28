  // Plain Text Image Upload Component
  import React, { useRef, useState } from 'react';
  import { Image as ImageIcon, Upload } from 'lucide-react';
  import { assetService } from '../../services/AssetService';
  import { cn } from '../../utils/cn';

  interface PlainTextImageUploadProps {
    noteId: string;
    onInsert: (markdown: string, cursorPosition?: number) => void;
  }

  export const PlainTextImageUpload: React.FC<PlainTextImageUploadProps> = ({ noteId, onInsert }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = async (file: File) => {
      setUploading(true);
      try {
        const asset = await assetService.uploadImage(file, noteId);
        // Use dhi-asset:// to prevent browser from trying to load it
        const markdown = `![${file.name}](dhi-asset://${asset.id})`;
        onInsert(markdown);
      } catch (error) {
        console.error('Image upload failed:', error);
        alert(error instanceof Error ? error.message : 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    };

    const handleButtonClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <button
          onClick={handleButtonClick}
          disabled={uploading}
          className={cn(
            'p-2 rounded-lg transition-all min-w-[40px] min-h-[40px] flex items-center justify-center',
            uploading
              ? 'bg-stone-800 text-bhagwa'
              : 'text-stone-400 hover:bg-stone-800 hover:text-sand'
          )}
          title="Upload Image (max 5MB)"
        >
          {uploading ? <Upload className="w-4 h-4 animate-pulse" /> : <ImageIcon className="w-4 h-4" />}
        </button>
      </>
    );
  };
