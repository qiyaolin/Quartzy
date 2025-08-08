import React, { useState, useEffect, useContext } from 'react';
import { 
    X, Settings, Calendar, Clock, MapPin, Users, Bell, Save, AlertCircle, 
    Plus, Trash2, RotateCcw, CheckCircle, Info, BookOpen, FileText
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { groupMeetingApi, MeetingConfiguration } from "../services/groupMeetingApi';

interface MeetingConfigurationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (configs: MeetingConfiguration[]) => Promise<void>;
    isSubmitting?: boolean;
}

const MeetingConfigurationModal: React.FC<MeetingConfigurationModalProps> = ({
    isOpen,
    onClose,
    onSave,
    isSubmitting = false
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    const [configurations, setConfigurations] = useState<MeetingConfiguration[]>([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<'lab_meeting' | 'journal_club'>('lab_meeting');

    // Load configurations on modal open
    useEffect(() => {
        if (isOpen && token) {
            loadConfigurations();
        }
    }, [isOpen, token]);

    const loadConfigurations = async () => {
        setLoading(true);
        try {
            const configs = await groupMeetingApi.getConfigurations(token!);
            setConfigurations(configs);
            setErrors({});
        } catch (error) {
            console.error('Failed to load configurations:', error);
            setErrors({ load: 'Failed to load meeting configurations' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfigChange = (type: 'lab_meeting' | 'journal_club', field: keyof MeetingConfiguration, value: any) => {
        setConfigurations(prev => prev.map(config => 
            config.meeting_type === type 
                ? { ...config, [field]: value }
                : config
        ));
        
        // Clear errors when user starts editing
        if (errors[`${type}.${field}`]) {
            setErrors(prev => ({ ...prev, [`${type}.${field}`]: '' }));
        }
    };

    const handleReminderChange = (type: 'lab_meeting' | 'journal_club', field: string, value: number) => {
        setConfigurations(prev => prev.map(config => 
            config.meeting_type === type 
                ? { 
                    ...config, 
                    reminder_schedule: { 
                        ...config.reminder_schedule, 
                        [field]: value 
                    }
                }
                : config
        ));
    };

    const validateConfigurations = (): boolean => {
        const newErrors: Record<string, string> = {};

        configurations.forEach(config => {
            const prefix = config.meeting_type;

            if (!config.title_template.trim()) {
                newErrors[`${prefix}.title_template`] = 'Title template is required';
            }

            if (!config.default_location.trim()) {
                newErrors[`${prefix}.default_location`] = 'Default location is required';
            }

            if (config.default_duration_minutes < 15 || config.default_duration_minutes > 480) {
                newErrors[`${prefix}.default_duration_minutes`] = 'Duration must be between 15 and 480 minutes';
            }

            if (config.default_day_of_week < 0 || config.default_day_of_week > 6) {
                newErrors[`${prefix}.default_day_of_week`] = 'Invalid day of week';
            }

            if (config.auto_generate_weeks_ahead < 1 || config.auto_generate_weeks_ahead > 52) {
                newErrors[`${prefix}.auto_generate_weeks_ahead`] = 'Must be between 1 and 52 weeks';
            }

            if (config.meeting_type === 'journal_club') {
                if (config.materials_deadline_days && (config.materials_deadline_days < 0 || config.materials_deadline_days > 30)) {
                    newErrors[`${prefix}.materials_deadline_days`] = 'Materials deadline must be between 0 and 30 days';
                }
            }

            // Validate reminder schedule
            if (config.reminder_schedule.presenter_reminder_days < 0 || config.reminder_schedule.presenter_reminder_days > 30) {
                newErrors[`${prefix}.presenter_reminder_days`] = 'Presenter reminder must be between 0 and 30 days';
            }

            if (config.reminder_schedule.pre_meeting_hours < 0 || config.reminder_schedule.pre_meeting_hours > 48) {
                newErrors[`${prefix}.pre_meeting_hours`] = 'Pre-meeting reminder must be between 0 and 48 hours';
            }

            if (config.meeting_type === 'journal_club' && config.reminder_schedule.materials_reminder_days) {
                if (config.reminder_schedule.materials_reminder_days < 0 || config.reminder_schedule.materials_reminder_days > 30) {
                    newErrors[`${prefix}.materials_reminder_days`] = 'Materials reminder must be between 0 and 30 days';
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateConfigurations()) {
            return;
        }

        try {
            await onSave(configurations);
            onClose();
        } catch (error) {
            console.error('Failed to save configurations:', error);
            setErrors({ submit: 'Failed to save configurations. Please try again.' });
        }
    };

    const generateMeetings = async (configType: 'lab_meeting' | 'journal_club') => {
        const config = configurations.find(c => c.meeting_type === configType);
        if (!config || !token) return;

        try {
            setLoading(true);
            await groupMeetingApi.generateMeetings(token, config.id);
            // Show success message
            setErrors({ success: `Successfully generated ${configType.replace('_', ' ')} meetings` });
        } catch (error) {
            console.error('Failed to generate meetings:', error);
            setErrors({ generate: `Failed to generate ${configType.replace('_', ' ')} meetings` });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const activeConfig = configurations.find(c => c.meeting_type === activeTab);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Settings className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Meeting Configuration</h2>
                            <p className="text-sm text-gray-500">Configure recurring meeting settings and schedules</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting || loading}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 px-6">
                    <button
                        onClick={() => setActiveTab('lab_meeting')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'lab_meeting'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Lab Meeting
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">2 presenters</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('journal_club')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'journal_club'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Journal Club
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">1 presenter</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading && (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}

                    {!loading && activeConfig && (
                        <div className="space-y-6">
                            {/* Basic Settings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Basic Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Title Template *
                                        </label>
                                        <input
                                            type="text"
                                            value={activeConfig.title_template}
                                            onChange={(e) => handleConfigChange(activeTab, 'title_template', e.target.value)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`${activeTab}.title_template`] ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                            placeholder="e.g., Lab Meeting - Week {week}"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Use {'{week}'} for automatic week numbering</p>
                                        {errors[`${activeTab}.title_template`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.title_template`]}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Default Location *
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={activeConfig.default_location}
                                                onChange={(e) => handleConfigChange(activeTab, 'default_location', e.target.value)}
                                                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                    errors[`${activeTab}.default_location`] ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                placeholder="Conference Room A"
                                            />
                                        </div>
                                        {errors[`${activeTab}.default_location`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.default_location`]}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Day of Week
                                        </label>
                                        <select
                                            value={activeConfig.default_day_of_week}
                                            onChange={(e) => handleConfigChange(activeTab, 'default_day_of_week', Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            {dayNames.map((day, index) => (
                                                <option key={index} value={index}>{day}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Default Time
                                        </label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="time"
                                                value={activeConfig.default_time}
                                                onChange={(e) => handleConfigChange(activeTab, 'default_time', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Duration (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            value={activeConfig.default_duration_minutes}
                                            onChange={(e) => handleConfigChange(activeTab, 'default_duration_minutes', Number(e.target.value))}
                                            min="15"
                                            max="480"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`${activeTab}.default_duration_minutes`] ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        />
                                        {errors[`${activeTab}.default_duration_minutes`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.default_duration_minutes`]}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Journal Club Specific Settings */}
                            {activeTab === 'journal_club' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-gray-900">Journal Club Settings</h3>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Materials Deadline (days before meeting)
                                        </label>
                                        <input
                                            type="number"
                                            value={activeConfig.materials_deadline_days || 7}
                                            onChange={(e) => handleConfigChange(activeTab, 'materials_deadline_days', Number(e.target.value))}
                                            min="0"
                                            max="30"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`${activeTab}.materials_deadline_days`] ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Presenters must submit materials this many days before the meeting</p>
                                        {errors[`${activeTab}.materials_deadline_days`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.materials_deadline_days`]}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Automation Settings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Automation Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Auto-generate meetings (weeks ahead)
                                        </label>
                                        <input
                                            type="number"
                                            value={activeConfig.auto_generate_weeks_ahead}
                                            onChange={(e) => handleConfigChange(activeTab, 'auto_generate_weeks_ahead', Number(e.target.value))}
                                            min="1"
                                            max="52"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`${activeTab}.auto_generate_weeks_ahead`] ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">System will auto-create meetings this many weeks in advance</p>
                                        {errors[`${activeTab}.auto_generate_weeks_ahead`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.auto_generate_weeks_ahead`]}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id={`active_${activeTab}`}
                                            checked={activeConfig.is_active}
                                            onChange={(e) => handleConfigChange(activeTab, 'is_active', e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor={`active_${activeTab}`} className="text-sm font-medium text-gray-700">
                                            Configuration Active
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Reminder Settings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                                    <Bell className="w-5 h-5" />
                                    Reminder Settings
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Presenter Reminder (days)
                                        </label>
                                        <input
                                            type="number"
                                            value={activeConfig.reminder_schedule.presenter_reminder_days}
                                            onChange={(e) => handleReminderChange(activeTab, 'presenter_reminder_days', Number(e.target.value))}
                                            min="0"
                                            max="30"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`${activeTab}.presenter_reminder_days`] ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        />
                                        {errors[`${activeTab}.presenter_reminder_days`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.presenter_reminder_days`]}</p>
                                        )}
                                    </div>

                                    {activeTab === 'journal_club' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Materials Reminder (days)
                                            </label>
                                            <input
                                                type="number"
                                                value={activeConfig.reminder_schedule.materials_reminder_days || 1}
                                                onChange={(e) => handleReminderChange(activeTab, 'materials_reminder_days', Number(e.target.value))}
                                                min="0"
                                                max="30"
                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                    errors[`${activeTab}.materials_reminder_days`] ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                            />
                                            {errors[`${activeTab}.materials_reminder_days`] && (
                                                <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.materials_reminder_days`]}</p>
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Pre-meeting Reminder (hours)
                                        </label>
                                        <input
                                            type="number"
                                            value={activeConfig.reminder_schedule.pre_meeting_hours}
                                            onChange={(e) => handleReminderChange(activeTab, 'pre_meeting_hours', Number(e.target.value))}
                                            min="0"
                                            max="48"
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`${activeTab}.pre_meeting_hours`] ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        />
                                        {errors[`${activeTab}.pre_meeting_hours`] && (
                                            <p className="text-red-500 text-xs mt-1">{errors[`${activeTab}.pre_meeting_hours`]}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => generateMeetings(activeTab)}
                                        disabled={loading || isSubmitting}
                                        className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Generate Meetings
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Generate meetings based on current configuration</p>
                            </div>
                        </div>
                    )}

                    {/* Error Messages */}
                    {errors.load && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-600 text-sm">{errors.load}</p>
                        </div>
                    )}

                    {errors.submit && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-600 text-sm">{errors.submit}</p>
                        </div>
                    )}

                    {errors.generate && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-600 text-sm">{errors.generate}</p>
                        </div>
                    )}

                    {errors.success && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-green-600 text-sm">{errors.success}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={isSubmitting || loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting || loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MeetingConfigurationModal;