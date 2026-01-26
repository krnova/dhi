import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SmritiPage } from './pages/SmritiPage';
import { SankalpaPage } from './pages/SankalpaPage';
import { KaalPage } from './pages/KaalPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const { loadSettings, settings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply font size to root element
  useEffect(() => {
    const fontSizes = {
      sm: '14px',
      base: '16px',
      lg: '18px',
    };
    document.documentElement.style.fontSize = fontSizes[settings.fontSize];
  }, [settings.fontSize]);

  const defaultRoute = `/${settings.defaultView === 'editor' ? 'smriti' : settings.defaultView === 'vision' ? 'sankalpa' : 'kaal'}`;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="smriti" element={<SmritiPage />} />
          <Route path="sankalpa" element={<SankalpaPage />} />
          <Route path="kaal" element={<KaalPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
