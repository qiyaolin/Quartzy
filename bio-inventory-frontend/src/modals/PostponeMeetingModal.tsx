import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, RotateCcw, AlertTriangle, Users } from 'lucide-react';
import { GroupMeeting } from "../services/groupMeetingApi.ts";

interface PostponeMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: GroupMeeting | null;
  onSubmit: (postponeData: PostponeData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface PostponeData {
  meetingId: number;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  reason: string;
  notifyAttendees: boolean;
}

const PostponeMeetingModal: React.FC<PostponeMeetingModalProps> = ({
  isOpen,
  onClose,
  meeting,
  onSubmit,
  isSubmitting = false
}) => {
  const [formData, setFormData] = useState({
    newDate: '',
    newStartTime: '',
    newEndTime: '',
    reason: '',
    notifyAttendees: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && meeting) {
      // Default to next week same time
      const nextWeek = new Date(meeting.date);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      setFormData({
        newDate: nextWeek.toISOString().split('T')[0],
        newStartTime: meeting.start_time || '14:00',
        newEndTime: meeting.end_time || '15:30',
        reason: '',
        notifyAttendees: true
      });
      setErrors({});
    }
  }, [isOpen, meeting]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.newDate) {
      newErrors.newDate = 'New date is required';
    } else {
      const selectedDate = new Date(formData.newDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.newDate = 'Cannot postpone to a past date';
      }
    }

    if (!formData.newStartTime) {
      newErrors.newStartTime = 'Start time is required';
    }

    if (!formData.newEndTime) {
      newErrors.newEndTime = 'End time is required';
    }

    if (formData.newStartTime && formData.newEndTime && formData.newStartTime >= formData.newEndTime) {
      newErrors.newEndTime = 'End time must be after start time';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason for postponement';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !validateForm()) return;

    try {
      await onSubmit({
        meetingId: meeting.id,
        newDate: formData.newDate,
        newStartTime: formData.newStartTime,
        newEndTime: formData.newEndTime,
        reason: formData.reason.trim(),
        notifyAttendees: formData.notifyAttendees
      });
      onClose();
    } catch (error) {
      console.error('Failed to postpone meeting:', error);
      setErrors({ submit: 'Failed to postpone meeting. Please try again.' });
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts editing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <RotateCcw className="w-5 h-5 text-yellow-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Postpone Meeting</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Current Meeting Info */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-2">{meeting.title}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Current: {formatDate(meeting.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Time: {meeting.start_time} - {meeting.end_time}</span>
            </div>
            {meeting.presenter && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Presenter: {meeting.presenter.first_name} {meeting.presenter.last_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* New Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={formData.newDate}
                onChange={(e) => handleInputChange('newDate', e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                  errors.newDate ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
            </div>
            {errors.newDate && <p className="text-red-500 text-xs mt-1">{errors.newDate}</p>}
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.newStartTime}
                  onChange={(e) => handleInputChange('newStartTime', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                    errors.newStartTime ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.newStartTime && <p className="text-red-500 text-xs mt-1">{errors.newStartTime}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.newEndTime}
                  onChange={(e) => handleInputChange('newEndTime', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                    errors.newEndTime ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.newEndTime && <p className="text-red-500 text-xs mt-1">{errors.newEndTime}</p>}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Postponement *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none ${
                errors.reason ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Please explain why the meeting needs to be postponed..."
              disabled={isSubmitting}
            />
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
          </div>

          {/* Notification Option */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="notifyAttendees"
              checked={formData.notifyAttendees}
              onChange={(e) => handleInputChange('notifyAttendees', e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
              disabled={isSubmitting}
            />
            <label htmlFor="notifyAttendees" className="text-sm text-gray-700">
              <span className="font-medium">Notify all attendees</span>
              <span className="block text-gray-500">Send email notification to all meeting participants about the schedule change</span>
            </label>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800 mb-1">Important Notice</div>
                <div className="text-yellow-700">
                  Postponing this meeting may affect the presenter rotation schedule. 
                  Other team members may need to adjust their preparation timeline.
                </div>
              </div>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Postponing...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Postpone Meeting
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostponeMeetingModal;