import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
    Calendar, Clock, Users, MapPin, Plus, Edit3, Trash2, Search, 
    Settings, FileText, User, ChevronLeft, ChevronRight, Filter,
    BookOpen, RotateCcw, Upload, Download, Mail, AlertCircle,
    CheckCircle, XCircle, ArrowUpDown, Eye, MoreHorizontal
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { Schedule, scheduleApi, scheduleHelpers } from '../services/scheduleApi.ts';

// Enhanced Types for Group Meetings
export interface GroupMeeting extends Schedule {
    meeting_type: 'research_update' | 'journal_club' | 'general';
    topic: string;
    presenter_id?: number;
    presenter?: Presenter;
    materials_url?: string;
    materials_file?: string;
    rotation_list_id?: number;
    swap_requests?: SwapRequest[];
    email_reminders_sent?: EmailReminder[];
    is_materials_submitted?: boolean;
    materials_deadline?: string;
}

export interface Presenter {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
    last_presentation_date?: string;
    total_presentations: number;
}

export interface RotationList {
    id: number;
    name: string;
    meeting_type: 'research_update' | 'journal_club';
    presenters: Presenter[];
    current_presenter_index: number;
    next_presenter?: Presenter;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SwapRequest {
    id: number;
    from_meeting_id: number;
    to_meeting_id: number;
    from_presenter: Presenter;
    to_presenter: Presenter;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
    requested_at: string;
    reviewed_at?: string;
    reviewed_by?: number;
}

export interface EmailReminder {
    id: number;
    meeting_id: number;
    reminder_type: 'pre_meeting' | 'materials_submission' | 'presenter_assignment';
    sent_at: string;
    recipients: string[];
}

export interface MeetingConfiguration {
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
}

interface GroupMeetingsManagerProps {
    onCreateMeeting?: () => void;
    onEditMeeting?: (meeting: GroupMeeting) => void;
}

const GroupMeetingsManager: React.FC<GroupMeetingsManagerProps> = ({
    onCreateMeeting,
    onEditMeeting
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    // State management
    const [meetings, setMeetings] = useState<GroupMeeting[]>([]);
    const [presenters, setPresenters] = useState<Presenter[]>([]);
    const [rotationLists, setRotationLists] = useState<RotationList[]>([]);
    const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
    const [configurations, setConfigurations] = useState<MeetingConfiguration[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // View controls
    const [viewMode, setViewMode] = useState<'quarter' | 'month' | 'list'>('quarter');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filterType, setFilterType] = useState<'all' | 'research_update' | 'journal_club'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPendingSwaps, setShowPendingSwaps] = useState(false);
    
    // Modal states
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<GroupMeeting | null>(null);

    // Mock data - In real implementation, these would be API calls
    useEffect(() => {
        if (!token) return;

        const initializeMockData = async () => {
            setLoading(true);
            try {
                // Mock presenters
                const mockPresenters: Presenter[] = [
                    {
                        id: 1,
                        username: 'alice.johnson',
                        first_name: 'Alice',
                        last_name: 'Johnson',
                        email: 'alice.johnson@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-01-15',
                        total_presentations: 12
                    },
                    {
                        id: 2,
                        username: 'bob.smith',
                        first_name: 'Bob',
                        last_name: 'Smith',
                        email: 'bob.smith@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-01-22',
                        total_presentations: 8
                    },
                    {
                        id: 3,
                        username: 'carol.davis',
                        first_name: 'Carol',
                        last_name: 'Davis',
                        email: 'carol.davis@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-01-29',
                        total_presentations: 15
                    },
                    {
                        id: 4,
                        username: 'david.wilson',
                        first_name: 'David',
                        last_name: 'Wilson',
                        email: 'david.wilson@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-02-05',
                        total_presentations: 6
                    }
                ];

                // Mock rotation lists
                const mockRotationLists: RotationList[] = [
                    {
                        id: 1,
                        name: 'Research Update Rotation',
                        meeting_type: 'research_update',
                        presenters: mockPresenters,
                        current_presenter_index: 0,
                        next_presenter: mockPresenters[0],
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        id: 2,
                        name: 'Journal Club Rotation',
                        meeting_type: 'journal_club',
                        presenters: mockPresenters,
                        current_presenter_index: 1,
                        next_presenter: mockPresenters[1],
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ];

                // Generate mock meetings for the next 6 months
                const mockMeetings: GroupMeeting[] = [];
                const today = new Date();
                
                for (let i = 0; i < 24; i++) { // 24 weeks = 6 months
                    const meetingDate = new Date(today);
                    meetingDate.setDate(today.getDate() + (i * 7)); // Weekly meetings
                    
                    const isResearchUpdate = i % 2 === 0;
                    const meetingType = isResearchUpdate ? 'research_update' : 'journal_club';
                    const presenter = mockPresenters[i % mockPresenters.length];
                    
                    const meeting: GroupMeeting = {
                        id: 1000 + i,
                        title: `${isResearchUpdate ? 'Research Update' : 'Journal Club'}: Week ${i + 1}`,
                        description: isResearchUpdate 
                            ? 'Weekly research progress presentations and discussions'
                            : 'Journal article discussion and literature review',
                        date: meetingDate.toISOString().split('T')[0],
                        start_time: '14:00',
                        end_time: isResearchUpdate ? '15:30' : '15:00',
                        location: 'Conference Room A',
                        status: 'scheduled',
                        attendees_count: 8,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        meeting_type: meetingType,
                        topic: isResearchUpdate 
                            ? `${presenter.first_name}'s Research Progress`
                            : 'Recent Advances in Cell Biology',
                        presenter_id: presenter.id,
                        presenter: presenter,
                        rotation_list_id: isResearchUpdate ? 1 : 2,
                        is_materials_submitted: !isResearchUpdate ? Math.random() > 0.3 : undefined,
                        materials_deadline: !isResearchUpdate 
                            ? new Date(meetingDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                            : undefined
                    };
                    
                    mockMeetings.push(meeting);
                }

                // Mock configurations
                const mockConfigurations: MeetingConfiguration[] = [
                    {
                        id: 1,
                        meeting_type: 'research_update',
                        default_duration_minutes: 90,
                        default_location: 'Conference Room A',
                        default_day_of_week: 5, // Friday
                        default_time: '14:00',
                        materials_deadline_days: 0,
                        reminder_schedule: {
                            presenter_reminder_days: 3,
                            materials_reminder_days: 7,
                            pre_meeting_hours: 1
                        },
                        auto_generate_months_ahead: 6,
                        is_active: true
                    },
                    {
                        id: 2,
                        meeting_type: 'journal_club',
                        default_duration_minutes: 60,
                        default_location: 'Conference Room A',
                        default_day_of_week: 5, // Friday
                        default_time: '15:00',
                        materials_deadline_days: 7,
                        reminder_schedule: {
                            presenter_reminder_days: 3,
                            materials_reminder_days: 1,
                            pre_meeting_hours: 1
                        },
                        auto_generate_months_ahead: 6,
                        is_active: true
                    }
                ];

                setPresenters(mockPresenters);
                setRotationLists(mockRotationLists);
                setMeetings(mockMeetings);
                setConfigurations(mockConfigurations);
                setError(null);
            } catch (err) {
                setError('Failed to load group meetings data');
                console.error('Error loading group meetings:', err);
            } finally {
                setLoading(false);
            }
        };

        initializeMockData();
    }, [token]);

    // Filter and search meetings
    const filteredMeetings = meetings.filter(meeting => {
        const matchesType = filterType === 'all' || meeting.meeting_type === filterType;
        const matchesSearch = !searchTerm || 
            meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            meeting.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            meeting.presenter?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            meeting.presenter?.last_name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Date filtering based on view mode
        const meetingDate = new Date(meeting.date);
        const currentDate = new Date(selectedDate);
        
        if (viewMode === 'quarter') {
            const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1);
            const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
            return matchesType && matchesSearch && meetingDate >= quarterStart && meetingDate <= quarterEnd;
        } else if (viewMode === 'month') {
            return matchesType && matchesSearch && 
                   meetingDate.getFullYear() === currentDate.getFullYear() &&
                   meetingDate.getMonth() === currentDate.getMonth();
        }
        
        return matchesType && matchesSearch;
    });

    // Navigation functions
    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = new Date(selectedDate);
        if (viewMode === 'quarter') {
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3));
        } else if (viewMode === 'month') {
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        }
        setSelectedDate(newDate);
    };

    const formatDateRange = () => {
        if (viewMode === 'quarter') {
            const quarterStart = new Date(selectedDate.getFullYear(), Math.floor(selectedDate.getMonth() / 3) * 3, 1);
            const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
            return `Q${Math.floor(selectedDate.getMonth() / 3) + 1} ${selectedDate.getFullYear()} (${quarterStart.toLocaleDateString('en-US', { month: 'short' })} - ${quarterEnd.toLocaleDateString('en-US', { month: 'short' })})`;
        } else if (viewMode === 'month') {
            return selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        }
        return 'All Meetings';
    };

    // Action handlers
    const handleSwapRequest = (meeting: GroupMeeting) => {
        setSelectedMeeting(meeting);
        setShowSwapModal(true);
    };

    const handlePostponeMeeting = async (meeting: GroupMeeting) => {
        // Implementation for postponing meetings
        console.log('Postpone meeting:', meeting);
    };

    const handleMaterialsUpload = (meeting: GroupMeeting) => {
        // Implementation for materials upload
        console.log('Upload materials for:', meeting);
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
            {/* Header with Controls */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Smart Group Meetings</h2>
                        <p className="text-gray-600">Automated meeting management with intelligent presenter rotation</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Configure
                        </button>
                        
                        {onCreateMeeting && (
                            <button
                                onClick={onCreateMeeting}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Meeting
                            </button>
                        )}
                    </div>
                </div>

                {/* Controls Row */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* View Mode Selector */}
                    <div className="flex rounded-md border border-gray-300 overflow-hidden">
                        {(['quarter', 'month', 'list'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-2 text-sm font-medium capitalize ${
                                    viewMode === mode
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    {/* Date Navigation */}
                    {viewMode !== 'list' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigateDate('prev')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-gray-700 min-w-0 whitespace-nowrap">
                                {formatDateRange()}
                            </span>
                            <button
                                onClick={() => navigateDate('next')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search meetings..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                        >
                            <option value="all">All Types</option>
                            <option value="research_update">Research Updates</option>
                            <option value="journal_club">Journal Club</option>
                        </select>

                        <button
                            onClick={() => setShowPendingSwaps(!showPendingSwaps)}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                showPendingSwaps 
                                    ? 'bg-orange-100 text-orange-700' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <ArrowUpDown className="w-4 h-4 mr-1" />
                            Swaps ({swapRequests.filter(r => r.status === 'pending').length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Total Meetings</p>
                            <p className="text-2xl font-semibold text-gray-900">{filteredMeetings.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <BookOpen className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Journal Clubs</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {filteredMeetings.filter(m => m.meeting_type === 'journal_club').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Active Presenters</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {presenters.filter(p => p.is_active).length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Pending Materials</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {filteredMeetings.filter(m => 
                                    m.meeting_type === 'journal_club' && !m.is_materials_submitted
                                ).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Meetings Display */}
            <div className="bg-white rounded-lg border border-gray-200">
                {filteredMeetings.length === 0 ? (
                    <div className="p-8 text-center">
                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings found</h3>
                        <p className="text-gray-600">
                            {searchTerm || filterType !== 'all' 
                                ? 'Try adjusting your search or filter criteria'
                                : 'No meetings scheduled for this period'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredMeetings.map((meeting) => (
                            <MeetingCard
                                key={meeting.id}
                                meeting={meeting}
                                onEdit={onEditMeeting}
                                onSwap={handleSwapRequest}
                                onPostpone={handlePostponeMeeting}
                                onUploadMaterials={handleMaterialsUpload}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Meeting Card Component
interface MeetingCardProps {
    meeting: GroupMeeting;
    onEdit?: (meeting: GroupMeeting) => void;
    onSwap?: (meeting: GroupMeeting) => void;
    onPostpone?: (meeting: GroupMeeting) => void;
    onUploadMaterials?: (meeting: GroupMeeting) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
    meeting,
    onEdit,
    onSwap,
    onPostpone,
    onUploadMaterials
}) => {
    const [showActions, setShowActions] = useState(false);
    
    const isJournalClub = meeting.meeting_type === 'journal_club';
    const needsMaterials = isJournalClub && !meeting.is_materials_submitted;
    const materialsOverdue = needsMaterials && meeting.materials_deadline && 
        new Date(meeting.materials_deadline) < new Date();

    const getMeetingTypeColor = (type: string) => {
        switch (type) {
            case 'journal_club':
                return 'bg-green-100 text-green-800';
            case 'research_update':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getMeetingTypeLabel = (type: string) => {
        switch (type) {
            case 'journal_club':
                return 'Journal Club';
            case 'research_update':
                return 'Research Update';
            default:
                return 'General Meeting';
        }
    };

    return (
        <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMeetingTypeColor(meeting.meeting_type)}`}>
                            {getMeetingTypeLabel(meeting.meeting_type)}
                        </span>
                        
                        {needsMaterials && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                materialsOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {materialsOverdue ? 'Materials Overdue' : 'Materials Pending'}
                            </span>
                        )}
                        
                        {meeting.is_materials_submitted && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Materials Submitted
                            </span>
                        )}

                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scheduleHelpers.getStatusColor(meeting.status)}`}>
                            {meeting.status.replace('_', ' ')}
                        </span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-gray-900 mb-1">{meeting.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{meeting.topic}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{scheduleHelpers.formatScheduleDate(meeting.date)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{scheduleHelpers.formatScheduleTime(meeting.start_time, meeting.end_time)}</span>
                        </div>
                        
                        {meeting.location && (
                            <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{meeting.location}</span>
                            </div>
                        )}
                        
                        {meeting.presenter && (
                            <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <span>Presenter: {meeting.presenter.first_name} {meeting.presenter.last_name}</span>
                            </div>
                        )}
                        
                        {meeting.attendees_count && (
                            <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                <span>{meeting.attendees_count} attendees</span>
                            </div>
                        )}
                    </div>

                    {meeting.materials_url && (
                        <div className="mt-3">
                            <a
                                href={meeting.materials_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                            >
                                <FileText className="w-4 h-4 mr-1" />
                                View Materials
                            </a>
                        </div>
                    )}
                </div>
                
                <div className="relative ml-4">
                    <button
                        onClick={() => setShowActions(!showActions)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    {showActions && (
                        <div className="absolute right-0 top-10 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                            <div className="py-1">
                                {onEdit && (
                                    <button
                                        onClick={() => {
                                            onEdit(meeting);
                                            setShowActions(false);
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Edit3 className="w-4 h-4 inline mr-2" />
                                        Edit Meeting
                                    </button>
                                )}
                                
                                {onSwap && (
                                    <button
                                        onClick={() => {
                                            onSwap(meeting);
                                            setShowActions(false);
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <ArrowUpDown className="w-4 h-4 inline mr-2" />
                                        Request Swap
                                    </button>
                                )}
                                
                                {onPostpone && (
                                    <button
                                        onClick={() => {
                                            onPostpone(meeting);
                                            setShowActions(false);
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <RotateCcw className="w-4 h-4 inline mr-2" />
                                        Postpone
                                    </button>
                                )}
                                
                                {isJournalClub && onUploadMaterials && (
                                    <button
                                        onClick={() => {
                                            onUploadMaterials(meeting);
                                            setShowActions(false);
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Upload className="w-4 h-4 inline mr-2" />
                                        Upload Materials
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => setShowActions(false)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Mail className="w-4 h-4 inline mr-2" />
                                    Send Reminder
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupMeetingsManager;