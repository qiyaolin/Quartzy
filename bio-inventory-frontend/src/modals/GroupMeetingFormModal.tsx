import React, { useState, useEffect, useContext } from 'react';
import { X, Calendar, Clock, MapPin, FileText, User, Link, Upload, Users } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { ScheduleFormData, scheduleHelpers } from '../services/scheduleApi.ts';

interface GroupMeetingFormData extends ScheduleFormData {
  topic: string;
  presenter_id?: number;
  materials_url?: string;
  materials_file?: File;
  meeting_type: 'research_update' | 'journal_club' | 'general';
  rotation_list_id?: number;
}

interface Presenter {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface RotationList {
  id: number;
  name: string;
  next_presenter: Presenter | null;
}

interface GroupMeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (meetingData: GroupMeetingFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const GroupMeetingFormModal: React.FC<GroupMeetingFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const authContext = useContext(AuthContext);
  const { token } = authContext || {};

  const [formData, setFormData] = useState<GroupMeetingFormData>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:00',
    location: 'Conference Room A',
    status: 'scheduled',
    topic: '',
    meeting_type: 'research_update'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  const [rotationLists, setRotationLists] = useState<RotationList[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Mock data for development
  useEffect(() => {
    // In real implementation, these would be API calls
    setPresenters([
      { id: 1, username: 'alice', first_name: 'Alice', last_name: 'Johnson' },
      { id: 2, username: 'bob', first_name: 'Bob', last_name: 'Smith' },
      { id: 3, username: 'carol', first_name: 'Carol', last_name: 'Davis' },
      { id: 4, username: 'david', first_name: 'David', last_name: 'Wilson' }
    ]);

    setRotationLists([
      { 
        id: 1, 
        name: 'Research Updates Rotation',
        next_presenter: { id: 1, username: 'alice', first_name: 'Alice', last_name: 'Johnson' }
      },
      { 
        id: 2, 
        name: 'Journal Club Rotation',
        next_presenter: { id: 2, username: 'bob', first_name: 'Bob', last_name: 'Smith' }
      }
    ]);
  }, [token]);

  // Auto-populate title based on meeting type and topic
  useEffect(() => {
    if (formData.topic && formData.meeting_type) {
      const typeLabels = {
        research_update: 'Research Update',
        journal_club: 'Journal Club',
        general: 'Group Meeting'
      };
      
      const title = `${typeLabels[formData.meeting_type]}: ${formData.topic}`;
      setFormData(prev => ({ ...prev, title }));
    }
  }, [formData.topic, formData.meeting_type]);

  // Auto-select presenter from rotation
  useEffect(() => {
    if (formData.rotation_list_id) {
      const rotationList = rotationLists.find(r => r.id === formData.rotation_list_id);
      if (rotationList?.next_presenter) {
        setFormData(prev => ({
          ...prev,
          presenter_id: rotationList.next_presenter!.id
        }));
      }
    }
  }, [formData.rotation_list_id, rotationLists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Custom validation for group meetings
    const validation = validateGroupMeetingData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      const meetingData = { ...formData };
      if (selectedFile) {
        meetingData.materials_file = selectedFile;
      }

      await onSubmit(meetingData);
      
      // Reset form and close modal on success
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create group meeting:', error);
      setErrors({ submit: 'Failed to create group meeting. Please try again.' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      start_time: '10:00',
      end_time: '11:00',
      location: 'Conference Room A',
      status: 'scheduled',
      topic: '',
      meeting_type: 'research_update'
    });
    setErrors({});
    setSelectedFile(null);
  };

  const handleInputChange = (field: keyof GroupMeetingFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (errors.materials_file) {
        setErrors(prev => ({ ...prev, materials_file: '' }));
      }
    }
  };

  const validateGroupMeetingData = (data: GroupMeetingFormData) => {
    const errors: Record<string, string> = {};

    if (!data.topic.trim()) {
      errors.topic = 'Meeting topic is required';
    }

    if (!data.title.trim()) {
      errors.title = 'Meeting title is required';
    }

    if (!data.date) {
      errors.date = 'Meeting date is required';
    }

    if (!data.start_time) {
      errors.start_time = 'Start time is required';
    }

    if (!data.end_time) {
      errors.end_time = 'End time is required';
    }

    if (data.start_time && data.end_time && data.start_time >= data.end_time) {
      errors.time = 'End time must be after start time';
    }

    // Journal club requires materials
    if (data.meeting_type === 'journal_club' && !data.materials_url && !selectedFile) {
      errors.materials = 'Journal club meetings require materials (URL or file)';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  if (!isOpen) return null;

  const selectedPresenter = presenters.find(p => p.id === formData.presenter_id);
  const selectedRotation = rotationLists.find(r => r.id === formData.rotation_list_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">New Group Meeting</h2>
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
          {/* Meeting Type & Topic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Type *
              </label>
              <select
                value={formData.meeting_type}
                onChange={(e) => handleInputChange('meeting_type', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="research_update">Research Update</option>
                <option value="journal_club">Journal Club</option>
                <option value="general">General Meeting</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => handleInputChange('topic', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.topic ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter meeting topic"
                  disabled={isSubmitting}
                />
              </div>
              {errors.topic && <p className="text-red-500 text-xs mt-1">{errors.topic}</p>}
            </div>
          </div>

          {/* Auto-generated Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title *
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Meeting title (auto-generated)"
                disabled={isSubmitting}
              />
            </div>
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Presenter Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Presenter Assignment</h3>
            
            {/* Rotation List Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Use Rotation List
              </label>
              <select
                value={formData.rotation_list_id || ''}
                onChange={(e) => handleInputChange('rotation_list_id', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="">Select rotation list (optional)</option>
                {rotationLists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name} (Next: {list.next_presenter?.first_name} {list.next_presenter?.last_name})
                  </option>
                ))}
              </select>
              {selectedRotation && (
                <p className="text-sm text-blue-600 mt-1">
                  Next presenter: {selectedRotation.next_presenter?.first_name} {selectedRotation.next_presenter?.last_name}
                </p>
              )}
            </div>

            {/* Manual Presenter Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Presenter
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.presenter_id || ''}
                  onChange={(e) => handleInputChange('presenter_id', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="">Select presenter</option>
                  {presenters.map(presenter => (
                    <option key={presenter.id} value={presenter.id}>
                      {presenter.first_name} {presenter.last_name} ({presenter.username})
                    </option>
                  ))}
                </select>
              </div>
              {selectedPresenter && (
                <p className="text-sm text-green-600 mt-1">
                  Selected: {selectedPresenter.first_name} {selectedPresenter.last_name}
                </p>
              )}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.date ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange('end_time', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
          {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter meeting location"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Materials Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Meeting Materials
              {formData.meeting_type === 'journal_club' && <span className="text-red-500 ml-1">*</span>}
            </h3>

            {/* Materials URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Materials URL
              </label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={formData.materials_url || ''}
                  onChange={(e) => handleInputChange('materials_url', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/materials"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Materials File
              </label>
              <div className="relative">
                <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  disabled={isSubmitting}
                />
              </div>
              {selectedFile && (
                <p className="text-sm text-green-600 mt-1">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            {errors.materials && <p className="text-red-500 text-xs mt-1">{errors.materials}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Enter meeting description and agenda"
              disabled={isSubmitting}
            />
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
                  Creating...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Create Meeting
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupMeetingFormModal;