import React from 'react';
import {
  Calendar,
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
  Activity,
  Beaker,
  User,
  Tag,
  ExternalLink
} from 'lucide-react';
import { Schedule } from '../services/scheduleApi';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onEdit?: (schedule: Schedule) => void;
  onDelete?: (scheduleId: number) => void;
  onMarkComplete?: (scheduleId: number) => void;
}

const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onEdit,
  onDelete,
  onMarkComplete
}) => {
  if (!isOpen || !schedule) return null;

  const getStatusConfig = (status: string) => {
    const configs = {
      scheduled: {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Calendar,
        label: 'Scheduled'
      },
      in_progress: {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: Activity,
        label: 'In Progress'
      },
      completed: {
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: CheckCircle,
        label: 'Completed'
      },
      cancelled: {
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: AlertCircle,
        label: 'Cancelled'
      }
    };
    return configs[status as keyof typeof configs] || configs.scheduled;
  };

  const statusConfig = getStatusConfig(schedule.status || 'scheduled');
  const StatusIcon = statusConfig.icon;

  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    try {
      return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-6 py-8 rounded-t-2xl border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-white hover:bg-opacity-50 rounded-full transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium ${statusConfig.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusConfig.label}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-white bg-opacity-50 px-2 py-1 rounded-full">
                ID: {schedule.id}
              </span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2 pr-8">
            {schedule.title}
          </h2>

          {/* Primary Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">{formatDate(schedule.date)}</span>
            </div>
            {schedule.start_time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  {formatTime(schedule.start_time)}
                  {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {schedule.description && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {schedule.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location */}
            {schedule.location && (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-green-600 font-medium">Location</div>
                  <div className="text-green-800 font-semibold">{schedule.location}</div>
                </div>
              </div>
            )}

            {/* Attendees */}
            {schedule.attendees_count && (
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-purple-600 font-medium">Attendees</div>
                  <div className="text-purple-800 font-semibold">{schedule.attendees_count} participants</div>
                </div>
              </div>
            )}

            {/* Equipment */}
            {schedule.equipment && (
              <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Beaker className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm text-orange-600 font-medium">Equipment</div>
                  <div className="text-orange-800 font-semibold">{schedule.equipment.name}</div>
                </div>
              </div>
            )}

            {/* Created By */}
            {schedule.created_by && (
              <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm text-indigo-600 font-medium">Created By</div>
                  <div className="text-indigo-800 font-semibold">
                    {schedule.created_by.first_name} {schedule.created_by.last_name}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              System Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {schedule.created_at && (
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {new Date(schedule.created_at).toLocaleString()}
                  </span>
                </div>
              )}
              {schedule.updated_at && (
                <div>
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {new Date(schedule.updated_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {schedule.status === 'scheduled' && onMarkComplete && (
                <button
                  onClick={() => onMarkComplete(schedule.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Complete
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(schedule)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
              )}
              
              {onDelete && (
                <button
                  onClick={() => onDelete(schedule.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetailModal;