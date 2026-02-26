import { create } from 'zustand';
import type { AppSettings } from '../types/storage';
import { LocalStorageAdapter } from '../services/LocalStorageAdapter';
import { getDefaultLocation } from '../utils/jyotish';
import { Geolocation } from '@capacitor/geolocation';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  requestLocation: () => Promise<void>;
}

// FIX #4: hasCompletedOnboarding must be explicitly initialized to false so
// the onboarding guard always reads a known boolean rather than undefined.
// Without this, a first-launch user (stored settings = null) would have
// hasCompletedOnboarding as undefined in state, causing the guard to behave
// inconsistently. The import execution already protects this field from being
// overwritten — this ensures the default state is equally well-defined.
const defaultSettings: AppSettings = {
  theme: 'agni-ash',
  fontSize: 'base',
  enableJyotish: true,
  defaultView: 'editor',
  editorMode: 'rich',
  hasCompletedOnboarding: false,
  location: undefined,
  tagColorPalette: undefined,
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

  // This is the FIXED hybrid logic that works on both Android and Web
  requestLocation: async () => {
    try {
      // 1. Ask the Native OS (Android) or Browser for location
      const position = await Geolocation.getCurrentPosition();

      // 2. Success! Format the data
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        manual: false,
      };

      // 3. Save to store
      get().updateSettings({ location });

    } catch (error) {
      console.error('Location failed or denied:', error);

      // 4. Fallback to default (Delhi) only if permission is denied
      const defaultLoc = getDefaultLocation();
      get().updateSettings({
        location: { ...defaultLoc, manual: false }
      });
    }
  },
}));
