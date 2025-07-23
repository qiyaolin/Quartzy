import React, { useState, useEffect, useContext } from 'react';
import { 
    Settings, 
    User, 
    Shield, 
    Bell, 
    Palette, 
    Globe, 
    Monitor, 
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Lock,
    Eye,
    EyeOff
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';

interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    language: 'en' | 'fr' | 'zh';
    email_notifications: boolean;
    push_notifications: boolean;
    items_per_page: number;
    auto_refresh_interval: number;
}

interface SystemSetting {
    id: number;
    key: string;
    value: string;
    setting_type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'EMAIL';
    description: string;
    is_admin_only: boolean;
    updated_at: string;
}

interface UserInfo {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    date_joined: string;
    last_login: string;
}

const SettingsPage = () => {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('preferences');
    const [preferences, setPreferences] = useState<UserPreferences>({
        theme: 'light',
        language: 'en',
        email_notifications: true,
        push_notifications: true,
        items_per_page: 10,
        auto_refresh_interval: 30
    });
    const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [systemStats, setSystemStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [showSensitiveSettings, setShowSensitiveSettings] = useState(false);

    useEffect(() => {
        fetchSettingsData();
    }, []);

    const fetchSettingsData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            
            // Fetch user preferences and overview
            const overviewResponse = await fetch('http://127.0.0.1:8000/api/settings/preferences/overview/', {
                headers: { 'Authorization': `Token ${token}` }
            });
            
            if (overviewResponse.ok) {
                const data = await overviewResponse.json();
                setUserInfo(data.user_info);
                setPreferences(data.preferences);
                setSystemSettings(data.system_settings || []);
            } else {
                console.error('Failed to fetch overview:', overviewResponse.statusText);
                // Set default preferences if API fails
                setPreferences({
                    theme: 'light',
                    language: 'en',
                    email_notifications: true,
                    push_notifications: true,
                    items_per_page: 10,
                    auto_refresh_interval: 30
                });
            }

            // Fetch admin system info if user is admin
            if (user?.is_staff) {
                const systemInfoResponse = await fetch('http://127.0.0.1:8000/api/settings/admin/system-info/', {
                    headers: { 'Authorization': `Token ${token}` }
                });
                
                if (systemInfoResponse.ok) {
                    const systemData = await systemInfoResponse.json();
                    setSystemStats(systemData);
                }
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
            // Set default preferences on error
            setPreferences({
                theme: 'light',
                language: 'en',
                email_notifications: true,
                push_notifications: true,
                items_per_page: 10,
                auto_refresh_interval: 30
            });
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async () => {
        try {
            setSaving(true);
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('http://127.0.0.1:8000/api/settings/preferences/update-preferences/', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(preferences)
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Preferences saved successfully' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                throw new Error('Failed to save preferences');
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
            setMessage({ type: 'error', text: 'Failed to save preferences' });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setSaving(false);
        }
    };

    const saveSystemSettings = async () => {
        try {
            setSaving(true);
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('http://127.0.0.1:8000/api/settings/admin/bulk-update/', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ settings: systemSettings })
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'System settings saved successfully' });
                setTimeout(() => setMessage(null), 3000);
                fetchSettingsData(); // Refresh data
            } else {
                throw new Error('Failed to save system settings');
            }
        } catch (error) {
            console.error('Error saving system settings:', error);
            setMessage({ type: 'error', text: 'Failed to save system settings' });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setSaving(false);
        }
    };

    const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    const handleSystemSettingChange = (id: number, value: string) => {
        setSystemSettings(prev => 
            prev.map(setting => 
                setting.id === id ? { ...setting, value } : setting
            )
        );
    };

    const renderSystemSettingInput = (setting: SystemSetting) => {
        const isSensitive = setting.key.includes('password') || setting.key.includes('secret') || setting.key.includes('key');
        
        switch (setting.setting_type) {
            case 'BOOLEAN':
                return (
                    <select
                        value={setting.value}
                        onChange={(e) => handleSystemSettingChange(setting.id, e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                    </select>
                );
            case 'NUMBER':
                return (
                    <input
                        type="number"
                        value={setting.value}
                        onChange={(e) => handleSystemSettingChange(setting.id, e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                );
            case 'EMAIL':
                return (
                    <input
                        type="email"
                        value={setting.value}
                        onChange={(e) => handleSystemSettingChange(setting.id, e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                );
            default:
                return (
                    <div className="relative">
                        <input
                            type={isSensitive && !showSensitiveSettings ? 'password' : 'text'}
                            value={setting.value}
                            onChange={(e) => handleSystemSettingChange(setting.id, e.target.value)}
                            className="w-full p-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                        {isSensitive && (
                            <button
                                type="button"
                                onClick={() => setShowSensitiveSettings(!showSensitiveSettings)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                            >
                                {showSensitiveSettings ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                );
        }
    };

    const tabs = [
        { id: 'preferences', label: 'User Preferences', icon: User, adminOnly: false },
        { id: 'system', label: 'System Settings', icon: Settings, adminOnly: true },
        { id: 'admin', label: 'Administration', icon: Shield, adminOnly: true },
    ];

    const visibleTabs = tabs.filter(tab => !tab.adminOnly || user?.is_staff);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gray-50 overflow-auto">
            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
                    <p className="text-gray-600">Manage your preferences and system configuration</p>
                </div>

            {/* Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center ${
                    message.type === 'success' 
                        ? 'bg-success-50 text-success-700 border border-success-200' 
                        : 'bg-danger-50 text-danger-700 border border-danger-200'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 mr-3" />
                    ) : (
                        <AlertCircle className="w-5 h-5 mr-3" />
                    )}
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-2xl">
                {visibleTabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'bg-white text-primary-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Icon className="w-4 h-4 mr-2" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

                {/* Tab Content */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                
                {/* User Preferences Tab */}
                {activeTab === 'preferences' && (
                    <div className="p-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">User Preferences</h2>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Profile Info */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                    <User className="w-5 h-5 mr-2" />
                                    Profile Information
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                                        <input
                                            type="text"
                                            value={userInfo?.username || ''}
                                            disabled
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                        <input
                                            type="email"
                                            value={userInfo?.email || ''}
                                            disabled
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                        <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                                            user?.is_staff 
                                                ? 'bg-primary-100 text-primary-700' 
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {user?.is_staff ? 'Administrator' : 'User'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Display Preferences */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                    <Palette className="w-5 h-5 mr-2" />
                                    Display & Interface
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                                        <select
                                            value={preferences.theme}
                                            onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        >
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                            <option value="auto">Auto</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                                        <select
                                            value={preferences.language}
                                            onChange={(e) => handlePreferenceChange('language', e.target.value)}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        >
                                            <option value="en">English</option>
                                            <option value="fr">French</option>
                                            <option value="zh">Chinese</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Items per page</label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="100"
                                            value={preferences.items_per_page}
                                            onChange={(e) => handlePreferenceChange('items_per_page', parseInt(e.target.value))}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Auto-refresh interval (seconds)</label>
                                        <input
                                            type="number"
                                            min="10"
                                            max="300"
                                            value={preferences.auto_refresh_interval}
                                            onChange={(e) => handlePreferenceChange('auto_refresh_interval', parseInt(e.target.value))}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notification Preferences */}
                            <div className="space-y-6 lg:col-span-2">
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                    <Bell className="w-5 h-5 mr-2" />
                                    Notifications
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={preferences.email_notifications}
                                            onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
                                            className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">Email Notifications</div>
                                            <div className="text-sm text-gray-600">Receive notifications via email</div>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={preferences.push_notifications}
                                            onChange={(e) => handlePreferenceChange('push_notifications', e.target.checked)}
                                            className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">Push Notifications</div>
                                            <div className="text-sm text-gray-600">Receive browser notifications</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
                            <button
                                onClick={savePreferences}
                                disabled={saving}
                                className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 focus:ring-2 focus:ring-primary-500/20 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Preferences
                            </button>
                        </div>
                    </div>
                )}

                {/* System Settings Tab */}
                {activeTab === 'system' && user?.is_staff && (
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
                            <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                                <Lock className="w-4 h-4 mr-1" />
                                Admin Only
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {systemSettings.map(setting => (
                                <div key={setting.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-medium text-gray-700">
                                            {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </label>
                                        {setting.is_admin_only && (
                                            <Shield className="w-4 h-4 text-amber-500" />
                                        )}
                                    </div>
                                    {renderSystemSettingInput(setting)}
                                    <p className="text-xs text-gray-500">{setting.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
                            <button
                                onClick={saveSystemSettings}
                                disabled={saving}
                                className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 focus:ring-2 focus:ring-primary-500/20 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save System Settings
                            </button>
                        </div>
                    </div>
                )}

                {/* Administration Tab */}
                {activeTab === 'admin' && user?.is_staff && (
                    <div className="p-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">System Administration</h2>
                        
                        {systemStats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-primary-600">Total Users</p>
                                            <p className="text-2xl font-bold text-primary-700">{systemStats.system_stats.total_users}</p>
                                        </div>
                                        <User className="w-8 h-8 text-primary-500" />
                                    </div>
                                </div>
                                
                                <div className="bg-success-50 border border-success-200 rounded-xl p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-success-600">Total Items</p>
                                            <p className="text-2xl font-bold text-success-700">{systemStats.system_stats.total_items}</p>
                                        </div>
                                        <Monitor className="w-8 h-8 text-success-500" />
                                    </div>
                                </div>
                                
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-amber-600">Active Requests</p>
                                            <p className="text-2xl font-bold text-amber-700">{systemStats.system_stats.total_requests}</p>
                                        </div>
                                        <Globe className="w-8 h-8 text-amber-500" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 rounded-xl p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium text-gray-700">Settings Configured:</span>
                                    <span className="ml-2 text-gray-600">{systemStats?.settings_count || 0}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">User Preferences:</span>
                                    <span className="ml-2 text-gray-600">{systemStats?.preferences_configured || 0}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Admin Users:</span>
                                    <span className="ml-2 text-gray-600">{systemStats?.system_stats?.admin_users || 0}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Total Funds:</span>
                                    <span className="ml-2 text-gray-600">{systemStats?.system_stats?.total_funds || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;