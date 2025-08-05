import React, { useState, useEffect, useContext } from 'react';
import { X, Calendar, Clock, FileText, User, Repeat, Settings, Plus, Trash2 } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { ScheduleFormData, scheduleHelpers } from '../services/scheduleApi.ts';

interface RecurringTaskFormData extends ScheduleFormData {
  cron_schedule: string;
  assignee_group: number[];
  assignment_method: 'rotation' | 'all' | 'random';
  reminder_days: number;
  auto_complete: boolean;
}

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface CronPreset {
  label: string;
  value: string;
  description: string;
}

interface RecurringTaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: RecurringTaskFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const RecurringTaskFormModal: React.FC<RecurringTaskFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const authContext = useContext(AuthContext);
  const { token } = authContext || {};

  const [formData, setFormData] = useState<RecurringTaskFormData>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
    end_time: '10:00',
    location: '',
    status: 'scheduled',
    cron_schedule: '0 0 * * 1', // Every Monday at midnight
    assignee_group: [],
    assignment_method: 'rotation',
    reminder_days: 1,
    auto_complete: false
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [showCronHelper, setShowCronHelper] = useState(false);

  // Cron schedule presets
  const cronPresets: CronPreset[] = [
    { label: 'Daily', value: '0 9 * * *', description: 'Every day at 9:00 AM' },
    { label: 'Weekly (Monday)', value: '0 9 * * 1', description: 'Every Monday at 9:00 AM' },
    { label: 'Weekly (Friday)', value: '0 17 * * 5', description: 'Every Friday at 5:00 PM' },
    { label: 'Monthly (1st)', value: '0 9 1 * *', description: '1st of every month at 9:00 AM' },
    { label: 'Monthly (Last)', value: '0 9 L * *', description: 'Last day of every month at 9:00 AM' },
    { label: 'Bi-weekly', value: '0 9 * * 1/2', description: 'Every other Monday at 9:00 AM' },
    { label: 'Quarterly', value: '0 9 1 */3 *', description: 'First day of every quarter at 9:00 AM' }
  ];

  // Mock data for development
  useEffect(() => {
    // In real implementation, this would be an API call
    setUsers([
      { id: 1, username: 'alice', first_name: 'Alice', last_name: 'Johnson' },
      { id: 2, username: 'bob', first_name: 'Bob', last_name: 'Smith' },
      { id: 3, username: 'carol', first_name: 'Carol', last_name: 'Davis' },
      { id: 4, username: 'david', first_name: 'David', last_name: 'Wilson' },
      { id: 5, username: 'eve', first_name: 'Eve', last_name: 'Brown' }
    ]);
  }, [token]);

  // Update selected users when assignee_group changes
  useEffect(() => {
    const selected = users.filter(user => formData.assignee_group.includes(user.id));
    setSelectedUsers(selected);
  }, [formData.assignee_group, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Custom validation for recurring tasks
    const validation = validateRecurringTaskData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await onSubmit(formData);
      
      // Reset form and close modal on success
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create recurring task:', error);
      setErrors({ submit: 'Failed to create recurring task. Please try again.' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '10:00',
      location: '',
      status: 'scheduled',
      cron_schedule: '0 0 * * 1',
      assignee_group: [],
      assignment_method: 'rotation',
      reminder_days: 1,
      auto_complete: false
    });
    setErrors({});
    setSelectedUsers([]);
  };

  const handleInputChange = (field: keyof RecurringTaskFormData, value: string | number | boolean | number[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleUserToggle = (userId: number) => {
    const currentAssignees = formData.assignee_group;
    const newAssignees = currentAssignees.includes(userId)
      ? currentAssignees.filter(id => id !== userId)
      : [...currentAssignees, userId];
    
    handleInputChange('assignee_group', newAssignees);
  };

  const handleCronPresetSelect = (cronValue: string) => {
    handleInputChange('cron_schedule', cronValue);
    setShowCronHelper(false);
  };

  const validateRecurringTaskData = (data: RecurringTaskFormData) => {
    const errors: Record<string, string> = {};

    if (!data.title.trim()) {
      errors.title = 'Task title is required';
    }

    if (!data.cron_schedule.trim()) {
      errors.cron_schedule = 'Schedule pattern is required';
    }

    if (data.assignee_group.length === 0) {
      errors.assignee_group = 'At least one assignee is required';
    }

    if (data.reminder_days < 0 || data.reminder_days > 30) {
      errors.reminder_days = 'Reminder days must be between 0 and 30';
    }

    if (data.start_time && data.end_time && data.start_time >= data.end_time) {
      errors.time = 'End time must be after start time';
    }

    // Basic cron validation
    if (data.cron_schedule) {
      const cronParts = data.cron_schedule.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        errors.cron_schedule = 'Invalid cron format. Use: minute hour day month weekday';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  if (!isOpen) return null;

  const selectedCronPreset = cronPresets.find(preset => preset.value === formData.cron_schedule);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Repeat className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">New Recurring Task</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Task Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Task Information</h3>
            
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Weekly Lab Cleaning, Monthly Inventory Check"
                  disabled={isSubmitting}
                />
              </div>
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="Enter detailed task description and instructions"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Schedule Configuration</h3>
            
            {/* Cron Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recurrence Pattern *
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.cron_schedule}
                    onChange={(e) => handleInputChange('cron_schedule', e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      errors.cron_schedule ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0 9 * * 1 (Every Monday at 9 AM)"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCronHelper(!showCronHelper)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                
                {selectedCronPreset && (
                  <p className="text-sm text-green-600">
                    {selectedCronPreset.description}
                  </p>
                )}
                
                {errors.cron_schedule && <p className="text-red-500 text-xs mt-1">{errors.cron_schedule}</p>}
              </div>

              {/* Cron Helper */}
              {showCronHelper && (
                <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Common Patterns</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {cronPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleCronPresetSelect(preset.value)}
                        className="text-left px-3 py-2 border border-gray-200 rounded bg-white hover:bg-gray-50 transition-colors"
                        disabled={isSubmitting}
                      >
                        <div className="font-medium text-sm text-gray-900">{preset.label}</div>
                        <div className="text-xs text-gray-500">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    <p><strong>Format:</strong> minute hour day month weekday</p>
                    <p><strong>Example:</strong> "0 9 * * 1" = Every Monday at 9:00 AM</p>
                  </div>
                </div>
              )}
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Start Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected End Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>

          {/* Assignment Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Assignment Configuration</h3>
            
            {/* Assignment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignment Method
              </label>
              <select
                value={formData.assignment_method}
                onChange={(e) => handleInputChange('assignment_method', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="rotation">Rotation (assign to different people each time)</option>
                <option value="all">All Selected (assign to everyone each time)</option>
                <option value="random">Random (assign to random person each time)</option>
              </select>
            </div>

            {/* User Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignee Group * ({selectedUsers.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-40 overflow-y-auto">
                {users.length === 0 ? (
                  <p className="text-gray-500 text-sm">No users available</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <label key={user.id} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assignee_group.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          disabled={isSubmitting}
                        />
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {user.first_name} {user.last_name} ({user.username})
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {errors.assignee_group && <p className="text-red-500 text-xs mt-1">{errors.assignee_group}</p>}
            </div>

            {/* Assignment Preview */}
            {selectedUsers.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Assignment Preview</h4>
                <p className="text-sm text-blue-700">
                  {formData.assignment_method === 'rotation' && `Tasks will rotate between: ${selectedUsers.map(u => u.first_name).join(', ')}`}
                  {formData.assignment_method === 'all' && `Each task will be assigned to all ${selectedUsers.length} selected members`}
                  {formData.assignment_method === 'random' && `Each task will be randomly assigned to one of ${selectedUsers.length} members`}
                </p>
              </div>
            )}
          </div>

          {/* Additional Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Additional Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reminder Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reminder (days before)
                </label>
                <input
                  type="number"
                  value={formData.reminder_days}
                  onChange={(e) => handleInputChange('reminder_days', Number(e.target.value))}
                  min="0"
                  max="30"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.reminder_days ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.reminder_days && <p className="text-red-500 text-xs mt-1">{errors.reminder_days}</p>}
              </div>

              {/* Auto Complete */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto_complete"
                  checked={formData.auto_complete}
                  onChange={(e) => handleInputChange('auto_complete', e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  disabled={isSubmitting}
                />
                <label htmlFor="auto_complete" className="text-sm font-medium text-gray-700">
                  Auto-complete task when due date passes
                </label>
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Repeat className="w-4 h-4" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecurringTaskFormModal;