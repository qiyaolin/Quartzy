import React, { useState, useEffect, useContext } from 'react';
import {
    Settings, Save, RotateCcw, Clock, MapPin, Calendar,
    Mail, Users, AlertCircle, CheckCircle, Plus, X, Trash2
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

// Types
interface MeetingConfiguration {
    id: number;
    meeting_type: 'research_update' | 'journal_club';
    default_duration_minutes: number;
    default_location: string;
    default_day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
    default_time: string;
    materials_deadline_days: number; // Days before meeting
    reminder_schedule: {
        presenter_reminder_days: number;
        materials_reminder_days: number;
        pre_meeting_hours: number;
    };
    auto_generate_months_ahead: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface GlobalSettings {
    rotation_pattern: 'alternating' | 'separate_weeks' | 'custom';
    skip_holidays: boolean;
    holiday_list: string[];
    default_team_emails: string[];
    enable_auto_generation: boolean;
    enable_email_notifications: boolean;
    admin_emails: string[];
}

interface AdminConfigPanelProps {
    onSave?: (config: MeetingConfiguration[], settings: GlobalSettings) => Promise<void>;
}

const AdminConfigPanel: React.FC<AdminConfigPanelProps> = ({ onSave }) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    // State
    const [configurations, setConfigurations] = useState<MeetingConfiguration[]>([]);
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
        rotation_pattern: 'alternating',
        skip_holidays: false,
        holiday_list: [],
        default_team_emails: [],
        enable_auto_generation: true,
        enable_email_notifications: true,
        admin_emails: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'meetings' | 'notifications' | 'general'>('meetings');

    // Form states
    const [newHoliday, setNewHoliday] = useState('');
    const [newTeamEmail, setNewTeamEmail] = useState('');
    const [newAdminEmail, setNewAdminEmail] = useState('');

    // Initialize data
    useEffect(() => {
        if (!token) return;

        const initializeMockData = () => {
            setLoading(true);
            try {
                // Mock configurations
                const mockConfigurations: MeetingConfiguration[] = [
                    {
                        id: 1,
                        meeting_type: 'research_update',
                        default_duration_minutes: 90,
                        default_location: 'Conference Room A',
                        default_day_of_week: 5, // Friday
                        default_time: '14:00',
                        materials_deadline_days: 0, // No materials needed
                        reminder_schedule: {
                            presenter_reminder_days: 3,
                            materials_reminder_days: 0,
                            pre_meeting_hours: 1
                        },
                        auto_generate_months_ahead: 6,
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        id: 2,
                        meeting_type: 'journal_club',
                        default_duration_minutes: 60,
                        default_location: 'Conference Room A',
                        default_day_of_week: 5, // Friday
                        default_time: '15:00',
                        materials_deadline_days: 7, // 1 week before
                        reminder_schedule: {
                            presenter_reminder_days: 3,
                            materials_reminder_days: 1, // Daily reminders
                            pre_meeting_hours: 1
                        },
                        auto_generate_months_ahead: 6,
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ];

                // Mock global settings
                const mockGlobalSettings: GlobalSettings = {
                    rotation_pattern: 'alternating',
                    skip_holidays: true,
                    holiday_list: [
                        '2024-01-01', // New Year's Day
                        '2024-07-04', // Independence Day
                        '2024-12-25'  // Christmas
                    ],
                    default_team_emails: [
                        'alice.johnson@lab.com',
                        'bob.smith@lab.com',
                        'carol.davis@lab.com',
                        'david.wilson@lab.com'
                    ],
                    enable_auto_generation: true,
                    enable_email_notifications: true,
                    admin_emails: [
                        'admin@lab.com',
                        'pi@lab.com'
                    ]
                };

                setConfigurations(mockConfigurations);
                setGlobalSettings(mockGlobalSettings);
                setError(null);
            } catch (err) {
                setError('Failed to load configuration data');
                console.error('Error loading config:', err);
            } finally {
                setLoading(false);
            }
        };

        initializeMockData();
    }, [token]);

    // Handle configuration changes
    const handleConfigChange = (id: number, field: string, value: any) => {
        setConfigurations(prev =>
            prev.map(config =>
                config.id === id
                    ? field.includes('.')
                        ? {
                            ...config,
                            [field.split('.')[0]]: {
                                ...config[field.split('.')[0] as keyof MeetingConfiguration] as any,
                                [field.split('.')[1]]: value
                            }
                        }
                        : { ...config, [field]: value }
                    : config
            )
        );
    };

    // Handle global settings changes
    const handleGlobalSettingChange = (field: keyof GlobalSettings, value: any) => {
        setGlobalSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Add/remove list items
    const addHoliday = () => {
        if (newHoliday && !globalSettings.holiday_list.includes(newHoliday)) {
            setGlobalSettings(prev => ({
                ...prev,
                holiday_list: [...prev.holiday_list, newHoliday]
            }));
            setNewHoliday('');
        }
    };

    const removeHoliday = (holiday: string) => {
        setGlobalSettings(prev => ({
            ...prev,
            holiday_list: prev.holiday_list.filter(h => h !== holiday)
        }));
    };

    const addTeamEmail = () => {
        if (newTeamEmail && !globalSettings.default_team_emails.includes(newTeamEmail)) {
            setGlobalSettings(prev => ({
                ...prev,
                default_team_emails: [...prev.default_team_emails, newTeamEmail]
            }));
            setNewTeamEmail('');
        }
    };

    const removeTeamEmail = (email: string) => {
        setGlobalSettings(prev => ({
            ...prev,
            default_team_emails: prev.default_team_emails.filter(e => e !== email)
        }));
    };

    const addAdminEmail = () => {
        if (newAdminEmail && !globalSettings.admin_emails.includes(newAdminEmail)) {
            setGlobalSettings(prev => ({
                ...prev,
                admin_emails: [...prev.admin_emails, newAdminEmail]
            }));
            setNewAdminEmail('');
        }
    };

    const removeAdminEmail = (email: string) => {
        setGlobalSettings(prev => ({
            ...prev,
            admin_emails: prev.admin_emails.filter(e => e !== email)
        }));
    };

    // Save configuration
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        
        try {
            if (onSave) {
                await onSave(configurations, globalSettings);
            }
            setSuccess('Configuration saved successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    // Get day name
    const getDayName = (dayNumber: number): string => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayNumber] || 'Unknown';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Group Meetings Configuration</h2>
                        <p className="text-gray-600">Configure automated meeting generation and notification settings</p>
                    </div>
                    
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200">
                    {[
                        { id: 'meetings', label: 'Meeting Settings', icon: Calendar },
                        { id: 'notifications', label: 'Notifications', icon: Mail },
                        { id: 'general', label: 'General Settings', icon: Settings }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Icon className="w-4 h-4 inline mr-2" />
                                {tab.label}
                            </button>
                        );
                    })}
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

            {/* Tab Content */}
            {activeTab === 'meetings' && (
                <div className="space-y-6">
                    {configurations.map((config) => (
                        <div key={config.id} className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                                    {config.meeting_type.replace('_', ' ')} Configuration
                                </h3>
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={config.is_active}
                                        onChange={(e) => handleConfigChange(config.id, 'is_active', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Active</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Basic Settings */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Duration (minutes)
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            value={config.default_duration_minutes}
                                            onChange={(e) => handleConfigChange(config.id, 'default_duration_minutes', parseInt(e.target.value))}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            min="30"
                                            max="180"
                                            step="15"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Location
                                    </label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={config.default_location}
                                            onChange={(e) => handleConfigChange(config.id, 'default_location', e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Conference Room A"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Day
                                    </label>
                                    <select
                                        value={config.default_day_of_week}
                                        onChange={(e) => handleConfigChange(config.id, 'default_day_of_week', parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {[0, 1, 2, 3, 4, 5, 6].map(day => (
                                            <option key={day} value={day}>{getDayName(day)}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Default Time
                                    </label>
                                    <input
                                        type="time"
                                        value={config.default_time}
                                        onChange={(e) => handleConfigChange(config.id, 'default_time', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Auto-generate Months Ahead
                                    </label>
                                    <input
                                        type="number"
                                        value={config.auto_generate_months_ahead}
                                        onChange={(e) => handleConfigChange(config.id, 'auto_generate_months_ahead', parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        min="1"
                                        max="12"
                                    />
                                </div>

                                {config.meeting_type === 'journal_club' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Materials Deadline (days before)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.materials_deadline_days}
                                            onChange={(e) => handleConfigChange(config.id, 'materials_deadline_days', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            min="0"
                                            max="14"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Reminder Settings */}
                            <div className="mt-6">
                                <h4 className="text-md font-medium text-gray-900 mb-4">Reminder Schedule</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Presenter Reminder (days before)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.reminder_schedule.presenter_reminder_days}
                                            onChange={(e) => handleConfigChange(config.id, 'reminder_schedule.presenter_reminder_days', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            min="0"
                                            max="7"
                                        />
                                    </div>

                                    {config.meeting_type === 'journal_club' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Materials Reminder (days before deadline)
                                            </label>
                                            <input
                                                type="number"
                                                value={config.reminder_schedule.materials_reminder_days}
                                                onChange={(e) => handleConfigChange(config.id, 'reminder_schedule.materials_reminder_days', parseInt(e.target.value))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                min="0"
                                                max="7"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pre-meeting Reminder (hours before)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.reminder_schedule.pre_meeting_hours}
                                            onChange={(e) => handleConfigChange(config.id, 'reminder_schedule.pre_meeting_hours', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            min="0"
                                            max="24"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    {/* Email Settings */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Email Notification Settings</h3>
                        
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-md font-medium text-gray-900">Enable Email Notifications</h4>
                                    <p className="text-sm text-gray-600">Send automated email reminders and notifications</p>
                                </div>
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={globalSettings.enable_email_notifications}
                                        onChange={(e) => handleGlobalSettingChange('enable_email_notifications', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Enabled</span>
                                </label>
                            </div>

                            {/* Team Emails */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-3">Default Team Email List</h4>
                                <p className="text-sm text-gray-600 mb-4">These emails will receive meeting notifications</p>
                                
                                <div className="space-y-2 mb-4">
                                    {globalSettings.default_team_emails.map((email, index) => (
                                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                            <span className="text-sm text-gray-900">{email}</span>
                                            <button
                                                onClick={() => removeTeamEmail(email)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        value={newTeamEmail}
                                        onChange={(e) => setNewTeamEmail(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="team.member@lab.com"
                                    />
                                    <button
                                        onClick={addTeamEmail}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Admin Emails */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-3">Administrator Emails</h4>
                                <p className="text-sm text-gray-600 mb-4">These emails will receive admin notifications and swap requests</p>
                                
                                <div className="space-y-2 mb-4">
                                    {globalSettings.admin_emails.map((email, index) => (
                                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                            <span className="text-sm text-gray-900">{email}</span>
                                            <button
                                                onClick={() => removeAdminEmail(email)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="admin@lab.com"
                                    />
                                    <button
                                        onClick={addAdminEmail}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'general' && (
                <div className="space-y-6">
                    {/* General Settings */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h3>
                        
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-md font-medium text-gray-900">Enable Auto-generation</h4>
                                    <p className="text-sm text-gray-600">Automatically generate meetings based on configuration</p>
                                </div>
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={globalSettings.enable_auto_generation}
                                        onChange={(e) => handleGlobalSettingChange('enable_auto_generation', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Enabled</span>
                                </label>
                            </div>

                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-3">Rotation Pattern</h4>
                                <p className="text-sm text-gray-600 mb-4">How should Research Updates and Journal Club meetings be scheduled?</p>
                                
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="rotation_pattern"
                                            value="alternating"
                                            checked={globalSettings.rotation_pattern === 'alternating'}
                                            onChange={(e) => handleGlobalSettingChange('rotation_pattern', e.target.value)}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-900">Alternating (Research Update → Journal Club → Research Update...)</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="rotation_pattern"
                                            value="separate_weeks"
                                            checked={globalSettings.rotation_pattern === 'separate_weeks'}
                                            onChange={(e) => handleGlobalSettingChange('rotation_pattern', e.target.value)}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-900">Separate weeks (different days/times)</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="rotation_pattern"
                                            value="custom"
                                            checked={globalSettings.rotation_pattern === 'custom'}
                                            onChange={(e) => handleGlobalSettingChange('rotation_pattern', e.target.value)}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-900">Custom pattern</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-md font-medium text-gray-900">Skip Holidays</h4>
                                    <p className="text-sm text-gray-600">Automatically skip meetings on holidays</p>
                                </div>
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={globalSettings.skip_holidays}
                                        onChange={(e) => handleGlobalSettingChange('skip_holidays', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Enabled</span>
                                </label>
                            </div>

                            {/* Holiday List */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-3">Holiday List</h4>
                                <p className="text-sm text-gray-600 mb-4">Meetings will be skipped on these dates</p>
                                
                                <div className="space-y-2 mb-4">
                                    {globalSettings.holiday_list.map((holiday, index) => (
                                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                            <span className="text-sm text-gray-900">
                                                {new Date(holiday).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                            <button
                                                onClick={() => removeHoliday(holiday)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={newHoliday}
                                        onChange={(e) => setNewHoliday(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={addHoliday}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminConfigPanel;