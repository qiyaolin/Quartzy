import React, { useState, useEffect } from 'react';
import { X, Edit3, Clock, MapPin, Users, Calendar, Settings } from 'lucide-react';
import { RecurringTask } from "../services/groupMeetingApi.ts";

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: RecurringTask | null;
  onSubmit: (taskData: EditTaskData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface EditTaskData {
  taskId: number;
  title: string;
  description: string;
  location: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  estimated_duration_hours: number;
  assignee_count: number;
  auto_assign: boolean;
  reminder_days: number;
  task_type: string;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmit,
  isSubmitting = false
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    frequency: 'monthly' as EditTaskData['frequency'],
    estimated_duration_hours: 2,
    assignee_count: 1,
    auto_assign: true,
    reminder_days: 3,
    task_type: 'general'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && task) {
      setFormData({
        title: task.title,
        description: task.description,
        location: task.location,
        frequency: task.frequency as EditTaskData['frequency'],
        estimated_duration_hours: task.estimated_duration_hours,
        assignee_count: task.assignee_count,
        auto_assign: task.auto_assign,
        reminder_days: task.reminder_days || 3,
        task_type: task.task_type
      });
      setErrors({});
    }
  }, [isOpen, task]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (formData.estimated_duration_hours <= 0 || formData.estimated_duration_hours > 24) {
      newErrors.estimated_duration_hours = 'Duration must be between 1 and 24 hours';
    }

    if (formData.assignee_count <= 0 || formData.assignee_count > 10) {
      newErrors.assignee_count = 'Assignee count must be between 1 and 10';
    }

    if (formData.reminder_days < 0 || formData.reminder_days > 30) {
      newErrors.reminder_days = 'Reminder days must be between 0 and 30';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !validateForm()) return;

    try {
      await onSubmit({
        taskId: task.id,
        ...formData
      });
      onClose();
    } catch (error) {
      console.error('Failed to update task:', error);
      setErrors({ submit: 'Failed to update task. Please try again.' });
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts editing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const taskTypes = [
    { value: 'general', label: 'General Maintenance' },
    { value: 'cell_culture_room_cleaning', label: 'Cell Culture Room Cleaning' },
    { value: 'cell_culture_incubator_cleaning', label: 'Cell Culture Incubator Cleaning' },
    { value: 'equipment_calibration', label: 'Equipment Calibration' },
    { value: 'inventory_audit', label: 'Inventory Audit' },
    { value: 'waste_disposal', label: 'Waste Disposal' },
    { value: 'safety_check', label: 'Safety Check' }
  ];

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Recurring Task</h2>
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
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter task title"
                disabled={isSubmitting}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Describe the task requirements and procedures"
                disabled={isSubmitting}
              />
            </div>

            {/* Task Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Type
              </label>
              <select
                value={formData.task_type}
                onChange={(e) => handleInputChange('task_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                {taskTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Schedule Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.frequency}
                    onChange={(e) => handleInputChange('frequency', e.target.value as EditTaskData['frequency'])}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Duration (hours) *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={formData.estimated_duration_hours}
                    onChange={(e) => handleInputChange('estimated_duration_hours', parseFloat(e.target.value))}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.estimated_duration_hours ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.estimated_duration_hours && (
                  <p className="text-red-500 text-xs mt-1">{errors.estimated_duration_hours}</p>
                )}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.location ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter location where task will be performed"
                  disabled={isSubmitting}
                />
              </div>
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
            </div>
          </div>

          {/* Assignment Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Assignment Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Assignee Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Assignees *
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.assignee_count}
                    onChange={(e) => handleInputChange('assignee_count', parseInt(e.target.value))}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.assignee_count ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.assignee_count && (
                  <p className="text-red-500 text-xs mt-1">{errors.assignee_count}</p>
                )}
              </div>

              {/* Reminder Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder (days before) *
                </label>
                <div className="relative">
                  <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={formData.reminder_days}
                    onChange={(e) => handleInputChange('reminder_days', parseInt(e.target.value))}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.reminder_days ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.reminder_days && (
                  <p className="text-red-500 text-xs mt-1">{errors.reminder_days}</p>
                )}
              </div>
            </div>

            {/* Auto Assignment */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto_assign"
                checked={formData.auto_assign}
                onChange={(e) => handleInputChange('auto_assign', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isSubmitting}
              />
              <label htmlFor="auto_assign" className="text-sm text-gray-700">
                <span className="font-medium">Enable automatic assignment</span>
                <span className="block text-gray-500">
                  System will automatically assign this task to eligible team members when due
                </span>
              </label>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Next Due Date:</span><br />
                {task.next_due_date ? new Date(task.next_due_date).toLocaleDateString() : 'Not scheduled'}
              </div>
              <div>
                <span className="font-medium">Last Assigned:</span><br />
                {task.last_assigned_date 
                  ? new Date(task.last_assigned_date).toLocaleDateString()
                  : 'Never assigned'
                }
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Update Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskModal;