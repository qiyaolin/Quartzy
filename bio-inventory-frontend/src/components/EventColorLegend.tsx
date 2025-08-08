import React from 'react';
import { 
  Calendar, 
  Settings, 
  CheckCircle2, 
  Clock, 
  Users 
} from 'lucide-react';
import { scheduleHelpers } from '../services/scheduleApi';

interface EventColorLegendProps {
  showTitle?: boolean;
  compact?: boolean;
}

const EventColorLegend: React.FC<EventColorLegendProps> = ({ 
  showTitle = true,
  compact = false 
}) => {
  const eventTypes = [
    {
      type: 'meeting',
      icon: Users,
      label: 'Meetings',
      description: 'Group meetings, presentations, discussions'
    },
    {
      type: 'booking',
      icon: Calendar,
      label: 'Equipment Bookings',
      description: 'Reserved equipment and lab instruments'
    },
    {
      type: 'task',
      icon: CheckCircle2,
      label: 'Tasks',
      description: 'Maintenance, cleaning, assignments'
    },
    {
      type: 'equipment',
      icon: Settings,
      label: 'Equipment',
      description: 'Equipment-related activities'
    },
    {
      type: 'personal',
      icon: Clock,
      label: 'Personal',
      description: 'Other scheduled activities'
    }
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {eventTypes.map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${scheduleHelpers.getEventColor(type, 'scheduled')}`} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {showTitle && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-gradient-to-r from-purple-400 to-blue-400 rounded" />
          <h3 className="font-medium text-gray-900">Event Types</h3>
        </div>
      )}
      
      <div className="space-y-2">
        {eventTypes.map(({ type, icon: Icon, label, description }) => (
          <div key={type} className="flex items-start gap-3">
            <div className={`w-4 h-4 rounded mt-0.5 ${scheduleHelpers.getEventColor(type, 'scheduled')}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm text-gray-900">{label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Colors also indicate status: bright for active, muted for completed, gray for cancelled
        </p>
      </div>
    </div>
  );
};

export default EventColorLegend;