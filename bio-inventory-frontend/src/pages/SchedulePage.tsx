import React, { useState, useEffect, useContext, useCallback } from 'react';
import '../styles/mobile-schedule.css';
import { 
    Calendar, Clock, Users, MapPin, Plus, Edit3, Trash2, Search, 
    Settings, CheckCircle, User, Monitor,
    CalendarDays, BookOpen, Repeat, Eye, EyeOff, X
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { 
    scheduleApi, equipmentApi, Schedule, Equipment, ScheduleParams, 
    ScheduleFormData, scheduleHelpers 
} from '../services/scheduleApi.ts';
import { groupMeetingApi } from '../services/groupMeetingApi.ts';
import { buildApiUrl } from '../config/api.ts';
import ScheduleFormModal from '../modals/ScheduleFormModal.tsx';
import GroupMeetingFormModal from '../modals/GroupMeetingFormModal.tsx';
import RecurringTaskFormModal from '../modals/RecurringTaskFormModal.tsx';
import CalendarView from '../components/CalendarView.tsx';
import ModernCalendarView from '../components/ModernCalendarView.tsx';
import MobileScheduleDashboard from '../components/MobileScheduleDashboard.tsx';
import EquipmentManagement from '../components/EquipmentManagement.tsx';
import GroupMeetingsManager from '../components/GroupMeetingsManager.tsx';
import JournalClubHub from '../components/JournalClubHub.tsx';
import ImprovedTaskManager from '../components/ImprovedTaskManager.tsx';
import MeetingEditModal from '../modals/MeetingEditModal.tsx';
import UnifiedScheduleDashboard from '../components/UnifiedScheduleDashboard.tsx';
import EnhancedQuickActions from '../components/EnhancedQuickActions.tsx';
import MyScheduleView from '../components/MyScheduleView.tsx';
import QuickTourModal from '../components/QuickTourModal.tsx';
import SmartWelcomeBanner from '../components/SmartWelcomeBanner.tsx';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal.tsx';
import { getCurrentDateET } from '../utils/timezone.ts';
import TaskSwapRequestModal, { TaskSwapFormData } from '../modals/TaskSwapRequestModal.tsx';

type TabType = 'dashboard' | 'calendar' | 'equipment' | 'meetings' | 'tasks' | 'my-schedule';

const SchedulePage: React.FC = () => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('SchedulePage must be used within an AuthProvider');
    }
    const { token, user } = authContext;
    
    // Check if user is admin
    const isAdmin = user?.is_staff || false;

    // Mobile detection and UX state
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [useModernUI, setUseModernUI] = useState(true);
    const [showQuickTour, setShowQuickTour] = useState(false);
    const [contextualHelp, setContextualHelp] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        const handleKeyboardShortcuts = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        setActiveTab('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        setActiveTab('calendar');
                        break;
                    case '3':
                        e.preventDefault();
                        setActiveTab('equipment');
                        break;
                    case 'n':
                        e.preventDefault();
                        handleOpenModal();
                        break;
                    case '?':
                        e.preventDefault();
                        setShowKeyboardShortcuts(true);
                        break;
                }
            }
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyboardShortcuts);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyboardShortcuts);
        };
    }, []);

    // Core state
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Calendar state
    const [selectedDate, setSelectedDate] = useState(getCurrentDateET());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showMyScheduleOnly, setShowMyScheduleOnly] = useState(false);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGroupMeetingModalOpen, setIsGroupMeetingModalOpen] = useState(false);
    const [isRecurringTaskModalOpen, setIsRecurringTaskModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMeetingEditModalOpen, setIsMeetingEditModalOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
    const [selectedEventForDetails, setSelectedEventForDetails] = useState<Schedule | null>(null);
    const [isJournalClubHubOpen, setIsJournalClubHubOpen] = useState(false);
    const [journalClubMeetingId, setJournalClubMeetingId] = useState<string | null>(null);
    
    // Edit/Delete schedule state
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Enhanced UX state
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [lastAction, setLastAction] = useState<{ type: string; message: string; timestamp: number } | null>(null);
    
    // Task Swap Modal state
    const [swapModalOpen, setSwapModalOpen] = useState(false);
    const [swapSubmitting, setSwapSubmitting] = useState(false);
    const [swapTaskId, setSwapTaskId] = useState<number | null>(null);
    const [swapTaskTitle, setSwapTaskTitle] = useState<string | undefined>(undefined);
    const [users, setUsers] = useState<any[]>([]);

    // Fetch functions
    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(true);
            const params: ScheduleParams = {
                date: selectedDate,
                view: viewMode
            };
            const data = await scheduleApi.getSchedules(token, params);
            setSchedules(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error occurred');
            console.error('Error fetching schedules:', err);
        } finally {
            setLoading(false);
        }
    }, [token, selectedDate, viewMode]);

    const fetchEquipment = useCallback(async () => {
        try {
            const data = await equipmentApi.getEquipment(token);
            setEquipment(data);
            // Filter available equipment for quick actions
            setAvailableEquipment(data.filter(eq => eq.is_bookable && !eq.is_in_use));
        } catch (err) {
            console.error('Error fetching equipment:', err);
        }
    }, [token]);

    const fetchUsers = useCallback(async () => {
        try {
            const users = await groupMeetingApi.getActiveUsers(token);
            setUsers(users || []);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }, [token]);

    const initializeData = useCallback(async () => {
        setLoading(true);
        try {
            // Check if we have any schedules, if not initialize defaults
            const existingSchedules = await scheduleApi.getSchedules(token);
            if (existingSchedules.length === 0) {
                console.info('No existing schedules found, initializing defaults');
                const defaultSchedules = await scheduleApi.initializeDefaultSchedules(token);
                setSchedules(defaultSchedules);
            } else {
                setSchedules(existingSchedules);
            }
            
            // Check if we have any equipment, if not initialize defaults  
            const existingEquipment = await equipmentApi.getEquipment(token);
            if (existingEquipment.length === 0) {
                console.info('No existing equipment found, initializing defaults');
                const defaultEquipment = await equipmentApi.initializeDefaultEquipment(token);
                setEquipment(defaultEquipment);
            } else {
                setEquipment(existingEquipment);
            }
        } catch (error) {
            console.error('Error initializing data:', error);
            // Fallback to regular fetch
            await Promise.all([
                fetchSchedules(),
                fetchEquipment()
            ]);
        } finally {
            setLoading(false);
        }
    }, [token, fetchSchedules, fetchEquipment]);

    const handleCancelBooking = useCallback(async (bookingId: number) => {
        if (!token) return;
        try {
            await equipmentApi.cancelBooking(token, bookingId);
            await Promise.all([fetchSchedules(), fetchEquipment()]);
            setLastAction({ type: 'Booking Cancelled', message: 'Equipment booking cancelled', timestamp: Date.now() });
            setTimeout(() => setLastAction(null), 3000);
        } catch (error) {
            console.error('Failed to cancel booking:', error);
            alert(error instanceof Error ? error.message : 'Failed to cancel booking');
        }
    }, [token, fetchSchedules, fetchEquipment]);

    // Lightweight approval modals state
    const [pendingTaskSwapId, setPendingTaskSwapId] = useState<number | null>(null);
    const [pendingTaskSwap, setPendingTaskSwap] = useState<any>(null);
    const [taskSwapLoading, setTaskSwapLoading] = useState(false);
    const [taskSwapReason, setTaskSwapReason] = useState('');

    const [pendingMeetingSwapId, setPendingMeetingSwapId] = useState<number | null>(null);
    const [pendingMeetingSwap, setPendingMeetingSwap] = useState<any>(null);
    const [meetingSwapLoading, setMeetingSwapLoading] = useState(false);
    const [meetingSwapReason, setMeetingSwapReason] = useState('');

    // Fetch details when a swap modal opens
    useEffect(() => {
        const run = async () => {
            if (!token) return;
            if (pendingTaskSwapId !== null) {
                setTaskSwapLoading(true);
                try {
                    const res = await fetch(buildApiUrl(`api/schedule/task-swap-requests/${pendingTaskSwapId}/`), {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    if (res.ok) setPendingTaskSwap(await res.json());
                } finally {
                    setTaskSwapLoading(false);
                }
            }
        };
        run();
    }, [pendingTaskSwapId, token]);

    useEffect(() => {
        const run = async () => {
            if (!token) return;
            if (pendingMeetingSwapId !== null) {
                setMeetingSwapLoading(true);
                try {
                    const res = await fetch(buildApiUrl(`api/schedule/swap-requests/${pendingMeetingSwapId}/`), {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    if (res.ok) setPendingMeetingSwap(await res.json());
                } finally {
                    setMeetingSwapLoading(false);
                }
            }
        };
        run();
    }, [pendingMeetingSwapId, token]);

    const handleNavigateToAction = useCallback((actionUrl: string) => {
        // 1) Journal Club 提交
        const jc = actionUrl.match(/\/schedule\/meetings\/(\d+)\/paper-submission\//);
        if (jc) {
            setJournalClubMeetingId(jc[1]);
            setIsJournalClubHubOpen(true);
            return;
        }
        // 2) 任务交换审批（管理员）
        const taskSwap = actionUrl.match(/\/schedule\/task-swap-requests\/(\d+)\/?$/);
        if (taskSwap) {
            setActiveTab('tasks');
            setPendingTaskSwapId(Number(taskSwap[1]));
            return;
        }
        // 3) 组会顺序交换审批（目标用户）
        const meetingSwap = actionUrl.match(/\/schedule\/swap-requests\/(\d+)\/?$/);
        if (meetingSwap) {
            setActiveTab('meetings');
            setPendingMeetingSwapId(Number(meetingSwap[1]));
            return;
        }
        // 默认：回到会议页
        setActiveTab('meetings');
    }, []);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        await Promise.all([
            fetchSchedules(),
            fetchEquipment(),
            fetchUsers()
        ]);
        setLoading(false);
    }, [fetchSchedules, fetchEquipment, fetchUsers]);

    // Initialize data on mount
    useEffect(() => {
        if (token) {
            initializeData();
        }
    }, [token, initializeData]);

    useEffect(() => {
        if (token && activeTab === 'dashboard') {
            fetchAllData();
        } else if (token && activeTab === 'calendar') {
            fetchSchedules();
        } else if (token && activeTab === 'equipment') {
            fetchEquipment();
        }
    }, [token, activeTab, fetchSchedules, fetchEquipment, fetchAllData]);

    // Equipment handlers

    const handleEditEquipment = async (equipment: Equipment) => {
        const newName = prompt('Enter new equipment name:', equipment.name);
        if (!newName || newName === equipment.name) return;
        
        try {
            const updatedEquipment = await equipmentApi.updateEquipment(token, equipment.id, {
                name: newName
            });
            console.log('Equipment updated:', updatedEquipment);
            
            // Refresh equipment data
            await fetchEquipment();
            
            // Show success message
            alert(`Equipment renamed to: ${newName}`);
        } catch (error) {
            console.error('Failed to update equipment:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Failed to update equipment: ${errorMessage}`);
        }
    };

    // Modal and action handlers
    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };


    const handleSubmitSchedule = async (scheduleData: ScheduleFormData) => {
        setIsSubmitting(true);
        try {
            // Create the schedule via API
            const newSchedule = await scheduleApi.createSchedule(token, scheduleData);
            // Add to local state
            setSchedules(prev => [newSchedule, ...prev]);
            // Refresh the schedule list
            await fetchSchedules();
            
            // Show success feedback
            setLastAction({
                type: 'Event Created',
                message: `Successfully created "${scheduleData.title}"`,
                timestamp: Date.now()
            });
            setTimeout(() => setLastAction(null), 3000);
        } catch (error) {
            console.error('Error creating schedule:', error);
            // Re-throw error to show user feedback
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSchedule = async (scheduleData: ScheduleFormData) => {
        if (!editingSchedule) return;
        
        setIsSubmitting(true);
        try {
            // Update the schedule via API
            const updatedSchedule = await scheduleApi.updateSchedule(token, editingSchedule.id, scheduleData);
            // Update local state
            setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? updatedSchedule : s));
            // Refresh the schedule list
            await fetchSchedules();
            
            // Close edit modal
            setIsEditModalOpen(false);
            setEditingSchedule(null);
            
            // Show success feedback
            setLastAction({
                type: 'Event Updated',
                message: `Successfully updated "${scheduleData.title}"`,
                timestamp: Date.now()
            });
            setTimeout(() => setLastAction(null), 3000);
        } catch (error) {
            console.error('Error updating schedule:', error);
            // Re-throw error to show user feedback
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingSchedule(null);
    };

    // Task Swap Modal handlers
    const handleOpenSwapModal = (taskId: number, taskTitle?: string) => {
        setSwapTaskId(taskId);
        setSwapTaskTitle(taskTitle);
        setSwapModalOpen(true);
    };

    const handleCloseSwapModal = () => {
        setSwapModalOpen(false);
        setSwapTaskId(null);
        setSwapTaskTitle(undefined);
    };

    const handleSubmitSwap = async ({ taskId, toUserId, reason }: TaskSwapFormData) => {
        if (!token || !user) return;
        setSwapSubmitting(true);
        try {
            const response = await fetch(buildApiUrl('api/schedule/task-swap-requests/'), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task_instance_id: taskId,
                    request_type: 'swap',
                    to_user_id: toUserId,
                    reason
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.detail || response.statusText);
            }
            
            handleCloseSwapModal();
            setLastAction({
                type: 'Task Swap Request',
                message: 'Swap request submitted successfully',
                timestamp: Date.now()
            });
            setTimeout(() => setLastAction(null), 3000);
            
        } catch (error) {
            console.error('Error submitting swap request:', error);
            setLastAction({
                type: 'Error',
                message: `Failed to submit swap request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now()
            });
            setTimeout(() => setLastAction(null), 5000);
        } finally {
            setSwapSubmitting(false);
        }
    };

    // Filter data - exclude cancelled events by default unless specifically requested
    const filteredSchedules = schedules.filter(schedule => {
        const matchesSearch = schedule.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             schedule.description?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Handle different filter options
        const matchesStatus = filterStatus === 'all' 
            ? schedule.status !== 'cancelled'  // Show all except cancelled
            : filterStatus === 'everything'
            ? true  // Show everything including cancelled
            : schedule.status === filterStatus;  // Show specific status
            
        return matchesSearch && matchesStatus;
    });

    const filteredEquipment = equipment.filter(eq => {
        return eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               eq.location?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Format time
    const formatTime = (timeString: string | undefined): string => {
        if (!timeString) return '';
        return scheduleHelpers.formatScheduleTime(timeString, null);
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            
            {/* Keyboard Shortcuts Modal */}
            <KeyboardShortcutsModal 
                isOpen={showKeyboardShortcuts}
                onClose={() => setShowKeyboardShortcuts(false)}
            />
            
            {/* Action Feedback Toast */}
            {lastAction && (
                <div className="fixed top-4 right-4 z-50 max-w-sm">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 transform transition-all duration-300 animate-in slide-in-from-right">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{lastAction.type}</p>
                                <p className="text-sm text-gray-600">{lastAction.message}</p>
                            </div>
                            <button
                                onClick={() => setLastAction(null)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        );
    }

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: CalendarDays, description: 'Overview of all activities' },
        { id: 'calendar', label: 'Calendar View', icon: Calendar, description: 'Detailed calendar view' },
        { id: 'equipment', label: 'Equipment', icon: Monitor, description: 'Book and manage lab equipment' },
        { id: 'meetings', label: 'Group Meetings', icon: Users, description: 'Team meetings and presentations' },
        { id: 'tasks', label: 'Recurring Tasks', icon: Repeat, description: 'Lab maintenance and tasks' },
        { id: 'my-schedule', label: 'My Schedule', icon: User, description: 'Personal schedule view' }
    ] as const;

    const getTabActions = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="flex gap-2">
                        <button 
                            onClick={handleOpenModal}
                            className="btn btn-primary btn-sm"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Event
                        </button>
                    </div>
                );
            case 'calendar':
                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowMyScheduleOnly(!showMyScheduleOnly)}
                            className={`btn btn-sm ${showMyScheduleOnly ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {showMyScheduleOnly ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                            {showMyScheduleOnly ? 'Show All' : 'My Schedule'}
                        </button>
                        <button 
                            onClick={handleOpenModal}
                            className="btn btn-primary btn-sm"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Event
                        </button>
                    </div>
                );
            case 'equipment':
                return null;
            case 'meetings':
                return isAdmin ? (
                    <button 
                        onClick={() => setIsGroupMeetingModalOpen(true)}
                        className="btn btn-primary btn-sm"
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Meeting Configuration
                    </button>
                ) : null;
            case 'tasks':
                return isAdmin ? (
                    <button 
                        onClick={() => setIsRecurringTaskModalOpen(true)}
                        className="btn btn-success btn-sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Task
                    </button>
                ) : null;
            default:
                return null;
        }
    };

    // Mobile-first rendering with enhanced UX
    if (isMobile) {
        return (
            <div className="relative">
                <MobileScheduleDashboard 
                    availableEquipment={availableEquipment}
                    onQuickBookEquipment={(equipmentId) => {
                        console.log('Quick book equipment:', equipmentId);
                        fetchAllData();
                        setLastAction({
                            type: 'Quick Book',
                            message: 'Equipment booking initiated',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                    onCompleteTask={(taskId) => {
                        console.log('Complete task:', taskId);
                        fetchAllData();
                        setLastAction({
                            type: 'Task Complete',
                            message: 'Task marked as completed',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                    onNavigateToAction={handleNavigateToAction}
                    onNavigateToTab={(tab) => {
                        setActiveTab(tab as TabType);
                    }}
                    onRefresh={fetchAllData}
                    // Phase 1 enhancement handlers for mobile
                    onEditEvent={(schedule) => {
                        console.log('Edit event (mobile):', schedule);
                        setLastAction({
                            type: 'Edit Event',
                            message: 'Opening event editor',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                    onDeleteEvent={(scheduleId) => {
                        console.log('Delete event (mobile):', scheduleId);
                        fetchAllData();
                        setLastAction({
                            type: 'Event Deleted',
                            message: 'Event has been deleted',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 3000);
                    }}
                    onUploadMeetingMaterials={(meetingId) => {
                        console.log('Upload materials for meeting (mobile):', meetingId);
                        setLastAction({
                            type: 'Upload Materials',
                            message: 'Opening material upload dialog',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                    onViewTaskDetails={(taskId) => {
                        console.log('View task details (mobile):', taskId);
                        setLastAction({
                            type: 'View Details',
                            message: 'Opening task details',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                    onRequestTaskSwap={(taskId) => {
                        console.log('Request task swap (mobile):', taskId);
                        setLastAction({
                            type: 'Task Swap',
                            message: 'Swap request initiated',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                    onCancelBooking={(bookingId) => {
                        console.log('Cancel booking (mobile):', bookingId);
                        fetchAllData();
                        setLastAction({
                            type: 'Booking Cancelled',
                            message: 'Equipment booking cancelled',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 3000);
                    }}
                    onBookNewEquipment={() => {
                        console.log('Book new equipment (mobile)');
                        setLastAction({
                            type: 'Book Equipment',
                            message: 'Opening equipment booking',
                            timestamp: Date.now()
                        });
                        setTimeout(() => setLastAction(null), 2000);
                    }}
                />
                
                {/* Mobile Toast Notifications */}
                {lastAction && (
                    <div className="fixed bottom-4 left-4 right-4 z-50">
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 transform transition-all duration-300 animate-in slide-in-from-bottom">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{lastAction.type}</p>
                                    <p className="text-xs text-gray-600">{lastAction.message}</p>
                                </div>
                                <button
                                    onClick={() => setLastAction(null)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            {/* Quick Tour Modal */}
            {showQuickTour && (
                <QuickTourModal 
                    onClose={() => setShowQuickTour(false)}
                    activeTab={activeTab}
                    onNavigateToTab={setActiveTab}
                />
            )}
            
            {/* Floating Quick Actions - Mobile Only */}
            {!isMobile && (
                <div className="fixed bottom-6 right-6 z-40">
                    <div className="relative">
                        {/* Main FAB */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-primary-600 hover:bg-primary-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 group"
                            title="Quick add event"
                        >
                            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
                        </button>
                        
                        {/* Quick actions mini menu */}
                        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => setActiveTab('equipment')}
                                    className="flex items-center gap-2 p-2 text-sm text-gray-700 hover:bg-gray-50 rounded whitespace-nowrap"
                                >
                                    <Monitor className="w-4 h-4" />
                                    Book Equipment
                                </button>
                                <button
                                    onClick={() => setActiveTab('meetings')}
                                    className="flex items-center gap-2 p-2 text-sm text-gray-700 hover:bg-gray-50 rounded whitespace-nowrap"
                                >
                                    <Users className="w-4 h-4" />
                                    Schedule Meeting
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced Header with Breadcrumbs and Context */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-gray-900">Laboratory Schedule Management</h1>
                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <button
                                    onClick={() => setUseModernUI(!useModernUI)}
                                    className="btn btn-ghost btn-xs"
                                    title={useModernUI ? 'Switch to classic view' : 'Switch to modern view'}
                                >
                                    {useModernUI ? 'Classic UI' : 'Modern UI'}
                                </button>
                            )}
                            <button
                                onClick={() => setShowQuickTour(true)}
                                className="btn btn-ghost btn-xs"
                                title="Take a quick tour"
                            >
                                <Users className="w-3 h-3" />
                                Tour
                            </button>
                            <button
                                onClick={() => setShowKeyboardShortcuts(true)}
                                className="btn btn-ghost btn-xs"
                                title="Keyboard shortcuts (Ctrl + ?)"
                            >
                                ⌘
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-gray-600">Manage meetings, equipment bookings, recurring tasks, and personal schedules</p>
                    </div>
                </div>
                {getTabActions()}
            </div>

            {/* Enhanced Tab Navigation with Descriptions and Indicators */}
            <div className="card">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-1 px-6" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <div
                                    key={tab.id}
                                    className="relative"
                                >
                                    <button
                                        onClick={() => setActiveTab(tab.id as TabType)}
                                        className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                                        title={tab.description}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                        <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                                    </button>
                                    {/* Active indicator */}
                                    {isActive && (
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-2 h-2 bg-primary-500 rounded-full"></div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
                {/* Controls - shown for relevant tabs (dashboard has built-in controls) */}
                {(activeTab === 'calendar' || activeTab === 'my-schedule' || activeTab === 'equipment') && (
                    <div className="card card-body">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Date Picker - for calendar views */}
                            {(activeTab === 'calendar' || activeTab === 'my-schedule') && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-500" />
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="input text-sm"
                                        />
                                    </div>

                                    {/* View Mode */}
                                    <div className="flex gap-2">
                                        {(['day', 'week', 'month'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setViewMode(mode)}
                                                className={`btn btn-xs capitalize ${viewMode === mode ? 'btn-primary' : 'btn-ghost'}`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Search */}
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'equipment' ? 'Search equipment...' : 'Search events...'}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input w-full pl-10"
                                />
                            </div>

                            {/* Status Filter - for calendar views */}
                            {(activeTab === 'calendar' || activeTab === 'my-schedule') && (
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="select text-sm"
                                >
                                    <option value="all">All Active</option>
                                    <option value="everything">Everything (+ Cancelled)</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled Only</option>
                                </select>
                            )}
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                {/* Tab Content Views */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Smart Banner for New Users */}
                        <SmartWelcomeBanner 
                            onStartTour={() => setShowQuickTour(true)}
                            onDismiss={() => {/* Handle dismiss */}}
                        />
                        
                        <UnifiedScheduleDashboard 
                            onQuickBookEquipment={(equipmentId) => {
                                console.log('Quick book equipment:', equipmentId);
                                fetchAllData();
                            }}
                            onCompleteTask={async (taskId) => {
                                try {
                                    // 后端任务完成接口
                                    const res = await fetch(buildApiUrl(`api/schedule/periodic-tasks/${taskId}/complete/`), {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Token ${token}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({})
                                    });
                                    if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || err.detail || res.statusText);
                                    }
                                    await fetchAllData();
                                    setLastAction({
                                        type: 'Task Completed',
                                        message: 'Task marked as complete',
                                        timestamp: Date.now()
                                    });
                                    setTimeout(() => setLastAction(null), 3000);
                                } catch (e) {
                                    console.error('Complete task failed:', e);
                                    alert(e instanceof Error ? e.message : 'Failed to complete task');
                                }
                            }}
                            onNavigateToAction={handleNavigateToAction}
                            onRefresh={fetchAllData}
                            // Phase 1 enhancement handlers
                            onEditEvent={async (schedule) => {
                                try {
                                    setEditingSchedule(schedule);
                                    setIsEditModalOpen(true);
                                    setLastAction({
                                        type: 'Edit Event',
                                        message: 'Opening event editor',
                                        timestamp: Date.now()
                                    });
                                    setTimeout(() => setLastAction(null), 2000);
                                } catch (err) {
                                    console.error('Error opening edit modal:', err);
                                    setLastAction({
                                        type: 'Error',
                                        message: 'Failed to open editor',
                                        timestamp: Date.now()
                                    });
                                    setTimeout(() => setLastAction(null), 3000);
                                }
                            }}
                            onDeleteEvent={async (scheduleId) => {
                                try {
                                    if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
                                        await scheduleApi.deleteSchedule(token, scheduleId);
                                        await fetchAllData();
                                        setLastAction({
                                            type: 'Event Deleted',
                                            message: 'Event has been deleted',
                                            timestamp: Date.now()
                                        });
                                        setTimeout(() => setLastAction(null), 3000);
                                    }
                                } catch (err) {
                                    console.error('Error deleting schedule:', err);
                                    setLastAction({
                                        type: 'Error',
                                        message: 'Failed to delete event',
                                        timestamp: Date.now()
                                    });
                                    setTimeout(() => setLastAction(null), 3000);
                                }
                            }}
                            onUploadMeetingMaterials={(meetingId) => {
                                console.log('Upload materials for meeting:', meetingId);
                                setLastAction({
                                    type: 'Upload Materials',
                                    message: 'Opening material upload dialog',
                                    timestamp: Date.now()
                                });
                                setTimeout(() => setLastAction(null), 2000);
                            }}
                            onViewTaskDetails={(taskId) => {
                                console.log('View task details:', taskId);
                                setActiveTab('tasks');
                                setLastAction({
                                    type: 'View Details',
                                    message: 'Switching to task details',
                                    timestamp: Date.now()
                                });
                                setTimeout(() => setLastAction(null), 2000);
                            }}
                            onRequestTaskSwap={(taskId) => {
                                // Find the task to get its title
                                // Since we don't have easy access to the task data here, we'll pass a default title
                                handleOpenSwapModal(taskId, `Task ${taskId}`);
                            }}
                            onCancelBooking={handleCancelBooking}
                            onBookNewEquipment={() => {
                                console.log('Book new equipment');
                                setActiveTab('equipment');
                                setLastAction({
                                    type: 'Book Equipment',
                                    message: 'Opening equipment booking',
                                    timestamp: Date.now()
                                });
                                setTimeout(() => setLastAction(null), 2000);
                            }}
                        />
                        <EnhancedQuickActions 
                            availableEquipment={availableEquipment}
                            onEquipmentBooked={(booking) => {
                                console.log('Equipment booked:', booking);
                                fetchEquipment();
                            }}
                            onTaskCompleted={(taskId) => {
                                console.log('Task completed:', taskId);
                                fetchSchedules();
                            }}
                            onNavigateToTab={(tab) => {
                                setActiveTab(tab as TabType);
                            }}
                            onRefreshNeeded={fetchAllData}
                        />
                    </div>
                )}

                {activeTab === 'calendar' && (
                    useModernUI ? (
                        <ModernCalendarView 
                            schedules={filteredSchedules}
                            loading={loading}
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            onCreateEvent={(date?: string, time?: string) => {
                                if (date) setSelectedDate(date);
                                handleOpenModal();
                            }}
                            onSelectEvent={(event) => setSelectedEventForDetails(event)}
                            onEditEvent={(event) => {
                                setEditingSchedule(event);
                                setIsEditModalOpen(true);
                            }}
                            onDeleteEvent={async (eventId) => {
                                try {
                                    console.log('Delete event:', eventId);
                                    // Remove from local state immediately for optimistic update
                                    setSchedules(prev => prev.filter(s => s.id !== eventId));
                                    
                                    // Call API to delete the event
                                    await scheduleApi.deleteSchedule(token, eventId);
                                    
                                    // Refresh schedules to ensure consistency
                                    await fetchSchedules();
                                    
                                    // Show success feedback
                                    setLastAction({
                                        type: 'Event Deleted',
                                        message: 'Event has been deleted successfully',
                                        timestamp: Date.now()
                                    });
                                    setTimeout(() => setLastAction(null), 3000);
                                } catch (error) {
                                    console.error('Failed to delete event:', error);
                                    // Restore the event if deletion failed
                                    await fetchSchedules();
                                    alert('Failed to delete event. Please try again.');
                                }
                            }}
                            onMarkComplete={async (eventId) => {
                                try {
                                    const schedule = schedules.find(s => s.id === eventId);
                                    if (!schedule) return;
                                    const updated = await scheduleApi.updateSchedule(token, eventId, { status: 'completed' } as any);
                                    setSchedules(prev => prev.map(s => s.id === eventId ? updated : s));
                                    setSelectedEventForDetails(updated);
                                    setLastAction({ type: 'Event Completed', message: 'Event marked as completed', timestamp: Date.now() });
                                    setTimeout(() => setLastAction(null), 2000);
                                } catch (e) {
                                    console.error('Mark complete failed', e);
                                    alert('Failed to mark as complete');
                                }
                            }}
                        />
                    ) : (
                        <CalendarView 
                            schedules={filteredSchedules}
                            loading={loading}
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            onCreateEvent={(date?: string, time?: string) => {
                                if (date) setSelectedDate(date);
                                handleOpenModal();
                            }}
                            onEditEvent={(event) => {
                                console.log('Edit event:', event);
                            }}
                            onDeleteEvent={async (eventId) => {
                                try {
                                    console.log('Delete event:', eventId);
                                    // Remove from local state immediately for optimistic update
                                    setSchedules(prev => prev.filter(s => s.id !== eventId));
                                    
                                    // Call API to delete the event
                                    await scheduleApi.deleteSchedule(token, eventId);
                                    
                                    // Refresh schedules to ensure consistency
                                    await fetchSchedules();
                                    
                                    // Show success feedback
                                    setLastAction({
                                        type: 'Event Deleted',
                                        message: 'Event has been deleted successfully',
                                        timestamp: Date.now()
                                    });
                                    setTimeout(() => setLastAction(null), 3000);
                                } catch (error) {
                                    console.error('Failed to delete event:', error);
                                    // Restore the event if deletion failed
                                    await fetchSchedules();
                                    alert('Failed to delete event. Please try again.');
                                }
                            }}
                        />
                    )
                )}

                {activeTab === 'equipment' && (
                    <EquipmentManagement 
                        onEditEquipment={isAdmin ? handleEditEquipment : undefined}
                        isAdmin={isAdmin}
                    />
                )}

                {activeTab === 'meetings' && (
                    <GroupMeetingsManager 
                        onCreateMeeting={() => setIsGroupMeetingModalOpen(true)}
                        onEditMeeting={(meeting) => {
                            setSelectedMeeting(meeting);
                            setIsMeetingEditModalOpen(true);
                        }}
                        isAdmin={isAdmin}
                        onOpenJournalClubHub={(meetingId, initialTab, onUpdate) => {
                            setJournalClubMeetingId(meetingId ? String(meetingId) : null);
                            setIsJournalClubHubOpen(true);
                            // Store the update callback for later use
                            if (onUpdate) {
                                (window as any).__journalClubUpdateCallback = onUpdate;
                            }
                            // store desired initial tab in URL hash to pass to Hub (simple approach)
                            if (initialTab) {
                                window.location.hash = `jc-tab=${initialTab}`;
                            }
                        }}
                    />
                )}

                {activeTab === 'tasks' && (
                    <ImprovedTaskManager />
                )}

                {activeTab === 'my-schedule' && (
                    <MyScheduleView 
                        schedules={filteredSchedules}
                        loading={loading}
                        formatTime={formatTime}
                    />
                )}
            </div>

            {/* Modals */}
            {/* Task Swap Approval Modal (Admin) */}
            {pendingTaskSwapId !== null && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal-panel">
                        <div className="card-header flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Approve Task Swap Request</h3>
                            <button className="btn btn-ghost btn-xs" onClick={() => { setPendingTaskSwapId(null); setPendingTaskSwap(null); setTaskSwapReason(''); }}>✕</button>
                        </div>
                        <div className="card-body space-y-3">
                            {taskSwapLoading ? (
                                <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div></div>
                            ) : pendingTaskSwap ? (
                                <>
                                    <div className="text-sm text-gray-700">
                                        <div><span className="font-medium">Task:</span> {pendingTaskSwap?.task_instance?.template_name} ({pendingTaskSwap?.task_instance?.scheduled_period})</div>
                                        <div><span className="font-medium">From:</span> {pendingTaskSwap?.from_user?.username}</div>
                                        {pendingTaskSwap?.to_user && <div><span className="font-medium">To:</span> {pendingTaskSwap?.to_user?.username}</div>}
                                        <div><span className="font-medium">Reason:</span> {pendingTaskSwap?.reason || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Optional admin notes</label>
                                        <textarea value={taskSwapReason} onChange={e => setTaskSwapReason(e.target.value)} className="w-full border rounded p-2 text-sm" rows={3} />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            disabled={taskSwapLoading}
                                            className="btn btn-danger btn-sm"
                                            onClick={async () => {
                                                try {
                                                    setTaskSwapLoading(true);
                                                    const res = await fetch(buildApiUrl(`api/schedule/task-swap-requests/${pendingTaskSwapId}/reject/`), {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ reason: taskSwapReason || 'Rejected by admin' })
                                                    });
                                                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Reject failed');
                                                    setPendingTaskSwapId(null); setPendingTaskSwap(null); setTaskSwapReason('');
                                                    await fetchAllData();
                                                    setLastAction({ type: 'Task Swap', message: 'Request rejected', timestamp: Date.now() });
                                                    setTimeout(() => setLastAction(null), 2000);
                                                } catch (e) {
                                                    alert(e instanceof Error ? e.message : 'Reject failed');
                                                } finally {
                                                    setTaskSwapLoading(false);
                                                }
                                            }}
                                        >Reject</button>
                                        <button
                                            disabled={taskSwapLoading}
                                            className="btn btn-success btn-sm"
                                            onClick={async () => {
                                                try {
                                                    setTaskSwapLoading(true);
                                                    // Admin approval endpoint
                                                    const res = await fetch(buildApiUrl(`api/schedule/task-swap-requests/${pendingTaskSwapId}/approve_by_admin/`), {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Token ${token}` }
                                                    });
                                                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Approve failed');
                                                    setPendingTaskSwapId(null); setPendingTaskSwap(null); setTaskSwapReason('');
                                                    await fetchAllData();
                                                    setLastAction({ type: 'Task Swap', message: 'Request approved', timestamp: Date.now() });
                                                    setTimeout(() => setLastAction(null), 2000);
                                                } catch (e) {
                                                    alert(e instanceof Error ? e.message : 'Approve failed');
                                                } finally {
                                                    setTaskSwapLoading(false);
                                                }
                                            }}
                                        >Approve</button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-gray-600">Request not found.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Meeting Swap Approval Modal (Target user) */}
            {pendingMeetingSwapId !== null && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal-panel">
                        <div className="card-header flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Respond to Meeting Swap</h3>
                            <button className="btn btn-ghost btn-xs" onClick={() => { setPendingMeetingSwapId(null); setPendingMeetingSwap(null); setMeetingSwapReason(''); }}>✕</button>
                        </div>
                        <div className="card-body space-y-3">
                            {meetingSwapLoading ? (
                                <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div></div>
                            ) : pendingMeetingSwap ? (
                                <>
                                    <div className="text-sm text-gray-700">
                                        <div><span className="font-medium">Type:</span> {pendingMeetingSwap?.request_type}</div>
                                        <div><span className="font-medium">Requester:</span> {pendingMeetingSwap?.requester?.username}</div>
                                        <div><span className="font-medium">Reason:</span> {pendingMeetingSwap?.reason || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Optional notes</label>
                                        <textarea value={meetingSwapReason} onChange={e => setMeetingSwapReason(e.target.value)} className="w-full border rounded p-2 text-sm" rows={3} />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            disabled={meetingSwapLoading}
                                            className="btn btn-danger btn-sm"
                                            onClick={async () => {
                                                try {
                                                    setMeetingSwapLoading(true);
                                                    const res = await fetch(buildApiUrl(`api/schedule/swap-requests/${pendingMeetingSwapId}/reject/`), {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ reason: meetingSwapReason || 'Rejected' })
                                                    });
                                                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Reject failed');
                                                    setPendingMeetingSwapId(null); setPendingMeetingSwap(null); setMeetingSwapReason('');
                                                    await fetchAllData();
                                                    setLastAction({ type: 'Meeting Swap', message: 'Request rejected', timestamp: Date.now() });
                                                    setTimeout(() => setLastAction(null), 2000);
                                                } catch (e) {
                                                    alert(e instanceof Error ? e.message : 'Reject failed');
                                                } finally {
                                                    setMeetingSwapLoading(false);
                                                }
                                            }}
                                        >Reject</button>
                                        <button
                                            disabled={meetingSwapLoading}
                                            className="btn btn-success btn-sm"
                                            onClick={async () => {
                                                try {
                                                    setMeetingSwapLoading(true);
                                                    // Target user approval endpoint
                                                    const res = await fetch(buildApiUrl(`api/schedule/swap-requests/${pendingMeetingSwapId}/approve_by_target/`), {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Token ${token}` }
                                                    });
                                                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Approve failed');
                                                    setPendingMeetingSwapId(null); setPendingMeetingSwap(null); setMeetingSwapReason('');
                                                    await fetchAllData();
                                                    setLastAction({ type: 'Meeting Swap', message: 'Request approved', timestamp: Date.now() });
                                                    setTimeout(() => setLastAction(null), 2000);
                                                } catch (e) {
                                                    alert(e instanceof Error ? e.message : 'Approve failed');
                                                } finally {
                                                    setMeetingSwapLoading(false);
                                                }
                                            }}
                                        >Approve</button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-gray-600">Request not found.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <ScheduleFormModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmitSchedule}
                isSubmitting={isSubmitting}
            />

            {/* Edit Schedule Modal */}
            <ScheduleFormModal
                isOpen={isEditModalOpen}
                onClose={handleCloseEditModal}
                onSubmit={handleEditSchedule}
                isSubmitting={isSubmitting}
                initialData={editingSchedule ? {
                    title: editingSchedule.title,
                    description: editingSchedule.description || '',
                    date: editingSchedule.date,
                    start_time: editingSchedule.start_time || '',
                    end_time: editingSchedule.end_time || '',
                    location: editingSchedule.location || '',
                    status: editingSchedule.status
                } : null}
            />

            <GroupMeetingFormModal
                isOpen={isGroupMeetingModalOpen}
                onClose={() => setIsGroupMeetingModalOpen(false)}
                onSubmit={async (meetingData) => {
                    console.log('Group meeting data:', meetingData);
                    try {
                        // Create meeting via schedule API
                        const newMeeting = await scheduleApi.createSchedule(token, {
                            title: meetingData.title,
                            description: meetingData.description,
                            date: meetingData.date,
                            start_time: meetingData.start_time,
                            end_time: meetingData.end_time,
                            location: meetingData.location,
                            status: 'scheduled'
                        });
                        setSchedules(prev => [newMeeting, ...prev]);
                        await fetchSchedules();
                    } catch (error) {
                        console.error('Error creating meeting:', error);
                        throw error;
                    }
                }}
                isSubmitting={isSubmitting}
            />

            <RecurringTaskFormModal
                isOpen={isRecurringTaskModalOpen}
                onClose={() => setIsRecurringTaskModalOpen(false)}
                onSubmit={async (taskData) => {
                    console.log('Recurring task data:', taskData);
                    try {
                        // Create recurring task via groupMeetingApi
                            const newTask = await groupMeetingApi.createRecurringTask(token, {
                                title: taskData.title,
                                description: taskData.description,
                                cron_schedule: taskData.cron_schedule,
                                // Pass IDs list for backend rotation queue creation
                                assignee_group_ids: taskData.assignee_group,
                                location: taskData.location,
                                is_active: true
                            });
                        console.log('Recurring task created successfully:', newTask);
                        
                    } catch (error) {
                        console.error('Error creating recurring task:', error);
                        throw error;
                    }
                }}
                isSubmitting={isSubmitting}
            />


            <MeetingEditModal
                isOpen={isMeetingEditModalOpen}
                meeting={selectedMeeting}
                onClose={() => {
                    setIsMeetingEditModalOpen(false);
                    setSelectedMeeting(null);
                }}
                onSave={async (meeting) => {
                    console.log('Save meeting:', meeting);
                    // In real implementation, call API to save meeting
                    await fetchSchedules();
                }}
                onSwapRequest={async (swapRequest) => {
                    console.log('Swap request:', swapRequest);
                    // In real implementation, call API to submit swap request
                }}
                onPostpone={async (meetingId, newDate, reason) => {
                    console.log('Postpone meeting:', meetingId, newDate, reason);
                    // In real implementation, call API to postpone meeting
                    await fetchSchedules();
                }}
                isSubmitting={isSubmitting}
            />

            {/* Task Swap Request Modal */}
            <TaskSwapRequestModal
                isOpen={swapModalOpen}
                onClose={handleCloseSwapModal}
                taskTitle={swapTaskTitle}
                taskId={swapTaskId}
                users={users}
                currentUserId={user?.id ?? null}
                submitting={swapSubmitting}
                onSubmit={handleSubmitSwap}
            />

            {/* Journal Club Hub Modal */}
            {isJournalClubHubOpen && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal-panel modal-panel-large">
                        <div className="card-header flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Submit Journal Club Paper</h3>
                            <button 
                                onClick={() => {
                                    setIsJournalClubHubOpen(false);
                                    // Call the update callback if it exists
                                    const callback = (window as any).__journalClubUpdateCallback;
                                    if (callback && typeof callback === 'function') {
                                        callback();
                                        // Clean up the callback
                                        delete (window as any).__journalClubUpdateCallback;
                                    }
                                }} 
                                className="btn btn-ghost btn-xs"
                            >✕</button>
                        </div>
                        <div className="card-body">
                            <JournalClubHub 
                                meetingId={journalClubMeetingId || undefined}
                                initialTab={(window.location.hash.match(/jc-tab=(current|archive|upload)/)?.[1] as any) || 'current'}
                                onUpdate={() => {
                                    // Call the stored update callback
                                    const callback = (window as any).__journalClubUpdateCallback;
                                    if (callback && typeof callback === 'function') {
                                        callback();
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Schedule List View Component
const ScheduleListView: React.FC<{
    schedules: Schedule[];
    loading: boolean;
    searchTerm: string;
    filterStatus: string;
    formatTime: (time: string | undefined) => string;
}> = ({ schedules, loading, searchTerm, filterStatus, formatTime }) => {
    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>;
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            {schedules.length === 0 ? (
                <div className="p-8 text-center">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
                    <p className="text-gray-600">
                        {searchTerm || filterStatus !== 'all' 
                            ? 'Try adjusting your search or filter criteria'
                            : 'Create your first event to get started'
                        }
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200">
                    {schedules.map((schedule) => (
                        <div key={schedule.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-medium text-gray-900">
                                            {schedule.title}
                                        </h3>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scheduleHelpers.getStatusColor(schedule.status)}`}>
                                            {schedule.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                    
                                    {schedule.description && (
                                        <p className="text-gray-600 text-sm mb-3">
                                            {schedule.description}
                                        </p>
                                    )}
                                    
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                        {schedule.start_time && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>
                                                    {formatTime(schedule.start_time)}
                                                    {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {schedule.location && (
                                            <div className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4" />
                                                <span>{schedule.location}</span>
                                            </div>
                                        )}
                                        
                                        {schedule.attendees_count && (
                                            <div className="flex items-center gap-1">
                                                <Users className="w-4 h-4" />
                                                <span>{schedule.attendees_count} attendees</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-4">
                                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Equipment View Component
const EquipmentView: React.FC<{
    equipment: Equipment[];
    loading: boolean;
}> = ({ equipment, loading }) => {
    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipment.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-lg border border-gray-200">
                    <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No equipment found</h3>
                    <p className="text-gray-600">No equipment available or matches your search criteria</p>
                </div>
            ) : (
                equipment.map((eq) => (
                    <div key={eq.id} className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900 mb-1">{eq.name}</h3>
                                <p className="text-sm text-gray-500 mb-2">{eq.location}</p>
                                {eq.description && (
                                    <p className="text-sm text-gray-600 mb-3">{eq.description}</p>
                                )}
                            </div>
                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                eq.is_in_use 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                            }`}>
                                {eq.is_in_use ? 'In Use' : 'Available'}
                            </div>
                        </div>

                        {eq.is_in_use && eq.current_user && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <div className="flex items-center gap-2 text-yellow-800 text-sm">
                                    <User className="w-4 h-4" />
                                    <span>Currently used by {eq.current_user.username}</span>
                                </div>
                                {eq.current_usage_duration && (
                                    <p className="text-xs text-yellow-700 mt-1">
                                        Duration: {eq.current_usage_duration}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <div className="flex items-center text-sm text-gray-500">
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    <span>Bookable: {eq.is_bookable ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                                {eq.is_bookable && (
                                    <button className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Book
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

// Group Meetings View Component
const MeetingsView: React.FC<{
    schedules: Schedule[];
    loading: boolean;
}> = ({ schedules, loading }) => {
    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>;
    }

    return (
        <div className="space-y-6">
            {/* Meeting Schedule Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Group Meeting Schedule</h3>
                
                {/* Presenter Rotation Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-blue-800 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="font-medium">Presenter Rotation</span>
                    </div>
                    <p className="text-sm text-blue-700">Weekly meetings alternate between Research Updates and Journal Club sessions with automatic presenter assignment.</p>
                </div>

                {/* Next Meetings */}
                <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Upcoming Meetings</h4>
                    {schedules.length === 0 ? (
                        <div className="text-center py-8">
                            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No meetings scheduled</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {schedules.slice(0, 5).map((meeting) => (
                                <div key={meeting.id} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h5 className="font-medium text-gray-900">{meeting.title}</h5>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{meeting.date} at {meeting.start_time}</span>
                                                </div>
                                                {meeting.location && (
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-4 h-4" />
                                                        <span>{meeting.location}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                            meeting.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                            meeting.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {meeting.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Recurring Tasks View Component
const TasksView: React.FC<{
    schedules: Schedule[];
    loading: boolean;
}> = ({ schedules, loading }) => {
    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>;
    }

    return (
        <div className="space-y-6">
            {/* Task Management Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recurring Tasks</h3>
                
                {/* Task Info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-green-800 mb-2">
                        <Repeat className="w-5 h-5" />
                        <span className="font-medium">Automated Task Management</span>
                    </div>
                    <p className="text-sm text-green-700">Monthly lab maintenance tasks are automatically assigned to team members in rotation.</p>
                </div>

                {/* Task List */}
                <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Current Tasks</h4>
                    {schedules.length === 0 ? (
                        <div className="text-center py-8">
                            <Repeat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No recurring tasks configured</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {schedules.map((task) => (
                                <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <h5 className="font-medium text-gray-900">{task.title}</h5>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {task.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                    
                                    {task.description && (
                                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                                    )}
                                    
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            <span>Due: {task.date}</span>
                                        </div>
                                        {task.attendees_count && (
                                            <div className="flex items-center gap-1">
                                                <Users className="w-4 h-4" />
                                                <span>{task.attendees_count} assigned</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {task.status === 'pending' && (
                                        <button className="mt-3 w-full inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Mark Complete
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


export default SchedulePage;