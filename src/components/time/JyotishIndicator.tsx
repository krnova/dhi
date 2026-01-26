import React, { useState, useEffect } from 'react';
import { Sun, Moon, X, MapPin } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useSettingsStore } from '../../stores/settingsStore';
import { calculatePlanetaryHours, getDefaultLocation } from '../../utils/jyotish';

export const JyotishIndicator: React.FC = () => {
  const { settings, requestLocation } = useSettingsStore();
  const [jyotishData, setJyotishData] = useState<ReturnType<typeof calculatePlanetaryHours> | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!settings.enableJyotish) return;

    // Request location on first load if not set
    if (!settings.location) {
      requestLocation();
    }

    const updateJyotish = () => {
      const location = settings.location || getDefaultLocation();
      const now = new Date();
      const data = calculatePlanetaryHours(now, location.latitude, location.longitude);
      setJyotishData(data);
    };

    updateJyotish();
    // Update every minute
    const interval = setInterval(updateJyotish, 60000);

    return () => clearInterval(interval);
  }, [settings.enableJyotish, settings.location, requestLocation]);

  if (!settings.enableJyotish || !jyotishData) return null;

  const { currentHour, sunrise, sunset, dayRuler } = jyotishData;

  const qualityColor = {
    auspicious: 'bg-green-500',
    neutral: 'bg-yellow-500',
    inauspicious: 'bg-red-500',
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExpanded ? (
        <div className="card p-3 shadow-xl border-stone-700 min-w-[200px] animate-in">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {currentHour.isDaytime ? (
                <Sun className="w-3.5 h-3.5 text-bhagwa" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-blue-400" />
              )}
              <span className="text-xs font-medium text-stone-400">
                {currentHour.isDaytime ? 'Day' : 'Night'} Hour {currentHour.hourNumber}
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-0.5 hover:bg-stone-800 rounded transition-all"
            >
              <X className="w-3.5 h-3.5 text-stone-500" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', qualityColor[currentHour.quality])} />
              <span className="text-sm font-semibold text-sand">{currentHour.planet}</span>
            </div>
            <div className="text-xs text-stone-400">{currentHour.activity}</div>
            
            <div className="pt-2 mt-2 border-t border-stone-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Day Ruler:</span>
                <span className="text-stone-300">{dayRuler}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Sunrise:</span>
                <span className="text-stone-300">{formatTime(sunrise)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Sunset:</span>
                <span className="text-stone-300">{formatTime(sunset)}</span>
              </div>
              {settings.location?.manual && (
                <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>Manual location</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'w-10 h-10 rounded-full shadow-lg transition-all',
            'bg-stone-900 border border-stone-700 hover:border-stone-600',
            'flex items-center justify-center'
          )}
          title={`${currentHour.planet} - ${currentHour.activity}`}
        >
          <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse', qualityColor[currentHour.quality])} />
        </button>
      )}
    </div>
  );
};
