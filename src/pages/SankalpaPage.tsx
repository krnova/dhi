import React from 'react';
import { Target, Plus, TrendingUp } from 'lucide-react';

export const SankalpaPage: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-display mb-1">संकल्प</h1>
          <p className="text-caption">Vision & Strategic Planning</p>
        </div>

        {/* Empty State */}
        <div className="card min-h-[400px] flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-xl bg-stone-800 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-bhagwa" />
          </div>
          <h3 className="text-lg font-semibold text-sand mb-2">Vision Board Coming Soon</h3>
          <p className="text-sm text-stone-400 max-w-md mb-6">
            Track your goals, milestones, and strategic roadmaps. This module will help you plan and visualize your long-term objectives.
          </p>
          
          <div className="flex gap-3">
            <button className="btn-ghost text-xs" disabled>
              <TrendingUp className="w-3.5 h-3.5" />
              Goals
            </button>
            <button className="btn-ghost text-xs" disabled>
              <Plus className="w-3.5 h-3.5" />
              Milestones
            </button>
          </div>

          <div className="mt-8 text-xs text-stone-600">
            Feature in development
          </div>
        </div>
      </div>
    </div>
  );
};
