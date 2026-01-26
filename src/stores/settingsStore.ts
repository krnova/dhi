import { create } from 'zustand';
import type { AppSettings } from '../types/storage';
import { LocalStorageAdapter } from '../services/LocalStorageAdapter';
import { getDefaultLocation } from '../utils/jyotish';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  requestLocation: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  theme: 'agni-ash',
  fontSize: 'base',
  enableJyotish: true,
  defaultView: 'editor',
  editorMode: 'rich',
  location: undefined,
};

const storage = new LocalStorageAdapter();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: true,

  loadSettings: async () => {
    try {
      const stored = await storage.get<AppSettings>('settings');
      set({
        settings: stored ? { ...defaultSettings, ...stored } : defaultSettings,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    try {
      const newSettings = { ...get().settings, ...partial };
      await storage.set('settings', newSettings);
      set({ settings: newSettings });
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },

  requestLocation: async () => {
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              manual: false,
            };
            get().updateSettings({ location });
          },
          (error) => {
            console.error('Geolocation error:', error);
            // Fallback to default location
            const defaultLoc = getDefaultLocation();
            const location = {
              ...defaultLoc,
              manual: false,
            };
            get().updateSettings({ location });
          }
        );
      } else {
        // Geolocation not supported - use default
        const defaultLoc = getDefaultLocation();
        const location = {
          ...defaultLoc,
          manual: false,
        };
        get().updateSettings({ location });
      }
    } catch (error) {
      console.error('Failed to request location:', error);
    }
  },
}));
