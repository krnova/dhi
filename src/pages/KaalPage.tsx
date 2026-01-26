import React from 'react';
import { Calendar, Clock, CheckSquare } from 'lucide-react';

export const KaalPage: React.FC = () => {
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-display mb-1">काल</h1>
          <p className="text-caption">Time Management & Calendar</p>
        </div>

        {/* Today's Overview */}
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-bhagwa/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-bhagwa" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-sand">{dayName}</h2>
              <p className="text-xs text-stone-400">{monthName}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-800/50 rounded-lg p-3">
              <Clock className="w-4 h-4 text-bhagwa mb-1.5" />
              <div className="text-lg font-bold text-sand">0</div>
              <div className="text-xs text-stone-400">Events</div>
            </div>
            <div className="bg-stone-800/50 rounded-lg p-3">
              <CheckSquare className="w-4 h-4 text-green-500 mb-1.5" />
              <div className="text-lg font-bold text-sand">0</div>
              <div className="text-xs text-stone-400">Tasks</div>
            </div>
            <div className="bg-stone-800/50 rounded-lg p-3">
              <Clock className="w-4 h-4 text-blue-500 mb-1.5" />
              <div className="text-lg font-bold text-sand">0</div>
              <div className="text-xs text-stone-400">Upcoming</div>
            </div>
          </div>
        </div>

        {/* Calendar Placeholder */}
        <div className="card min-h-[400px] flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-xl bg-stone-800 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-bhagwa" />
            </div>
            <h3 className="text-lg font-semibold text-sand mb-2">Calendar Integration Coming Soon</h3>
            <p className="text-sm text-stone-400 max-w-md">
              Track events, tasks, and planetary hours. Integrate with your calendar for seamless time management.
            </p>
            <div className="mt-6 text-xs text-stone-600">
              Feature in development
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
