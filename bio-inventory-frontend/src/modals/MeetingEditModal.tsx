import React, { useState, useEffect, useContext } from 'react';
import { 
    X, Calendar, Clock, MapPin, FileText, User, Link, Upload, 
    Users, ArrowUpDown, RotateCcw, Save, AlertCircle, CheckCircle
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';

// Types
interface GroupMeeting {
    id: number;
    title: string;
    description?: string;
    date: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    meeting_type: 'lab_meeting' | 'journal_club' | 'general';
    topic: string;
    presenter_id?: number;
    presenter?: Presenter;
    materials_url?: string;
    materials_file?: string;
    rotation_list_id?: number;
    is_materials_submitted?: boolean;
    materials_deadline?: string;
}

interface Presenter {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
}

interface SwapRequest {
    from_meeting_id: number;
    to_meeting_id: number;
    to_presenter_id: number;
    reason?: string;
}

interface MeetingEditModalProps {
    isOpen: boolean;
    meeting: GroupMeeting | null;
    onClose: () => void;
    onSave: (meeting: GroupMeeting) => Promise<void>;
    onSwapRequest: (swapRequest: SwapRequest) => Promise<void>;
    onPostpone: (meetingId: number, newDate: string, reason?: string) => Promise<void>;
    isSubmitting?: boolean;
}

const MeetingEditModal: React.FC<MeetingEditModalProps> = ({
    isOpen,
    meeting,
    onClose,
    onSave,
    onSwapRequest,
    onPostpone,
    isSubmitting = false
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    // Form state
    const [formData, setFormData] = useState<GroupMeeting | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    
    // Action modes
    const [actionMode, setActionMode] = useState<'edit' | 'swap' | 'postpone'>('edit');
    const [swapData, setSwapData] = useState<SwapRequest>({
        from_meeting_id: 0,
        to_meeting_id: 0,
        to_presenter_id: 0,
        reason: ''
    });
    const [postponeData, setPostponeData] = useState({
        newDate: '',
        reason: ''
    });
    
    // Available data
    const [availablePresenters, setAvailablePresenters] = useState<Presenter[]>([]);
    const [availableMeetings, setAvailableMeetings] = useState<GroupMeeting[]>([]);

    // Initialize form data when meeting changes
    useEffect(() => {
        if (meeting) {
            setFormData({ ...meeting });
            setSwapData({
                from_meeting_id: meeting.id,
                to_meeting_id: 0,
                to_presenter_id: 0,
                reason: ''
            });
            setPostponeData({
                newDate: meeting.date,
                reason: ''
            });
        }
    }, [meeting]);

    // Mock data initialization
    useEffect(() => {
        if (!token || !isOpen) return;

        // Mock presenters
        const mockPresenters: Presenter[] = [
            {
                id: 1,
                username: 'alice.johnson',
                first_name: 'Alice',
                last_name: 'Johnson',
                email: 'alice.johnson@lab.com',
                is_active: true
            },
            {
                id: 2,
                username: 'bob.smith',
                first_name: 'Bob',
                last_name: 'Smith',
                email: 'bob.smith@lab.com',
                is_active: true
            },
            {
                id: 3,
                username: 'carol.davis',
                first_name: 'Carol',
                last_name: 'Davis',
                email: 'carol.davis@lab.com',
                is_active: true
            },
            {
                id: 4,
                username: 'david.wilson',
                first_name: 'David',
                last_name: 'Wilson',
                email: 'david.wilson@lab.com',
                is_active: true
            }
        ];

        // Mock upcoming meetings for swap
        const mockMeetings: GroupMeeting[] = [];
        const today = new Date();
        for (let i = 1; i <= 10; i++) {
            const meetingDate = new Date(today);
            meetingDate.setDate(today.getDate() + (i * 7));
            
            if (meeting && i + 1000 === meeting.id) continue; // Skip current meeting
            
            mockMeetings.push({
                id: i + 1000,
                title: `${i % 2 === 0 ? 'Research Update' : 'Journal Club'}: Week ${i}`,
                date: meetingDate.toISOString().split('T')[0],
                start_time: '14:00',
                end_time: '15:00',
                meeting_type: i % 2 === 0 ? 'research_update' : 'journal_club',
                topic: `Meeting ${i} Topic`,
                presenter: mockPresenters[i % mockPresenters.length],
                presenter_id: mockPresenters[i % mockPresenters.length].id,
                status: 'scheduled',
                location: 'Conference Room A'
            } as GroupMeeting);
        }

        setAvailablePresenters(mockPresenters);
        setAvailableMeetings(mockMeetings);
    }, [token, isOpen, meeting]);

    const handleInputChange = (field: keyof GroupMeeting, value: any) => {
        if (formData) {
            setFormData({ ...formData, [field]: value });
            // Clear error when user starts typing
            if (errors[field]) {
                setErrors(prev => ({ ...prev, [field]: '' }));
            }
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

    const validateForm = () => {
        if (!formData) return false;
        
        const newErrors: Record<string, string> = {};

        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
        }

        if (!formData.topic.trim()) {
            newErrors.topic = 'Topic is required';
        }

        if (!formData.date) {
            newErrors.date = 'Date is required';
        }

        if (!formData.start_time) {
            newErrors.start_time = 'Start time is required';
        }

        if (!formData.end_time) {
            newErrors.end_time = 'End time is required';
        }

        if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
            newErrors.time = 'End time must be after start time';
        }

        // Journal club specific validation
        if (formData.meeting_type === 'journal_club' && !formData.materials_url && !selectedFile && !formData.is_materials_submitted) {
            newErrors.materials = 'Journal club meetings require materials (URL or file)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!formData || !validateForm()) return;

        try {
            const updatedMeeting = { ...formData };
            if (selectedFile) {
                updatedMeeting.materials_file = selectedFile.name; // In real app, upload file first
            }

            await onSave(updatedMeeting);
            onClose();
        } catch (error) {
            console.error('Failed to save meeting:', error);
            setErrors({ submit: 'Failed to save meeting. Please try again.' });
        }
    };

    const handleSwapSubmit = async () => {
        if (!swapData.to_meeting_id || !swapData.to_presenter_id) {
            setErrors({ swap: 'Please select both a meeting and presenter to swap with' });
            return;
        }

        try {
            await onSwapRequest(swapData);
            onClose();
        } catch (error) {
            console.error('Failed to submit swap request:', error);
            setErrors({ swap: 'Failed to submit swap request. Please try again.' });
        }
    };

    const handlePostponeSubmit = async () => {
        if (!postponeData.newDate) {
            setErrors({ postpone: 'Please select a new date' });
            return;
        }

        if (!meeting) return;

        try {
            await onPostpone(meeting.id, postponeData.newDate, postponeData.reason);
            onClose();
        } catch (error) {
            console.error('Failed to postpone meeting:', error);
            setErrors({ postpone: 'Failed to postpone meeting. Please try again.' });
        }
    };

    if (!isOpen || !meeting || !formData) return null;

    const isJournalClub = formData.meeting_type === 'journal_club';
    const selectedSwapMeeting = availableMeetings.find(m => m.id === swapData.to_meeting_id);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {actionMode === 'edit' && 'Edit Meeting'}
                                {actionMode === 'swap' && 'Request Swap'}
                                {actionMode === 'postpone' && 'Postpone Meeting'}
                            </h2>
                            <p className="text-sm text-gray-500">{meeting.title}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Action Mode Tabs */}
                <div className="flex border-b border-gray-200 px-6">
                    <button
                        onClick={() => setActionMode('edit')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            actionMode === 'edit'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <FileText className="w-4 h-4 inline mr-2" />
                        Edit Details
                    </button>
                    <button
                        onClick={() => setActionMode('swap')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            actionMode === 'swap'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <ArrowUpDown className="w-4 h-4 inline mr-2" />
                        Request Swap
                    </button>
                    <button
                        onClick={() => setActionMode('postpone')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            actionMode === 'postpone'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <RotateCcw className="w-4 h-4 inline mr-2" />
                        Postpone
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Edit Mode */}
                    {actionMode === 'edit' && (
                        <div className="space-y-6">
                            {/* Basic Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Meeting Type
                                    </label>
                                    <select
                                        value={formData.meeting_type}
                                        onChange={(e) => handleInputChange('meeting_type', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    >
                                        <option value="lab_meeting">Lab Meeting</option>
                                        <option value="journal_club">Journal Club</option>
                                        <option value="general">General Meeting</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Topic *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.topic}
                                        onChange={(e) => handleInputChange('topic', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                            errors.topic ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                        placeholder="Enter meeting topic"
                                        disabled={isSubmitting}
                                    />
                                    {errors.topic && <p className="text-red-500 text-xs mt-1">{errors.topic}</p>}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Meeting Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                        errors.title ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    placeholder="Meeting title"
                                    disabled={isSubmitting}
                                />
                                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                            </div>

                            {/* Date and Time */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => handleInputChange('date', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                            errors.date ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                        disabled={isSubmitting}
                                    />
                                    {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Start Time *
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => handleInputChange('start_time', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time *
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => handleInputChange('end_time', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}

                            {/* Location and Presenter */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location || ''}
                                        onChange={(e) => handleInputChange('location', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter meeting location"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Presenter
                                    </label>
                                    <select
                                        value={formData.presenter_id || ''}
                                        onChange={(e) => handleInputChange('presenter_id', e.target.value ? Number(e.target.value) : undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Select presenter</option>
                                        {availablePresenters.map(presenter => (
                                            <option key={presenter.id} value={presenter.id}>
                                                {presenter.first_name} {presenter.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Materials Section for Journal Club */}
                            {isJournalClub && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-gray-900">
                                        Meeting Materials
                                        <span className="text-red-500 ml-1">*</span>
                                    </h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Materials URL
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.materials_url || ''}
                                            onChange={(e) => handleInputChange('materials_url', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="https://example.com/materials"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Upload Materials File
                                        </label>
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            accept=".pdf,.doc,.docx,.ppt,.pptx"
                                            disabled={isSubmitting}
                                        />
                                        {selectedFile && (
                                            <p className="text-sm text-green-600 mt-1">
                                                Selected: {selectedFile.name}
                                            </p>
                                        )}
                                    </div>

                                    {formData.is_materials_submitted && (
                                        <div className="flex items-center text-sm text-green-600">
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Materials have been submitted
                                        </div>
                                    )}

                                    {errors.materials && <p className="text-red-500 text-xs mt-1">{errors.materials}</p>}
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    placeholder="Enter meeting description and agenda"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    )}

                    {/* Swap Mode */}
                    {actionMode === 'swap' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-blue-800 mb-2">Current Assignment</h3>
                                <p className="text-sm text-blue-700">
                                    You are presenting "{meeting.topic}" on {new Date(meeting.date).toLocaleDateString()}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Meeting to Swap With *
                                </label>
                                <select
                                    value={swapData.to_meeting_id}
                                    onChange={(e) => setSwapData(prev => ({ ...prev, to_meeting_id: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSubmitting}
                                >
                                    <option value="">Select a meeting</option>
                                    {availableMeetings.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.title} - {new Date(m.date).toLocaleDateString()} 
                                            (Presenter: {m.presenter?.first_name} {m.presenter?.last_name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedSwapMeeting && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Confirm Presenter to Swap With *
                                    </label>
                                    <select
                                        value={swapData.to_presenter_id}
                                        onChange={(e) => setSwapData(prev => ({ ...prev, to_presenter_id: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Select presenter</option>
                                        {availablePresenters.map(presenter => (
                                            <option key={presenter.id} value={presenter.id}>
                                                {presenter.first_name} {presenter.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason for Swap (Optional)
                                </label>
                                <textarea
                                    value={swapData.reason}
                                    onChange={(e) => setSwapData(prev => ({ ...prev, reason: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    placeholder="Explain why you need to swap (optional)"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {errors.swap && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-red-600 text-sm">{errors.swap}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Postpone Mode */}
                    {actionMode === 'postpone' && (
                        <div className="space-y-6">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-yellow-800 mb-2">Current Schedule</h3>
                                <p className="text-sm text-yellow-700">
                                    "{meeting.topic}" is scheduled for {new Date(meeting.date).toLocaleDateString()}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New Date *
                                </label>
                                <input
                                    type="date"
                                    value={postponeData.newDate}
                                    onChange={(e) => setPostponeData(prev => ({ ...prev, newDate: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    min={new Date().toISOString().split('T')[0]}
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason for Postponement (Required)
                                </label>
                                <textarea
                                    value={postponeData.reason}
                                    onChange={(e) => setPostponeData(prev => ({ ...prev, reason: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    placeholder="Please explain why this meeting needs to be postponed"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            {errors.postpone && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-red-600 text-sm">{errors.postpone}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* General Error Display */}
                    {errors.submit && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-600 text-sm">{errors.submit}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    
                    {actionMode === 'edit' && (
                        <button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    )}
                    
                    {actionMode === 'swap' && (
                        <button
                            onClick={handleSwapSubmit}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <ArrowUpDown className="w-4 h-4" />
                                    Submit Swap Request
                                </>
                            )}
                        </button>
                    )}
                    
                    {actionMode === 'postpone' && (
                        <button
                            onClick={handlePostponeSubmit}
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeetingEditModal;