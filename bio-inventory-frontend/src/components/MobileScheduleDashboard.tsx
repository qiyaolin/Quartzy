import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
    Calendar, Clock, Users, AlertTriangle, CheckCircle, 
    Play, Pause, RefreshCw, Bell, ArrowRight, BookOpen,
    ClipboardList, Monitor, MapPin, Timer, TrendingUp,
    Zap, Plus, Search, Filter, Grid3X3, List,
    ChevronRight, ChevronDown, Star, Settings,
    Home, CalendarDays, Menu, X, Award, Activity
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { buildApiUrl } from '../config/api.ts';
import ScheduleDetailModal from '../modals/ScheduleDetailModal.tsx';
import { Schedule } from '../services/scheduleApi.ts';

interface TodayEvent {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    event_type: 'meeting' | 'booking' | 'task';
    description: string;
    is_mine: boolean;
    equipment_name?: string;
    meeting_type?: string;
    task_status?: string;
    status?: string;
}

interface QuickAction {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    color: string;
    bgColor: string;
    onClick: () => void;
    badge?: string | number;
    priority?: 'high' | 'medium' | 'low';
}

interface Equipment {
    id: number;
    name: string;
    location: string;
    is_bookable: boolean;
    requires_qr_checkin: boolean;
    is_in_use: boolean;
}

interface UserStats {
    presentations_this_year: number;
    tasks_completed_this_year: number;
    equipment_hours_this_month: number;
    active_bookings: number;
    pending_swap_requests: number;
}

interface MobileScheduleDashboardProps {
    availableEquipment?: Equipment[];
    onQuickBookEquipment?: (equipmentId: number) => void;
    onCompleteTask?: (taskId: number) => void;
    onNavigateToAction?: (actionUrl: string) => void;
    onNavigateToTab?: (tab: string) => void;
    onRefresh?: () => void;
    // Phase 1 enhancements - new action props
    onEditEvent?: (schedule: Schedule) => void;
    onDeleteEvent?: (scheduleId: number) => void;
    onUploadMeetingMaterials?: (meetingId: number) => void;
    onViewTaskDetails?: (taskId: number) => void;
    onRequestTaskSwap?: (taskId: number) => void;
    onCancelBooking?: (bookingId: number) => void;
    onBookNewEquipment?: () => void;
}

const MobileScheduleDashboard: React.FC<MobileScheduleDashboardProps> = ({
    availableEquipment = [],
    onQuickBookEquipment,
    onCompleteTask,
    onNavigateToAction,
    onNavigateToTab,
    onRefresh,
    // Phase 1 enhancement props
    onEditEvent,
    onDeleteEvent,
    onUploadMeetingMaterials,
    onViewTaskDetails,
    onRequestTaskSwap,
    onCancelBooking,
    onBookNewEquipment
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('MobileScheduleDashboard must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSection, setActiveSection] = useState<'overview' | 'today' | 'actions'>('overview');
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [hapticFeedback, setHapticFeedback] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const quickActions: QuickAction[] = useMemo(() => [
        {
            id: 'book-equipment',
            title: 'Book Equipment',
            description: 'Quick book available equipment',
            icon: Monitor,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            onClick: () => onNavigateToTab?.('equipment'),
            badge: availableEquipment.filter(eq => eq.is_bookable && !eq.is_in_use).length,
            priority: 'high'
        },
        {
            id: 'schedule-meeting',
            title: 'Schedule Meeting',
            description: 'Create a new meeting',
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            onClick: () => onNavigateToTab?.('meetings'),
            priority: 'high'
        },
        {
            id: 'add-event',
            title: 'Add Event',
            description: 'Create calendar event',
            icon: Calendar,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            onClick: () => onNavigateToTab?.('calendar'),
            priority: 'medium'
        },
        {
            id: 'manage-tasks',
            title: 'My Tasks',
            description: 'View and complete tasks',
            icon: ClipboardList,
            color: 'text-orange-600',
            bgColor: 'bg-orange-100',
            onClick: () => onNavigateToTab?.('tasks'),
            priority: 'medium'
        },
        {
            id: 'view-schedule',
            title: 'My Schedule',
            description: 'Personal schedule overview',
            icon: CalendarDays,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100',
            onClick: () => onNavigateToTab?.('my-schedule'),
            priority: 'low'
        },
        {
            id: 'qr-checkin',
            title: 'QR Check-in',
            description: 'Quick equipment check-in',
            icon: Monitor,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
            onClick: () => {
                if (hapticFeedback && 'vibrate' in navigator) {
                    navigator.vibrate(50);
                }
                // TODO: Implement QR scanner
                console.log('Open QR scanner');
            },
            priority: 'low'
        }
    ], [availableEquipment, onNavigateToTab, hapticFeedback]);
    
    const handleActionTap = (action: () => void, withHaptic = true) => {
        if (withHaptic && hapticFeedback && 'vibrate' in navigator) {
            navigator.vibrate(30);
        }
        action();
    };
    
    const priorityActions = quickActions.filter(action => action.priority === 'high');
    const secondaryActions = quickActions.filter(action => action.priority !== 'high');

    const fetchDashboardData = async () => {
        try {
            const response = await fetch(
                buildApiUrl('schedule/unified-dashboard/overview/'),
                { headers: { 'Authorization': `Token ${token}` } }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            const data = await response.json();
            setTodayEvents(data.today_events || []);
            setUserStats(data.stats || null);
        } catch (err) {
            console.error('Dashboard data fetch error:', err);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData();
        setRefreshing(false);
        onRefresh?.();
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await fetchDashboardData();
            setLoading(false);
        };

        if (token) {
            loadData();
        }
    }, [token]);

    const formatTime = (timeString: string) => {
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getEventTypeIcon = (eventType: string) => {
        switch (eventType) {
            case 'meeting': return <Users className="w-4 h-4" />;
            case 'booking': return <Monitor className="w-4 h-4" />;
            case 'task': return <ClipboardList className="w-4 h-4" />;
            default: return <Calendar className="w-4 h-4" />;
        }
    };

    // Helper function to convert TodayEvent to Schedule format for modal
    const convertEventToSchedule = (event: TodayEvent): Schedule => {
        return {
            id: event.id,
            title: event.title,
            description: event.description,
            date: new Date().toISOString().split('T')[0], // Today's date
            start_time: event.start_time,
            end_time: event.end_time,
            status: event.status || 'scheduled',
            location: '', // Not available in TodayEvent
            equipment: event.equipment_name ? { name: event.equipment_name } : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        } as Schedule;
    };

    const handleEventClick = (event: TodayEvent) => {
        const schedule = convertEventToSchedule(event);
        setSelectedEvent(schedule);
        setShowDetailModal(true);
    };

    const handleCloseModal = () => {
        setShowDetailModal(false);
        setSelectedEvent(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Lab Schedule</h1>
                        <p className="text-sm text-gray-600">
                            {new Date().toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                month: 'short', 
                                day: 'numeric' 
                            })}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                        >
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                        >
                            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {showMobileMenu && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowMobileMenu(false)}>
                    <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold">Navigation</h2>
                                <button
                                    onClick={() => setShowMobileMenu(false)}
                                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Add navigation items here */}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="bg-white border-b border-gray-200 px-4 py-2">
                <div className="flex space-x-1">
                    {[
                        { id: 'overview', label: 'Overview', icon: Home },
                        { id: 'today', label: 'Today', icon: Calendar },
                        { id: 'actions', label: 'Actions', icon: Zap }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                activeSection === tab.id
                                    ? 'bg-primary-100 text-primary-700'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="px-4 py-6 space-y-6">
                {/* Overview Section */}
                {activeSection === 'overview' && (
                    <>
                        {/* Quick Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <BookOpen className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {userStats?.presentations_this_year || 0}
                                        </p>
                                        <p className="text-sm text-gray-600">Presentations</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {userStats?.tasks_completed_this_year || 0}
                                        </p>
                                        <p className="text-sm text-gray-600">Tasks Done</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Timer className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {userStats?.equipment_hours_this_month || 0}h
                                        </p>
                                        <p className="text-sm text-gray-600">Equipment</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-lg">
                                        <Calendar className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {userStats?.active_bookings || 0}
                                        </p>
                                        <p className="text-sm text-gray-600">Active</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Today's Schedule Preview */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                        Today's Schedule
                                    </h3>
                                    <button
                                        onClick={() => setActiveSection('today')}
                                        className="text-primary-600 text-sm font-medium"
                                    >
                                        View All
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                {todayEvents.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-500">No events scheduled for today</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {todayEvents.slice(0, 3).map((event) => (
                                            <div 
                                                key={event.id}
                                                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
                                            >
                                                <div className="flex-shrink-0">
                                                    {getEventTypeIcon(event.event_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{event.title}</p>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                                        <Clock className="w-3 h-3" />
                                                        <span>
                                                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                                        </span>
                                                        {event.is_mine && (
                                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                                                Mine
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {todayEvents.length > 3 && (
                                            <button
                                                onClick={() => setActiveSection('today')}
                                                className="w-full text-center py-3 text-primary-600 font-medium"
                                            >
                                                View {todayEvents.length - 3} more events
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Today Section */}
                {activeSection === 'today' && (
                    <div className="space-y-4">
                        {todayEvents.length === 0 ? (
                            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No events today</h3>
                                <p className="text-gray-600">Enjoy your free day or create a new event!</p>
                                <button
                                    onClick={() => onNavigateToTab?.('calendar')}
                                    className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                    Add Event
                                </button>
                            </div>
                        ) : (
                            todayEvents.map((event) => (
                                <div 
                                    key={event.id} 
                                    onClick={() => handleEventClick(event)}
                                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 active:scale-95"
                                >
                                    <div className={`h-2 ${
                                        event.is_mine ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                    }`} />
                                    <div className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${
                                                event.is_mine ? 'bg-blue-100' : 'bg-gray-100'
                                            }`}>
                                                {getEventTypeIcon(event.event_type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                                    {event.is_mine && (
                                                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                                                            Mine
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        <span>
                                                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                                        </span>
                                                    </div>
                                                    {event.equipment_name && (
                                                        <div className="flex items-center gap-1">
                                                            <Monitor className="w-4 h-4" />
                                                            <span>{event.equipment_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {event.description && (
                                                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">{event.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Quick Actions Section */}
                {activeSection === 'actions' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="p-3 bg-yellow-100 rounded-full inline-flex mb-4">
                                <Zap className="w-8 h-8 text-yellow-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Quick Actions</h2>
                            <p className="text-gray-600">Common tasks and shortcuts</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {quickActions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={action.onClick}
                                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all duration-200 text-left relative group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-3 rounded-xl ${action.bgColor}`}>
                                            <action.icon className={`w-6 h-6 ${action.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 mb-1">{action.title}</h4>
                                            <p className="text-sm text-gray-600">{action.description}</p>
                                            {action.badge && (
                                                <span className="inline-block mt-2 bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full font-medium">
                                                    {action.badge} available
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Schedule Detail Modal */}
            <ScheduleDetailModal
                isOpen={showDetailModal}
                onClose={handleCloseModal}
                schedule={selectedEvent}
                onEdit={(schedule) => {
                    onEditEvent?.(schedule);
                    handleCloseModal();
                }}
                onDelete={(scheduleId) => {
                    onDeleteEvent?.(scheduleId);
                    handleCloseModal();
                }}
                onMarkComplete={(scheduleId) => {
                    onCompleteTask?.(scheduleId);
                    handleCloseModal();
                }}
            />
        </div>
    );
};

export default MobileScheduleDashboard;