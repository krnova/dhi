import React, { useEffect, useState } from 'react';
import { Palette, Type, Zap, Info, Database, Edit3, MapPin } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { cn } from '../utils/cn';

export const SettingsPage: React.FC = () => {
  const { settings, loadSettings, updateSettings, requestLocation } = useSettingsStore();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRequestLocation = async () => {
    setIsRequestingLocation(true);
    await requestLocation();
    setIsRequestingLocation(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-display mb-1">Settings</h1>
          <p className="text-caption">Customize your DHI experience</p>
        </div>

        {/* Appearance Section */}
        <section className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
            <Palette className="w-4 h-4 text-bhagwa" />
            <h2 className="text-heading text-base">Appearance</h2>
          </div>

          <div className="space-y-4">
            {/* Theme */}
            <div>
              <label className="text-sm font-medium text-sand block mb-2">Color Theme</label>
              <button
                onClick={() => updateSettings({ theme: 'agni-ash' })}
                className={cn(
                  'w-full p-3 rounded-lg border-2 transition-all text-left',
                  settings.theme === 'agni-ash'
                    ? 'border-bhagwa bg-bhagwa/5'
                    : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-sand">Agni & Ash</div>
                    <div className="text-xs text-stone-400 mt-0.5">Warm dark mode (default)</div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-ash border border-stone-700" />
                    <div className="w-5 h-5 rounded-full bg-bhagwa" />
                    <div className="w-5 h-5 rounded-full bg-sand border border-stone-700" />
                  </div>
                </div>
              </button>
            </div>

            {/* Font Size */}
            <div>
              <label className="text-sm font-medium text-sand block mb-2">Font Size</label>
              <div className="grid grid-cols-3 gap-2">
                {(['sm', 'base', 'lg'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSettings({ fontSize: size })}
                    className={cn(
                      'p-2.5 rounded-lg border-2 transition-all text-sm font-medium',
                      settings.fontSize === size
                        ? 'border-bhagwa bg-bhagwa/5 text-sand'
                        : 'border-stone-700 bg-stone-800/50 text-stone-400 hover:border-stone-600 hover:text-sand'
                    )}
                  >
                    {size === 'sm' ? 'Small' : size === 'base' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
            <MapPin className="w-4 h-4 text-bhagwa" />
            <h2 className="text-heading text-base">Location</h2>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-stone-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-sand">Current Location</div>
                {settings.location && (
                  <span className="text-xs text-stone-500">
                    {settings.location.manual ? 'Manual' : 'Auto-detected'}
                  </span>
                )}
              </div>
              {settings.location ? (
                <div className="text-xs text-stone-400">
                  Lat: {settings.location.latitude.toFixed(4)}, Lon: {settings.location.longitude.toFixed(4)}
                </div>
              ) : (
                <div className="text-xs text-stone-400">
                  Using default location (Delhi, India)
                </div>
              )}
            </div>

            <button
              onClick={handleRequestLocation}
              disabled={isRequestingLocation}
              className="btn-primary w-full"
            >
              <MapPin className="w-4 h-4" />
              {isRequestingLocation ? 'Detecting Location...' : 'Detect My Location'}
            </button>

            <p className="text-xs text-stone-500">
              Location is used for accurate sunrise/sunset times in Jyotish calculations.
              {!settings.location && ' Currently using Delhi, India as default.'}
            </p>
          </div>
        </section>

        {/* Editor Section */}
        <section className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
            <Edit3 className="w-4 h-4 text-bhagwa" />
            <h2 className="text-heading text-base">Editor Mode</h2>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => updateSettings({ editorMode: 'plain' })}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all text-left',
                settings.editorMode === 'plain'
                  ? 'border-bhagwa bg-bhagwa/5'
                  : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
              )}
            >
              <div className="text-sm font-medium text-sand">Plain Text Editor</div>
              <div className="text-xs text-stone-400 mt-0.5">
                Raw Markdown editing with manual syntax (for purists)
              </div>
            </button>

            <button
              onClick={() => updateSettings({ editorMode: 'rich' })}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all text-left',
                settings.editorMode === 'rich'
                  ? 'border-bhagwa bg-bhagwa/5'
                  : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
              )}
            >
              <div className="text-sm font-medium text-sand">Rich Text Editor</div>
              <div className="text-xs text-stone-400 mt-0.5">
                Visual formatting with toolbar buttons (recommended)
              </div>
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-stone-800">
            <Zap className="w-4 h-4 text-bhagwa" />
            <h2 className="text-heading text-base">Features</h2>
          </div>

          <div className="space-y-3">
            {/* Jyotish Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-stone-800/30">
              <div className="flex-1">
                <div className="text-sm font-medium text-sand">Jyotish Indicator</div>
                <div className="text-xs text-stone-400 mt-0.5">Show planetary hour guidance in bottom-right</div>
              </div>
              <button
                onClick={() => updateSettings({ enableJyotish: !settings.enableJyotish })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-3',
                  settings.enableJyotish ? 'bg-bhagwa' : 'bg-stone-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.enableJyotish ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
            <Type className="w-4 h-4 text-bhagwa" />
            <h2 className="text-heading text-base">Preferences</h2>
          </div>

          <div>
            <label className="text-sm font-medium text-sand block mb-2">Default View on Launch</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'editor' as const, label: 'Smriti', desc: 'Notes' },
                { value: 'vision' as const, label: 'Sankalpa', desc: 'Vision' },
                { value: 'time' as const, label: 'Kaal', desc: 'Time' }
              ].map((view) => (
                <button
                  key={view.value}
                  onClick={() => updateSettings({ defaultView: view.value })}
                  className={cn(
                    'p-2.5 rounded-lg border-2 transition-all text-left',
                    settings.defaultView === view.value
                      ? 'border-bhagwa bg-bhagwa/5'
                      : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                  )}
                >
                  <div className="text-sm font-medium text-sand">{view.label}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{view.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
            <Info className="w-4 h-4 text-bhagwa" />
            <h2 className="text-heading text-base">About</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 rounded-lg bg-stone-800/30">
              <span className="text-stone-400">Version</span>
              <span className="text-sand font-mono">0.1.0-alpha</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-stone-800/30">
              <span className="text-stone-400">Storage</span>
              <span className="text-sand">IndexedDB + LocalStorage</span>
            </div>

            <div className="p-3 rounded-lg bg-stone-800/30">
              <div className="flex items-start gap-2">
                <Database className="w-4 h-4 text-bhagwa mt-0.5 flex-shrink-0" />
                <div className="text-xs text-stone-400 leading-relaxed">
                  All data is stored locally on your device. No cloud sync. Complete privacy and offline functionality.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Spacer for bottom navigation on mobile */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  );
};
