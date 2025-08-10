import React, { useState, useEffect, useContext } from 'react';
import {
    Calendar, Clock, Users, AlertTriangle, CheckCircle, 
    Play, Pause, RefreshCw, Bell, ArrowRight, BookOpen,
    ClipboardList, Monitor, MapPin, Timer, TrendingUp, X, Plus
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { buildApiUrl } from '../config/api.ts';
import { groupMeetingApi, type OneTimeTask } from '../services/groupMeetingApi.ts';
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
    // Phase 1 enhancements - new action props
    onEditEvent?: (schedule: Schedule) => void;
    onDeleteEvent?: (scheduleId: number) => void;
    onUploadMeetingMaterials?: (meetingId: number) => void;
    onViewTaskDetails?: (taskId: number) => void;
    onRequestTaskSwap?: (taskId: number) => void;
    onCancelBooking?: (bookingId: number) => void;
    onBookNewEquipment?: () => void;
}

const UnifiedScheduleDashboard: React.FC<UnifiedScheduleDashboardProps> = ({
    onQuickBookEquipment,
    onCompleteTask,
    onNavigateToAction,
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
        throw new Error('UnifiedScheduleDashboard must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [availableOneTimeTasks, setAvailableOneTimeTasks] = useState<OneTimeTask[]>([]);
    const [claimingTaskId, setClaimingTaskId] = useState<number | null>(null);

    const fetchDashboardData = async () => {
        const tryFetch = async (endpoint: string) => {
            const res = await fetch(buildApiUrl(endpoint), {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) return { ok: false as const, data: null, statusText: res.statusText, res };
            const contentType = res.headers.get('content-type') || '';
            const parsed = contentType.includes('application/json') ? await res.json() : await res.text();
            if (typeof parsed === 'string') {
                try { return { ok: true as const, data: JSON.parse(parsed) }; } catch {
                    return { ok: false as const, data: null, statusText: 'Invalid JSON response', res };
                }
            }
            return { ok: true as const, data: parsed };
        };
        try {
            // Prefer API endpoint (better CORS), fallback to compatibility endpoint
            let result = await tryFetch('api/schedule/unified-dashboard/overview/');
            if (!result.ok) {
                result = await tryFetch('schedule/unified-dashboard/overview/');
            }
            if (!result.ok || !result.data) {
                throw new Error(`Failed to fetch dashboard data: ${result.statusText || 'Unknown error'}`);
            }
            setDashboardData(result.data as DashboardData);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard');
            console.error('Dashboard data fetch error:', err);
        }
    };

    const fetchAvailableOneTimeTasks = async () => {
        try {
            const tasks = await groupMeetingApi.getOneTimeTasks(token);
            // Only tasks that are unclaimed and available
            const filtered = (tasks || []).filter(t => (t.status === 'scheduled' || t.status === 'pending') && (t.current_assignees?.length || 0) === 0);
            setAvailableOneTimeTasks(filtered);
        } catch (e) {
            // Non-fatal for dashboard
            console.warn('Failed to fetch one-time tasks:', e);
        }
    };

    const handleClaimOneTime = async (taskId: number) => {
        try {
            setClaimingTaskId(taskId);
            await groupMeetingApi.claimOneTimeTask(token, taskId);
            await Promise.all([fetchDashboardData(), fetchAvailableOneTimeTasks()]);
            onRefresh?.();
        } catch (e) {
            console.error('Claim one-time task failed:', e);
            alert(e instanceof Error ? e.message : 'Failed to claim task');
        } finally {
            setClaimingTaskId(null);
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
            await Promise.all([
                fetchDashboardData(),
                fetchAvailableOneTimeTasks()
            ]);
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
            fetchAvailableOneTimeTasks();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [token]);

    const formatTime = (timeString: string) => {
        // Support ISO datetime or plain HH:MM(:SS)
        const isClockOnly = /^\d{2}:\d{2}(:\d{2})?$/.test(timeString);
        const d = isClockOnly ? new Date(`1970-01-01T${timeString}`) : new Date(timeString);
        if (Number.isNaN(d.getTime())) return timeString;
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

    // Helper function to convert TodayEvent to Schedule format for modal
    const convertEventToSchedule = (event: TodayEvent): Schedule & { is_mine?: boolean } => {
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
            updated_at: new Date().toISOString(),
            is_mine: event.is_mine // Preserve ownership information
        } as Schedule & { is_mine?: boolean };
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
            <div className="card">
                <div className="card-body p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Laboratory Schedule Dashboard</h2>
                        <p className="text-gray-600">Your unified view of all schedule activities</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="btn btn-primary btn-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="card p-3 bg-blue-50">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700">Presentations</span>
                        </div>
                        <p className="text-lg font-bold text-blue-900">{stats.presentations_total}</p>
                        <p className="text-xs text-blue-600">total</p>
                    </div>
                    <div className="card p-3 bg-green-50">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700">Tasks</span>
                        </div>
                        <p className="text-lg font-bold text-green-900">{stats.tasks_completed_this_year}</p>
                        <p className="text-xs text-green-600">completed</p>
                    </div>
                    <div className="card p-3 bg-purple-50">
                        <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-purple-600" />
                            <span className="text-sm text-purple-700">Equipment</span>
                        </div>
                        <p className="text-lg font-bold text-purple-900">{stats.equipment_hours_this_month}h</p>
                        <p className="text-xs text-purple-600">this month</p>
                    </div>
                    <div className="card p-3 bg-orange-50">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-orange-600" />
                            <span className="text-sm text-orange-700">Bookings</span>
                        </div>
                        <p className="text-lg font-bold text-orange-900">{stats.active_bookings}</p>
                        <p className="text-xs text-orange-600">active</p>
                    </div>
                    <div className="card p-3 bg-yellow-50">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm text-yellow-700">Pending</span>
                        </div>
                        <p className="text-lg font-bold text-yellow-900">{pending_actions.length}</p>
                        <p className="text-xs text-yellow-600">actions</p>
                    </div>
                </div>
                </div>
            </div>

            {/* Focus Section - Intelligent Prioritization */}
            {(() => {
                const now = new Date();
                const nextEvent = today_events
                    .filter(event => {
                        const eventTime = new Date(`${now.toDateString()} ${event.start_time}`);
                        return eventTime > now && (eventTime.getTime() - now.getTime()) <= 30 * 60 * 1000; // Next 30 minutes
                    })
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
                
                const overdueTasks = my_tasks.filter(task => task.is_overdue);
                const highPriorityActions = pending_actions.filter(action => action.urgency === 'high');
                
                const focusItems = [];
                if (nextEvent) focusItems.push({ type: 'event', data: nextEvent });
                if (overdueTasks.length > 0) focusItems.push({ type: 'overdue', data: overdueTasks[0] });
                if (highPriorityActions.length > 0) focusItems.push({ type: 'action', data: highPriorityActions[0] });
                
                return focusItems.length > 0 ? (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Focus Now</h3>
                                <p className="text-sm text-gray-600">Your most important items right now</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {focusItems.map((item, index) => {
                                if (item.type === 'event') {
                                    const event = item.data as TodayEvent;
                                    return (
                                        <div key={`event-${index}`} className="bg-white rounded-lg p-4 border border-blue-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-red-100 rounded-lg">
                                                        <Clock className="w-4 h-4 text-red-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                                                        <p className="text-sm text-red-600 font-medium">Starting soon - {formatTime(event.start_time)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleEventClick(event)}
                                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    );
                                } else if (item.type === 'overdue') {
                                    const task = item.data as MyTask;
                                    return (
                                        <div key={`task-${index}`} className="bg-white rounded-lg p-4 border border-red-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-red-100 rounded-lg">
                                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-gray-900">{task.template_name}</h4>
                                                        <p className="text-sm text-red-600 font-medium">Overdue - Due {formatDate(task.execution_end_date)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {task.can_complete && (
                                                        <button
                                                            onClick={() => onCompleteTask?.(task.id)}
                                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                                        >
                                                            Complete
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => onViewTaskDetails?.(task.id)}
                                                        className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else if (item.type === 'action') {
                                    const action = item.data as PendingAction;
                                    return (
                                        <div key={`action-${index}`} className="bg-white rounded-lg p-4 border border-orange-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-orange-100 rounded-lg">
                                                        <Bell className="w-4 h-4 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-gray-900">{action.title}</h4>
                                                        <p className="text-sm text-orange-600 font-medium">High priority action required</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onNavigateToAction?.(action.action_url)}
                                                    className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                                                >
                                                    Take Action
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                ) : null;
            })()}

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
                    <div className="card">
                        <div className="card-body p-6">
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
                            {today_events
                              .filter((e) => (e.status ? e.status !== 'cancelled' : true))
                              .map((event) => (
                                <div 
                                    key={event.id}
                                    onClick={() => handleEventClick(event)}
                                    className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
                                        event.is_mine ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : 'border-gray-200 hover:bg-gray-50'
                                    }`}
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
                    </div>

                {/* My Tasks */}
                    <div className="card">
                        <div className="card-body p-6">
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
                                    onClick={() => onViewTaskDetails?.(task.id)}
                                    className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
                                        task.is_overdue ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'border-gray-200 hover:bg-gray-50'
                                    }`}
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
                                        <div className="flex items-center gap-2">
                                            {task.can_complete && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCompleteTask?.(task.id);
                                                    }}
                                                        className="btn btn-success btn-xs"
                                                >
                                                    <CheckCircle className="w-3 h-3" />
                                                    Complete
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRequestTaskSwap?.(task.id);
                                                }}
                                                    className="btn btn-outline btn-xs"
                                            >
                                                <ArrowRight className="w-3 h-3" />
                                                Swap
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                        </div>
                    </div>
            </div>

            {/* Available One-Time Tasks (Claim) */}
            {availableOneTimeTasks.length > 0 && (
                <div className="card">
                    <div className="card-body p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ClipboardList className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Available One-Time Tasks</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {availableOneTimeTasks.map((t) => (
                                <div key={t.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                    <div className="flex items-start justify-between mb-2">
                                        <h4 className="font-medium text-gray-900 truncate">{t.template_name}</h4>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{t.status}</span>
                                    </div>
                                    <div className="text-xs text-gray-600 mb-3">Due: {new Date(t.execution_end_date).toLocaleDateString()}</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Assignee: {(t.current_assignees?.length || 0) > 0 ? 'Taken' : 'Unclaimed'}</span>
                                        <button
                                            onClick={() => handleClaimOneTime(t.id)}
                                            disabled={(t.current_assignees?.length || 0) > 0 || claimingTaskId === t.id}
                                            className="btn btn-primary btn-xs disabled:opacity-50"
                                        >
                                            {claimingTaskId === t.id ? 'Claiming...' : 'Claim'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Meetings */}
                <div className="card">
                    <div className="card-body p-6">
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
                                        <div className="flex flex-col gap-2">
                                            {meeting.materials_required && meeting.is_presenter && !meeting.materials_submitted && (
                                                <button
                                                    onClick={() => onUploadMeetingMaterials?.(meeting.id)}
                                                    className="btn btn-outline btn-xs"
                                                >
                                                    <BookOpen className="w-3 h-3" />
                                                    Upload Materials
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    </div>
                </div>

                {/* Equipment Bookings */}
                <div className="card">
                    <div className="card-body p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Monitor className="w-5 h-5 text-orange-600" />
                            <h3 className="text-lg font-semibold text-gray-900">My Equipment Bookings</h3>
                        </div>
                        <button
                            onClick={() => onBookNewEquipment?.()}
                            className="btn btn-outline btn-xs"
                        >
                            <Plus className="w-3 h-3" />
                            Book Equipment
                        </button>
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
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => onCancelBooking?.(booking.id)}
                                                className="btn btn-danger btn-xs"
                                            >
                                                <X className="w-3 h-3" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Last Updated */}
            <div className="text-center text-sm text-gray-500">
                Last updated: {new Date(dashboardData.last_updated).toLocaleString()}
            </div>

            {/* Schedule Detail Modal */}
            <ScheduleDetailModal
                isOpen={showDetailModal}
                onClose={handleCloseModal}
                schedule={selectedEvent}
                canEdit={Boolean((selectedEvent as any)?.is_mine)}
                canDelete={Boolean((selectedEvent as any)?.is_mine)}
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

export default UnifiedScheduleDashboard;