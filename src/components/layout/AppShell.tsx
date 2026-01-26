import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { JyotishIndicator } from '../time/JyotishIndicator';

export const AppShell: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-ash">
      {/* Sidebar Navigation */}
      <Navigation />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      
      {/* Jyotish Status Indicator */}
      <JyotishIndicator />
    </div>
  );
};
