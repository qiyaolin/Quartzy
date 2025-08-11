import React from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Edit3,
  Trash2,
  Settings,
} from 'lucide-react';
import { Schedule } from '../services/scheduleApi';

interface ScheduleDetailPanelProps {
  schedule: Schedule | null;
  onClose?: () => void;
  onEdit?: (schedule: Schedule) => void;
  onDelete?: (scheduleId: number) => void;
  onMarkComplete?: (scheduleId: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const ScheduleDetailPanel: React.FC<ScheduleDetailPanelProps> = ({
  schedule,
  onClose,
  onEdit,
  onDelete,
  onMarkComplete,
  canEdit = true,
  canDelete = true,
}) => {
  if (!schedule) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        Select an event to view details
      </div>
    );
  }

  const getStatusConfig = (status?: string) => {
    const configs = {
      scheduled: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CalendarIcon, label: 'Scheduled' },
      in_progress: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle, label: 'In Progress' },
      completed: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle, label: 'Cancelled' },
    } as const;
    const key = (status || 'scheduled') as keyof typeof configs;
    return configs[key];
  };

  const statusConfig = getStatusConfig(schedule.status);
  const StatusIcon = statusConfig.icon;

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    try {
      return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs font-medium ${statusConfig.color}`}>
          <StatusIcon className="w-4 h-4" />
          {statusConfig.label}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-auto">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 break-words">{schedule.title}</h2>
          {schedule.description && (
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{schedule.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{formatDate(schedule.date)}</span>
          </div>
          {schedule.start_time && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>
                {formatTime(schedule.start_time)}
                {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
              </span>
            </div>
          )}
          {schedule.location && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="break-words">{schedule.location}</span>
            </div>
          )}
          {schedule.attendees_count && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Users className="w-4 h-4 text-gray-500" />
              <span>{schedule.attendees_count} attendees</span>
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
            <Settings className="w-4 h-4" />
            System Information
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
            {schedule.created_at && (
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="text-gray-900">{new Date(schedule.created_at).toLocaleString()}</span>
              </div>
            )}
            {schedule.updated_at && (
              <div>
                <span className="text-gray-500">Updated:</span>{' '}
                <span className="text-gray-900">{new Date(schedule.updated_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 mt-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {schedule.status === 'scheduled' && onMarkComplete && (
              <button
                onClick={() => onMarkComplete(schedule.id)}
                className="btn btn-xs bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Mark Complete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && canEdit && (
              <button onClick={() => onEdit(schedule)} className="btn btn-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Edit3 className="w-3 h-3 mr-1" /> Edit
              </button>
            )}
            {onDelete && canDelete && (
              <button onClick={() => onDelete(schedule.id)} className="btn btn-xs bg-red-600 hover:bg-red-700 text-white">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetailPanel;


