import React, { useState, useContext, useRef } from 'react';
import {
    Upload, File, Link, X, CheckCircle, AlertCircle,
    Download, Eye, Trash2, Calendar, Clock, Mail
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

// Types
interface MaterialsFile {
    id: number;
    name: string;
    size: number;
    type: string;
    url: string;
    uploaded_at: string;
    uploaded_by: string;
}

interface GroupMeeting {
    id: number;
    title: string;
    date: string;
    start_time?: string;
    meeting_type: 'research_update' | 'journal_club' | 'general';
    topic: string;
    presenter?: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    materials_url?: string;
    materials_files?: MaterialsFile[];
    is_materials_submitted?: boolean;
    materials_deadline?: string;
}

interface MaterialsUploadProps {
    meeting: GroupMeeting;
    onUpload?: (meetingId: number, url: string) => Promise<void>;
    onRemove?: (meetingId: number, fileId: number) => Promise<void>;
    onSubmit?: (meetingId: number) => Promise<void>;
    canEdit?: boolean;
}

const MaterialsUpload: React.FC<MaterialsUploadProps> = ({
    meeting,
    onUpload,
    onRemove,
    onSubmit,
    canEdit = true
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [uploading, setUploading] = useState(false);
    const [materialsUrl, setMaterialsUrl] = useState(meeting.materials_url || '');
    // File upload removed; URL only
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Check if materials are overdue
    const isOverdue = meeting.materials_deadline && 
        new Date(meeting.materials_deadline) < new Date() && 
        !meeting.is_materials_submitted;

    // Check if deadline is approaching (within 24 hours)
    const isDeadlineApproaching = meeting.materials_deadline && 
        !meeting.is_materials_submitted &&
        new Date(meeting.materials_deadline).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;

    // Handle file selection
    const handleFileSelect = (_e: React.ChangeEvent<HTMLInputElement>) => {};

    // Handle drag and drop
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    // Validate and add files
    const validateAndAddFiles = (_files: File[]) => {};

    // Remove selected file
    const removeSelectedFile = (_index: number) => {};

    // Upload materials
    const handleUpload = async () => {
        if (!onUpload) return;
        if (!materialsUrl.trim()) {
            setError('Please provide a URL');
            return;
        }
        setUploading(true);
        setError(null);
        try {
            await onUpload(meeting.id, materialsUrl.trim());
            setSuccess('URL submitted successfully');
            setMaterialsUrl('');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Submit failed');
        } finally {
            setUploading(false);
        }
    };

    // Submit materials (mark as complete)
    const handleSubmit = async () => {
        if (!onSubmit) return;

        try {
            await onSubmit(meeting.id);
            setSuccess('Materials submitted successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Submit failed');
        }
    };

    // Remove uploaded file
    const handleRemoveFile = async (fileId: number) => {
        if (!onRemove) return;

        try {
            await onRemove(meeting.id, fileId);
            setSuccess('File removed successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Remove failed');
        }
    };

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Meeting Info Header */}
            <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{meeting.title}</h3>
                    {meeting.is_materials_submitted ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Submitted
                        </span>
                    ) : isOverdue ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Overdue
                        </span>
                    ) : isDeadlineApproaching ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Due Soon
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Upload className="w-3 h-3 mr-1" />
                            Pending
                        </span>
                    )}
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(meeting.date).toLocaleDateString()}</span>
                        </div>
                        {meeting.start_time && (
                            <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{meeting.start_time}</span>
                            </div>
                        )}
                    </div>
                    <p className="font-medium">{meeting.topic}</p>
                    {meeting.presenter && (
                        <p>Presenter: {meeting.presenter.first_name} {meeting.presenter.last_name}</p>
                    )}
                    {meeting.materials_deadline && (
                        <p className={`font-medium ${isOverdue ? 'text-red-600' : isDeadlineApproaching ? 'text-yellow-600' : 'text-gray-600'}`}>
                            Materials due: {formatDate(meeting.materials_deadline)}
                        </p>
                    )}
                </div>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        <p className="text-green-600">{success}</p>
                    </div>
                </div>
            )}

            {/* Materials URL */}
            {canEdit && !meeting.is_materials_submitted && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Materials URL</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Article or Document URL
                            </label>
                            <div className="relative">
                                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="url"
                                    value={materialsUrl}
                                    onChange={(e) => setMaterialsUrl(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="https://example.com/article"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Link to journal articles, papers, or online resources
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* File Upload (removed) and URL only */}
            {canEdit && !meeting.is_materials_submitted && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Upload Files</h4>
                    
                    {/* Drag and Drop Area */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            dragOver 
                                ? 'border-blue-400 bg-blue-50' 
                                : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <div className="space-y-2">
                            <p className="text-lg font-medium text-gray-900">
                                Drop files here or{' '}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-blue-600 hover:text-blue-700 underline"
                                >
                                    browse
                                </button>
                            </p>
                            <p className="text-sm text-gray-500">
                                PDF, DOC, DOCX, PPT, PPTX, TXT files up to 50MB
                            </p>
                        </div>
                        {/* File input removed */}
                    </div>

                    {/* Selected files section removed */}

                    {/* Upload Button */}
                    {(selectedFiles.length > 0 || materialsUrl.trim()) && (
                        <div className="mt-4">
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Materials
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Existing Materials */}
            {(meeting.materials_files?.length || meeting.materials_url) && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Current Materials</h4>
                    
                    {/* URL */}
                    {meeting.materials_url && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center">
                                    <Link className="w-4 h-4 text-blue-600 mr-2" />
                                    <div>
                                        <p className="text-sm font-medium text-blue-900">Materials URL</p>
                                        <a
                                            href={meeting.materials_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-700 hover:text-blue-800 underline break-all"
                                        >
                                            {meeting.materials_url}
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={meeting.materials_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Files */}
                    {meeting.materials_files && meeting.materials_files.length > 0 && (
                        <div className="space-y-2">
                            {meeting.materials_files.map((file) => (
                                <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center">
                                        <File className="w-4 h-4 text-gray-500 mr-2" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(file.size)} • Uploaded {formatDate(file.uploaded_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                        {canEdit && !meeting.is_materials_submitted && (
                                            <button
                                                onClick={() => handleRemoveFile(file.id)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Submit Materials */}
            {canEdit && !meeting.is_materials_submitted && (meeting.materials_files?.length || meeting.materials_url) && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-medium text-gray-900">Submit Materials</h4>
                            <p className="text-sm text-gray-600">
                                Mark materials as complete and notify team members
                            </p>
                        </div>
                        <button
                            onClick={handleSubmit}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Submit Materials
                        </button>
                    </div>
                </div>
            )}

            {/* Final Submission Status */}
            {meeting.is_materials_submitted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center">
                        <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                        <div>
                            <h4 className="text-lg font-medium text-green-900">Materials Submitted</h4>
                            <p className="text-sm text-green-700">
                                Materials have been submitted and team members have been notified.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialsUpload;