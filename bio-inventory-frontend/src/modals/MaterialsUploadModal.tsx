import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Calendar, User, AlertCircle, CheckCircle } from 'lucide-react';
import { GroupMeeting } from "../services/groupMeetingApi.ts";

interface MaterialsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: GroupMeeting | null;
  onSubmit: (uploadData: MaterialsUploadData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface MaterialsUploadData {
  meetingId: number;
  files: File[];
  description: string;
  isLateSubmission: boolean;
}

const MaterialsUploadModal: React.FC<MaterialsUploadModalProps> = ({
  isOpen,
  onClose,
  meeting,
  onSubmit,
  isSubmitting = false
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setDescription('');
      setErrors({});
    }
  }, [isOpen]);

  const isLateSubmission = meeting?.materials_deadline 
    ? new Date() > new Date(meeting.materials_deadline)
    : false;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      handleFiles(newFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      handleFiles(newFiles);
    }
  };

  const handleFiles = (newFiles: File[]) => {
    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];

    const validFiles = newFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        console.warn(`File ${file.name} has unsupported type: ${file.type}`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        console.warn(`File ${file.name} is too large (${file.size} bytes)`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
    
    if (validFiles.length !== newFiles.length) {
      setErrors({ files: 'Some files were not added due to type or size restrictions' });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (files.length === 0) {
      newErrors.files = 'Please upload at least one file';
    }

    if (!description.trim()) {
      newErrors.description = 'Please provide a description of the uploaded materials';
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
        files,
        description: description.trim(),
        isLateSubmission
      });
      onClose();
    } catch (error) {
      console.error('Failed to upload materials:', error);
      setErrors({ submit: 'Failed to upload materials. Please try again.' });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Upload Materials</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Meeting Info */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-2">{meeting.title}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(meeting.date).toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              })}</span>
            </div>
            {meeting.presenter && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Presenter: {meeting.presenter.first_name} {meeting.presenter.last_name}</span>
              </div>
            )}
            {meeting.materials_deadline && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Deadline: {new Date(meeting.materials_deadline).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          {isLateSubmission && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Late Submission</span>
              </div>
              <p className="text-orange-700 text-sm mt-1">
                The materials deadline has passed. Please contact the meeting organizer if needed.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Files *
            </label>
            
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : errors.files 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isSubmitting}
              />
              
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </div>
                <div className="text-xs text-gray-500">
                  PDF, DOC, DOCX, PPT, PPTX, TXT (max 50MB each)
                </div>
              </div>
            </div>

            {errors.files && <p className="text-red-500 text-xs mt-1">{errors.files}</p>}
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Selected Files</h4>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 text-red-500 hover:text-red-700 transition-colors"
                      disabled={isSubmitting}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materials Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Provide a brief description of the materials you're uploading (e.g., research slides, journal articles, supplementary data)..."
              disabled={isSubmitting}
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Guidelines */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-blue-800 mb-1">Upload Guidelines</div>
                <ul className="text-blue-700 space-y-1">
                  <li>• Upload all presentation materials and supporting documents</li>
                  <li>• Include references or citations if applicable</li>
                  <li>• Materials will be shared with all meeting attendees</li>
                  <li>• Contact the meeting organizer for any special requirements</li>
                </ul>
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
              disabled={isSubmitting || files.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Materials
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialsUploadModal;