import React, { useState, useEffect, useContext } from 'react';
import {
    Calendar, Clock, Users, AlertTriangle, CheckCircle, 
    Play, Pause, RefreshCw, Bell, ArrowRight, BookOpen,
    ClipboardList, Monitor, MapPin, Timer, TrendingUp
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { buildApiUrl } from '../config/api.ts';

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

interface UpcomingMeeting {
    id: number;
    date: string;
    meeting_type: 'research_update' | 'journal_club';
    status: string;
    is_presenter: boolean;
    presenter_names: string[];
    materials_required: boolean;
    materials_submitted: boolean;
}

interface MyTask {
    id: number;
    template_name: string;
    scheduled_period: string;
    execution_start_date: string;
    execution_end_date: string;
    status: string;
    is_overdue: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimated_hours: number | null;
    can_complete: boolean;
    is_primary: boolean;
}

interface EquipmentBooking {
    id: number;
    equipment_name: string;
    equipment_location: string;
    start_time: string;
    end_time: string;
    status: string;
    requires_qr_checkin: boolean;
    is_today: boolean;
    time_until: number | null;
}

interface PendingAction {
    type: 'journal_club_submission' | 'task_swap_approval' | 'meeting_swap_approval';
    title: string;
    description: string;
    urgency: 'low' | 'medium' | 'high';
    due_date?: string;
    days_remaining?: number;
    action_url: string;
    meeting_id?: number;
    swap_id?: number;
}

interface UserStats {
    presentations_total: number;
    presentations_this_year: number;
    tasks_completed_this_year: number;
    equipment_hours_this_month: number;
    active_bookings: number;
    pending_swap_requests: number;
}

interface DashboardData {
    today_events: TodayEvent[];
    upcoming_meetings: UpcomingMeeting[];
    my_tasks: MyTask[];
    equipment_bookings: EquipmentBooking[];
    pending_actions: PendingAction[];
    stats: UserStats;
    last_updated: string;
}

interface UnifiedScheduleDashboardProps {
    onQuickBookEquipment?: (equipmentId: number) => void;
    onCompleteTask?: (taskId: number) => void;
    onNavigateToAction?: (actionUrl: string) => void;
    onRefresh?: () => void;
}

const UnifiedScheduleDashboard: React.FC<UnifiedScheduleDashboardProps> = ({
    onQuickBookEquipment,
    onCompleteTask,
    onNavigateToAction,
    onRefresh
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('UnifiedScheduleDashboard must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = async () => {
        try {
            const response = await fetch(
                buildApiUrl('schedule/unified-dashboard/overview/'),
                {
                    headers: { 'Authorization': `Token ${token}` }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
            }

            const data = await response.json();
            setDashboardData(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard');
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

    // Auto-refresh every 5 minutes
    useEffect(() => {
        if (!token) return;

        const interval = setInterval(() => {
            fetchDashboardData();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [token]);

    const formatTime = (timeString: string) => {
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
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

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-800';
            case 'high': return 'bg-orange-100 text-orange-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                        <p className="text-red-800 font-medium">Failed to Load Dashboard</p>
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                    <button 
                        onClick={handleRefresh}
                        className="ml-auto px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const { today_events, upcoming_meetings, my_tasks, equipment_bookings, pending_actions, stats } = dashboardData;

    return (
        <div className="space-y-6">
            {/* Header with Stats and Refresh */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Laboratory Schedule Dashboard</h2>
                        <p className="text-gray-600">Your unified view of all schedule activities</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700">Presentations</span>
                        </div>
                        <p className="text-lg font-bold text-blue-900">{stats.presentations_total}</p>
                        <p className="text-xs text-blue-600">total</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700">Tasks</span>
                        </div>
                        <p className="text-lg font-bold text-green-900">{stats.tasks_completed_this_year}</p>
                        <p className="text-xs text-green-600">completed</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-purple-600" />
                            <span className="text-sm text-purple-700">Equipment</span>
                        </div>
                        <p className="text-lg font-bold text-purple-900">{stats.equipment_hours_this_month}h</p>
                        <p className="text-xs text-purple-600">this month</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-orange-600" />
                            <span className="text-sm text-orange-700">Bookings</span>
                        </div>
                        <p className="text-lg font-bold text-orange-900">{stats.active_bookings}</p>
                        <p className="text-xs text-orange-600">active</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm text-yellow-700">Pending</span>
                        </div>
                        <p className="text-lg font-bold text-yellow-900">{pending_actions.length}</p>
                        <p className="text-xs text-yellow-600">actions</p>
                    </div>
                </div>
            </div>

            {/* Pending Actions - High Priority */}
            {pending_actions.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-5 h-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Pending Actions</h3>
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                            {pending_actions.length}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {pending_actions.map((action, index) => (
                            <div 
                                key={index}
                                className={`border rounded-lg p-4 ${getUrgencyColor(action.urgency)}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium">{action.title}</h4>
                                            {action.urgency === 'high' && <AlertTriangle className="w-4 h-4" />}
                                        </div>
                                        <p className="text-sm mb-2">{action.description}</p>
                                        {action.due_date && (
                                            <p className="text-xs">
                                                Due: {formatDate(action.due_date)}
                                                {action.days_remaining !== undefined && (
                                                    <span className="ml-2">
                                                        ({action.days_remaining} days remaining)
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => onNavigateToAction?.(action.action_url)}
                                        className="flex items-center gap-1 px-3 py-1 bg-white bg-opacity-60 rounded text-sm font-medium hover:bg-opacity-80"
                                    >
                                        Take Action
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Events */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Today's Schedule</h3>
                    </div>
                    {today_events.length === 0 ? (
                        <div className="text-center py-8">
                            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">No events scheduled for today</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {today_events.map((event) => (
                                <div 
                                    key={event.id}
                                    className={`border rounded-lg p-3 ${event.is_mine ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {getEventTypeIcon(event.event_type)}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-gray-900">{event.title}</h4>
                                                {event.is_mine && (
                                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                        Mine
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                                    </span>
                                                </div>
                                                {event.equipment_name && (
                                                    <div className="flex items-center gap-1">
                                                        <Monitor className="w-3 h-3" />
                                                        <span>{event.equipment_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {event.description && (
                                                <p className="text-sm text-gray-600">{event.description}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Tasks */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <ClipboardList className="w-5 h-5 text-green-600" />
                        <h3 className="text-lg font-semibold text-gray-900">My Tasks</h3>
                    </div>
                    {my_tasks.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">No active tasks assigned</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {my_tasks.map((task) => (
                                <div 
                                    key={task.id}
                                    className={`border rounded-lg p-3 ${task.is_overdue ? 'bg-red-50 border-red-200' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-gray-900">{task.template_name}</h4>
                                                <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                                {task.is_primary && (
                                                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                                                        Primary
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                                                <span>Due: {formatDate(task.execution_end_date)}</span>
                                                {task.estimated_hours && (
                                                    <span>~{task.estimated_hours}h</span>
                                                )}
                                            </div>
                                            {task.is_overdue && (
                                                <p className="text-sm text-red-600 font-medium">Overdue!</p>
                                            )}
                                        </div>
                                        {task.can_complete && (
                                            <button
                                                onClick={() => onCompleteTask?.(task.id)}
                                                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                                Complete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Meetings */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Upcoming Meetings</h3>
                    </div>
                    {upcoming_meetings.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">No upcoming meetings</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {upcoming_meetings.map((meeting) => (
                                <div 
                                    key={meeting.id}
                                    className={`border rounded-lg p-3 ${meeting.is_presenter ? 'bg-purple-50 border-purple-200' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-gray-900 capitalize">
                                                    {meeting.meeting_type.replace('_', ' ')}
                                                </h4>
                                                {meeting.is_presenter && (
                                                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                                                        Presenter
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-1">
                                                {formatDate(meeting.date)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Presenters: {meeting.presenter_names.join(', ')}
                                            </p>
                                            {meeting.materials_required && meeting.is_presenter && (
                                                <div className="mt-2">
                                                    {meeting.materials_submitted ? (
                                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Materials submitted
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-orange-600 flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Materials required
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Equipment Bookings */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Monitor className="w-5 h-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-gray-900">My Equipment Bookings</h3>
                    </div>
                    {equipment_bookings.length === 0 ? (
                        <div className="text-center py-8">
                            <Monitor className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">No active bookings</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {equipment_bookings.map((booking) => (
                                <div 
                                    key={booking.id}
                                    className={`border rounded-lg p-3 ${booking.is_today ? 'bg-orange-50 border-orange-200' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-gray-900">{booking.equipment_name}</h4>
                                                {booking.is_today && (
                                                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                                                        Today
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    <span>{booking.equipment_location}</span>
                                                </div>
                                            </div>
                                            {booking.time_until !== null && booking.time_until > 0 && (
                                                <p className="text-xs text-blue-600">
                                                    Starts in {booking.time_until.toFixed(1)} hours
                                                </p>
                                            )}
                                            {booking.requires_qr_checkin && (
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Monitor className="w-3 h-3" />
                                                    QR check-in required
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Last Updated */}
            <div className="text-center text-sm text-gray-500">
                Last updated: {new Date(dashboardData.last_updated).toLocaleString()}
            </div>
        </div>
    );
};

export default UnifiedScheduleDashboard;