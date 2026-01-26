import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Target, Calendar, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/smriti', icon: BookOpen, label: 'स्मृति', subtitle: 'Memory' },
  { to: '/sankalpa', icon: Target, label: 'संकल्प', subtitle: 'Vision' },
  { to: '/kaal', icon: Calendar, label: 'काल', subtitle: 'Time' },
  { to: '/settings', icon: Settings, label: 'Settings', subtitle: '' },
];

export const Navigation: React.FC = () => {
  return (
    <nav className="w-16 md:w-56 bg-stone-900 border-r border-stone-800 flex flex-col safe-area-inset">
      {/* Logo/Brand */}
      <div className="p-3 md:p-4 border-b border-stone-800">
        <div className="flex items-center justify-center md:justify-start gap-2.5">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-bhagwa to-orange-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base md:text-lg">धी</span>
          </div>
          <div className="hidden md:block">
            <h1 className="text-base font-bold text-sand leading-tight">DHI</h1>
            <p className="text-xs text-stone-500 leading-tight">Digital Sarthi</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center md:justify-start gap-3 px-2 md:px-3 py-2.5 rounded-lg transition-all group',
                'hover:bg-stone-800 min-h-[40px]',
                isActive
                  ? 'bg-bhagwa/10 text-bhagwa border border-bhagwa/20'
                  : 'text-stone-400 hover:text-sand'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-bhagwa')} />
                <div className="hidden md:block min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.subtitle && (
                    <div className="text-xs opacity-60 truncate">{item.subtitle}</div>
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Version Info */}
      <div className="p-3 border-t border-stone-800 hidden md:block">
        <p className="text-xs text-stone-500 text-center">
          v0.1.0-alpha
        </p>
      </div>
    </nav>
  );
};
