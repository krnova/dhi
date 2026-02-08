import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import { DEFAULT_TAG_COLORS } from '../../stores/notesStore';
import { cn } from '../../utils/cn';

interface TagPaletteSettingsProps {
  palette: string[];
  onUpdate: (palette: string[]) => void;
}

// Preset color swatches matching our aesthetic
const PRESET_SWATCHES = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
];

const ColorPickerPopup: React.FC<{
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}> = ({ currentColor, onSelect, onClose, position }) => {
  const [hexInput, setHexInput] = useState(currentColor);
  const [isValidHex, setIsValidHex] = useState(true);

  const validateHex = (hex: string) => {
    const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
    setIsValidHex(isValid);
    return isValid;
  };

  const handleHexChange = (value: string) => {
    let formatted = value;
    if (!formatted.startsWith('#')) {
      formatted = '#' + formatted;
    }
    setHexInput(formatted);
    
    if (validateHex(formatted)) {
      onSelect(formatted);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup */}
      <div
        className="fixed z-50 bg-stone-900 border border-stone-700 rounded-lg shadow-2xl p-3 w-64"
        style={{
          top: `${Math.min(position.top, window.innerHeight - 350)}px`,
          left: `${Math.min(position.left, window.innerWidth - 270)}px`,
        }}
      >
        {/* Hex Input */}
        <div className="mb-3">
          <label className="text-xs text-stone-400 block mb-1.5">Hex Color</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              className={cn(
                'input-base flex-1 font-mono text-xs',
                !isValidHex && 'border-red-500'
              )}
              placeholder="#3b82f6"
              maxLength={7}
              autoFocus
            />
            {isValidHex && (
              <div
                className="w-10 h-10 rounded-lg border-2 border-stone-700 flex-shrink-0"
                style={{ backgroundColor: hexInput }}
              />
            )}
          </div>
          {!isValidHex && (
            <p className="text-xs text-red-400 mt-1">Invalid hex format</p>
          )}
        </div>

        {/* Preset Swatches */}
        <div>
          <label className="text-xs text-stone-400 block mb-1.5">Presets</label>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_SWATCHES.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setHexInput(color);
                  setIsValidHex(true);
                  onSelect(color);
                }}
                className={cn(
                  'w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 relative',
                  currentColor.toLowerCase() === color.toLowerCase()
                    ? 'border-bhagwa shadow-lg shadow-bhagwa/20'
                    : 'border-stone-700 hover:border-stone-600'
                )}
                style={{ backgroundColor: color }}
                title={color}
              >
                {currentColor.toLowerCase() === color.toLowerCase() && (
                  <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-lg" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export const TagPaletteSettings: React.FC<TagPaletteSettingsProps> = ({ palette, onUpdate }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const currentPalette = palette.length > 0 ? palette : DEFAULT_TAG_COLORS;

  const handleColorClick = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPickerPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setEditingIndex(index);
  };

  const handleColorSelect = (index: number, newColor: string) => {
    const updated = [...currentPalette];
    updated[index] = newColor;
    onUpdate(updated);
  };

  const handleAddColor = () => {
    // Add a random preset color that's not already in palette
    const available = PRESET_SWATCHES.filter(c => !currentPalette.includes(c));
    const newColor = available.length > 0 ? available[0] : PRESET_SWATCHES[0];
    onUpdate([...currentPalette, newColor]);
  };

  const handleRemoveColor = (index: number) => {
    if (currentPalette.length > 1) {
      onUpdate(currentPalette.filter((_, i) => i !== index));
    }
  };

  const handleResetToDefault = () => {
    onUpdate(DEFAULT_TAG_COLORS);
  };

  return (
    <div className="space-y-4">
      {/* Color Grid */}
      <div className="grid grid-cols-5 gap-2">
        {currentPalette.map((color, index) => (
          <div key={index} className="relative group">
            <button
              onClick={(e) => handleColorClick(index, e)}
              className="w-full aspect-square rounded-lg border-2 border-stone-700 hover:border-bhagwa transition-all hover:scale-105 relative"
              style={{ backgroundColor: color }}
              title={`Edit color ${index + 1}: ${color}`}
            >
              {/* Color label on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg">
                <span className="text-white text-xs font-mono font-semibold drop-shadow-lg">
                  {color}
                </span>
              </div>
            </button>
            
            {/* Delete button */}
            {currentPalette.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveColor(index);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-lg"
                title="Remove color"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleAddColor} className="btn-primary flex-1">
          <Plus className="w-4 h-4" />
          Add Color
        </button>
        <button onClick={handleResetToDefault} className="btn-ghost">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Info */}
      <p className="text-xs text-stone-500 leading-relaxed">
        Colors cycle in sequence when creating tags. Click any swatch to customize. 
        Need at least 1 color in palette.
      </p>

      {/* Color Picker Popup */}
      {editingIndex !== null && (
        <ColorPickerPopup
          currentColor={currentPalette[editingIndex]}
          onSelect={(color) => handleColorSelect(editingIndex, color)}
          onClose={() => setEditingIndex(null)}
          position={pickerPosition}
        />
      )}
    </div>
  );
};
