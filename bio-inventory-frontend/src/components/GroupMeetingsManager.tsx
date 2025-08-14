import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
    Calendar, Clock, Users, MapPin, Plus, Edit3, Trash2, Search, 
    Settings, FileText, User, ChevronLeft, ChevronRight, Filter,
    BookOpen, RotateCcw, Upload, Download, Mail, AlertCircle,
    CheckCircle, XCircle, ArrowUpDown, Eye, MoreHorizontal, X, Archive
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { API_BASE_URL } from '../config/api.ts';
import { 
    groupMeetingApi, 
    GroupMeeting, 
    Presenter, 
    MeetingConfiguration, 
    groupMeetingHelpers 
} from "../services/groupMeetingApi.ts";
import { scheduleApi, intelligentMeetingApi } from "../services/scheduleApi.ts";
import * as intelligentMeetingApiService from "../services/intelligentMeetingApi.ts";
import SwapRequestModal, { SwapRequestData } from '../modals/SwapRequestModal.tsx';
import PostponeMeetingModal, { PostponeData } from '../modals/PostponeMeetingModal.tsx';
import MaterialsUploadModal, { MaterialsUploadData } from '../modals/MaterialsUploadModal.tsx';
import RotationManagementModal, { RotationUpdateData } from '../modals/RotationManagementModal.tsx';
import MeetingGenerationModal, { MeetingGenerationParams } from '../modals/MeetingGenerationModal.tsx';

// Additional types for rotation lists and swap requests
interface RotationList {
    id: number;
    name: string;
    meeting_type: 'research_update' | 'journal_club';
    presenters: Presenter[];
    current_presenter_index: number;
    next_presenter: Presenter | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface SwapRequest {
    id: number;
    meeting_id: number;
    requester_id: number;
    target_presenter_id?: number;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    created_at: string;
    updated_at: string;
}

interface GroupMeetingsManagerProps {
    onCreateMeeting?: () => void;
    onEditMeeting?: (meeting: GroupMeeting) => void;
    isAdmin?: boolean;
    onOpenJournalClubHub?: (meetingId?: number | string, initialTab?: 'current' | 'archive' | 'upload') => void;
}

const GroupMeetingsManager: React.FC<GroupMeetingsManagerProps> = ({
    onCreateMeeting,
    onEditMeeting,
    isAdmin = false,
    onOpenJournalClubHub
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
    const [filterType, setFilterType] = useState<'all' | 'lab_meeting' | 'journal_club'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPendingSwaps, setShowPendingSwaps] = useState(false);
    
    // Modal states
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [showPostponeModal, setShowPostponeModal] = useState(false);
    const [showMaterialsModal, setShowMaterialsModal] = useState(false);
    const [showRotationModal, setShowRotationModal] = useState(false);
    const [showGenerationModal, setShowGenerationModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<GroupMeeting | null>(null);
    const [selectedConfig, setSelectedConfig] = useState<MeetingConfiguration | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load data from API
    // Data adapter to convert MeetingInstance to GroupMeeting format
    const adaptMeetingInstanceToGroupMeeting = (meetingInstance: any): GroupMeeting => {
        return {
            id: meetingInstance.id,
            title: `${meetingInstance.meeting_type?.replace('_', ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase())} - ${meetingInstance.date}`,
            description: meetingInstance.description || '',
            date: meetingInstance.date,
            start_time: '10:00:00', // Default, could be from config
            end_time: '11:00:00',   // Default, could be from config
            location: 'Conference Room', // Default, could be from config
            status: meetingInstance.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed',
            meeting_type: meetingInstance.meeting_type === 'research_update' ? 'lab_meeting' : 'journal_club',
            topic: meetingInstance.title || meetingInstance.meeting_type?.replace('_', ' ') || '',
            presenter_ids: meetingInstance.presenters?.map((p: any) => p.user?.id || p.id) || [],
            presenters: meetingInstance.presenters?.map((p: any) => ({
                id: p.user?.id || p.id,
                first_name: p.user?.first_name || p.first_name || '',
                last_name: p.user?.last_name || p.last_name || '',
                email: p.user?.email || p.email || '',
                username: p.user?.username || p.username || '',
                is_active: true,
                date_joined: p.user?.date_joined || new Date().toISOString()
            })) || [],
            materials_url: undefined,
            materials_file: undefined,
            materials_deadline: undefined,
            created_at: meetingInstance.created_at || new Date().toISOString(),
            updated_at: meetingInstance.updated_at || new Date().toISOString(),
            attendees_count: meetingInstance.attendees_count
        };
    };

    const loadData = useCallback(async () => {
        if (!token) return;
        
        setLoading(true);
        try {
            console.log('🔄 Loading meetings data using intelligent meeting API...');
            
            // Use intelligent meeting API to get MeetingInstance data
            const [meetingsResponse, configurationsData] = await Promise.all([
                intelligentMeetingApiService.meetingInstanceApi.getMeetings(token, {
                    ordering: 'date',
                    page_size: 100
                }),
                groupMeetingApi.getConfigurations(token)
            ]);

            console.log('📥 Raw meeting response:', meetingsResponse);
            console.log('📊 Configurations loaded:', configurationsData);

            // Convert MeetingInstance data to GroupMeeting format
            let meetingsData = [];
            if (meetingsResponse && meetingsResponse.results && Array.isArray(meetingsResponse.results)) {
                console.log('Data handler: paginated response detected.');
                meetingsData = meetingsResponse.results;
            } else if (Array.isArray(meetingsResponse)) {
                console.log('Data handler: direct array response detected.');
                meetingsData = meetingsResponse;
            } else {
                console.log('Data handler: response is not a paginated object or a direct array.');
            }

            console.log(`Pre-mapping: meetingsData contains ${meetingsData.length} items.`);
            
            const adaptedMeetings = meetingsData.map((mi: any) => {
                const gm = adaptMeetingInstanceToGroupMeeting(mi);
                // 标记主 presenter（取第一个），并保留 presenter 模型记录ID用于后续交换
                if (mi.presenters && mi.presenters.length > 0) {
                    const first = mi.presenters[0];
                    gm.presenter = {
                        id: first.user?.id || first.id,
                        presenter_record_id: first.id,
                        username: first.user?.username || first.username || '',
                        first_name: first.user?.first_name || first.first_name || '',
                        last_name: first.user?.last_name || first.last_name || '',
                        email: first.user?.email || first.email || '',
                        is_active: true,
                        total_presentations: 0
                    } as any;
                }
                return gm;
            });
            
            console.log(`✅ Successfully loaded ${adaptedMeetings.length} meetings from intelligent API:`);
            adaptedMeetings.forEach((meeting, index) => {
                console.log(`  ${index + 1}. ${meeting.title} (${meeting.date}) - ${meeting.presenters?.length || 0} presenters`);
            });

            // Get all unique presenters from meetings
            const allPresenters: any[] = [];
            adaptedMeetings.forEach(meeting => {
                meeting.presenters?.forEach(presenter => {
                    if (!allPresenters.find(p => p.id === presenter.id)) {
                        allPresenters.push(presenter);
                    }
                });
            });

            // Sort meetings by date (nearest dates first, then farthest)
            const sortedMeetings = adaptedMeetings.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const now = new Date();
                
                // Get upcoming meetings first (sorted by nearest date first)
                const aIsFuture = dateA >= now;
                const bIsFuture = dateB >= now;
                
                if (aIsFuture && !bIsFuture) return -1; // a is future, b is past - a comes first
                if (!aIsFuture && bIsFuture) return 1;  // a is past, b is future - b comes first
                
                if (aIsFuture && bIsFuture) {
                    // Both are future - sort by nearest first (ascending)
                    return dateA.getTime() - dateB.getTime();
                } else {
                    // Both are past - sort by most recent first (descending)
                    return dateB.getTime() - dateA.getTime();
                }
            });
            
            setMeetings(sortedMeetings);
            setPresenters(allPresenters);
            setConfigurations(configurationsData || []);
            setError(null);
        } catch (err) {
            console.error('Error loading Schedule data:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(`Failed to load schedule data: ${errorMessage}. Please check your connection and try again.`);
            setMeetings([]);
            setPresenters([]);
            setConfigurations([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter and search meetings
    const filteredMeetings = meetings.filter(meeting => {
        const matchesType = filterType === 'all' || meeting.meeting_type === filterType;
        const matchesSearch = !searchTerm || 
            meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            meeting.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (meeting.presenters && meeting.presenters.some(p => 
                p.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.last_name.toLowerCase().includes(searchTerm.toLowerCase())
            ));
        
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

    const handlePostponeMeeting = (meeting: GroupMeeting) => {
        setSelectedMeeting(meeting);
        setShowPostponeModal(true);
    };

    const handleMaterialsUpload = (meeting: GroupMeeting) => {
        // For Journal Club, open the centralized paper management hub
        if (meeting.meeting_type === 'journal_club' && onOpenJournalClubHub) {
            onOpenJournalClubHub(meeting.id, 'upload');
            return;
        }
        // Fallback to legacy materials upload modal
        setSelectedMeeting(meeting);
        setShowMaterialsModal(true);
    };

    // Modal submit handlers
    const handleSwapSubmit = async (swapData: SwapRequestData) => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            // 组会交换：创建 SwapRequest（请求类型 'swap' 或找替补），最少需要原 presenter 与原因
            // 若选择了特定 presenter 交换，则需要目标 presenter 的 presenter_record_id
            const payload: any = {
                request_type: 'swap',
                original_presentation_id: selectedMeeting?.presenter?.presenter_record_id,
                reason: swapData.reason,
            };
            if (swapData.swapType === 'swap_with_specific' && swapData.targetPresenterId) {
                // 找到目标 presenter 的 presenter_record_id（通过 meetings 数据中 presenters 映射）
                const all = meetings.flatMap(m => (m as any).presenters || []);
                const target = all.find((p: any) => (p.id === swapData.targetPresenterId) || (p.user?.id === swapData.targetPresenterId));
                if (target) {
                    payload.target_presentation_id = target.presenter_record_id || target.id;
                }
            }
            // 调用智能会议 API 创建请求
            await intelligentMeetingApiService.swapRequestApi.createSwapRequest(token, payload);
            alert('Swap request submitted successfully.');
            setShowSwapModal(false);
        } catch (error) {
            console.error('Error submitting swap request:', error);
            alert(error instanceof Error ? error.message : 'Failed to submit swap request');
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePostponeSubmit = async (postponeData: PostponeData) => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            // In real implementation, this would call the API
            console.log('Meeting postponed:', postponeData);
            
            // Simulate API response
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Reload data to ensure consistency
            await loadData();
        } catch (error) {
            console.error('Error postponing meeting:', error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMaterialsSubmit = async (uploadData: MaterialsUploadData) => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            // In real implementation, this would upload files to the API
            console.log('Materials uploaded:', uploadData);
            
            // Simulate file upload
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Reload data to ensure consistency
            await loadData();
        } catch (error) {
            console.error('Error uploading materials:', error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRotationUpdate = async (rotationData: RotationUpdateData) => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            // Call the new rotation update API
            const response = await fetch(`${API_BASE_URL}/api/schedule/rotation-systems/update_rotation/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    rotationType: rotationData.rotationType,
                    rotationList: rotationData.rotationList
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update rotation');
            }

            const result = await response.json();
            console.log('Rotation update successful:', {
                type: result.type,
                activeParticipants: result.active_participants,
                inactiveParticipants: result.inactive_participants
            });
            
            // Handle postponement actions
            if (rotationData.postponementActions && rotationData.postponementActions.length > 0) {
                console.log(`Processing ${rotationData.postponementActions.length} postponement actions:`);
                rotationData.postponementActions.forEach(action => {
                    console.log(`- ${action.action} for presenter ${action.presenterId}: ${action.reason}`);
                });
            } else {
                console.log('No postponement actions requested');
            }
        } catch (error) {
            console.error('Error updating rotation:', error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAutoGenerateMeetings = () => {
        setShowGenerationModal(true);
    };

    const handleMeetingGeneration = async (params: MeetingGenerationParams) => {
        if (!token) return;
        
        setLoading(true);
        try {
            console.log('Generating meetings with params:', params);
            
            const result = await intelligentMeetingApiService.meetingInstanceApi.generateMeetings(token, {
                start_date: params.start_date,
                end_date: params.end_date,
                meeting_types: params.meeting_types,
                auto_assign_presenters: params.auto_assign_presenters
            });
            
            // Show success message
            const res = result as any;
            const meetingCount = res.count || res.generated_meetings?.length || 0;
            console.log('Meeting generation result:', res);
            
            let modeDescription = '';
            switch (params.generation_mode) {
                case 'months':
                    modeDescription = `${params.months_ahead} months`;
                    break;
                case 'weeks':
                    modeDescription = `${params.weeks_ahead} weeks`;
                    break;
                case 'count':
                    modeDescription = `${params.meeting_count} meetings requested`;
                    break;
                case 'custom':
                    modeDescription = `custom date range (${params.start_date} to ${params.end_date})`;
                    break;
            }
            
            const message = meetingCount > 0 
                ? `Success! Generated ${meetingCount} meetings for ${modeDescription}.\n\n${params.auto_assign_presenters ? 'Presenters have been automatically assigned using fair rotation.' : 'No presenters assigned - you can assign them manually.'}`
                : `No new meetings were generated for ${modeDescription}.\n\nThis may be because:\n• Meetings already exist for the selected dates\n• All dates fall on holidays\n• No meeting configuration is set up\n\nPlease check your configuration and try again.`;
                
            alert(message);
            
            // Close modal and reload data
            setShowGenerationModal(false);
            await loadData();
            
        } catch (error) {
            console.error('Error generating meetings:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Failed to generate meetings: ${errorMessage}\n\nPlease ensure meeting configuration is set up properly and try again.`);
        } finally {
            setLoading(false);
        }
    };

    const handleEditConfiguration = (config: MeetingConfiguration) => {
        setSelectedConfig(config);
        setShowConfigModal(true);
    };

    const handleToggleConfigurationActive = async (config: MeetingConfiguration) => {
        if (!token) return;
        
        setIsSubmitting(true);
        try {
            const updatedConfig = await groupMeetingApi.updateConfiguration(token, config.id, {
                is_active: !config.is_active
            });
            
            // Reload data to ensure consistency
            await loadData();
            
            const action = updatedConfig.is_active ? 'activated' : 'deactivated';
            alert(`Successfully ${action} ${config.meeting_type.replace('_', ' ')} meetings configuration.`);
            
        } catch (error) {
            console.error('Error toggling configuration:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Failed to toggle configuration: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendMeetingReminder = async (meeting: GroupMeeting) => {
        if (!token) return;
        
        setIsSubmitting(true);
        try {
            // Import the API from groupMeetingsApi that has sendEmailReminder
            const { groupMeetingsApi } = await import('../services/groupMeetingsApi.ts');
            
            await groupMeetingsApi.sendEmailReminder(token, meeting.id, 'pre_meeting');
            
            const presenterNames = meeting.presenters && meeting.presenters.length > 0 
                ? meeting.presenters.map(p => `${p.first_name} ${p.last_name}`).join(', ')
                : 'presenters';
                
            alert(`✅ Reminder successfully sent to ${presenterNames} for "${meeting.title}"`);
            
        } catch (error) {
            console.error('Error sending reminder:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Failed to send reminder: ${errorMessage}\n\nPlease ensure email service is properly configured.`);
        } finally {
            setIsSubmitting(false);
        }
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
                        {/* Paper Archive quick access */}
                        <button
                            onClick={() => onOpenJournalClubHub && onOpenJournalClubHub(undefined, 'archive')}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Archive className="w-4 h-4 mr-2" />
                            Paper Archive
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setShowRotationModal(true)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Manage Rotation
                            </button>
                        )}
                        
                        {isAdmin && (
                            <button
                                onClick={() => setShowConfigModal(true)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Settings
                            </button>
                        )}
                        
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
                            <option value="lab_meeting">Research Updates</option>
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

                {/* Debug Info Panel */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Settings className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-blue-700">Data Source</p>
                            <p className="text-xs text-blue-600">
                                Using Intelligent Meeting API
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                {loading ? 'Loading...' : `${meetings.length} meetings loaded`}
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
                    <div className="flex items-start justify-between">
                        <div className="flex">
                            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
                            <div>
                                <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="ml-3 bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Retrying...' : 'Retry'}
                        </button>
                    </div>
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
                                onSendReminder={handleSendMeetingReminder}
                                isSubmitting={isSubmitting}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Meeting Configuration Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Meeting Configuration</h2>
                            <button
                                onClick={() => {
                                    setShowConfigModal(false);
                                    setSelectedConfig(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Current Configurations */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Current Settings</h3>
                                
                                {configurations.map((config) => (
                                    <div key={config.id} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium text-gray-900 capitalize">
                                                {config.meeting_type.replace('_', ' ')}
                                            </h4>
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                                config.is_active 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {config.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                            <div>
                                                <span className="font-medium">Duration:</span> {config.default_duration_minutes} minutes
                                            </div>
                                            <div>
                                                <span className="font-medium">Location:</span> {config.default_location}
                                            </div>
                                            <div>
                                                <span className="font-medium">Time:</span> {config.default_time}
                                            </div>
                                            <div>
                                                <span className="font-medium">Materials Deadline:</span> {config.materials_deadline_days} days before
                                            </div>
                                        </div>
                                        
                                        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                                            <div className="font-medium text-gray-700 mb-1">Reminder Schedule:</div>
                                            <div className="text-gray-600">
                                                Presenter: {config.reminder_schedule.presenter_reminder_days} days before • 
                                                Materials: {config.reminder_schedule.materials_reminder_days} days before • 
                                                Pre-meeting: {config.reminder_schedule.pre_meeting_hours} hours before
                                            </div>
                                        </div>
                                        
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={() => handleEditConfiguration(config)}
                                                disabled={isSubmitting}
                                                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleToggleConfigurationActive(config)}
                                                disabled={isSubmitting}
                                                className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${
                                                    config.is_active 
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                }`}
                                            >
                                                {config.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Quick Actions */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={handleAutoGenerateMeetings}
                                        disabled={loading}
                                        className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                        <div className="text-left">
                                            <div className="font-medium text-gray-900">Auto-Generate Meetings</div>
                                            <div className="text-sm text-gray-600">Create future meetings automatically</div>
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => setShowRotationModal(true)}
                                        className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <RotateCcw className="w-5 h-5 text-green-600" />
                                        <div className="text-left">
                                            <div className="font-medium text-gray-900">Manage Rotations</div>
                                            <div className="text-sm text-gray-600">Configure presenter assignments</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-200 p-6">
                            <button
                                onClick={() => {
                                    setShowConfigModal(false);
                                    setSelectedConfig(null);
                                }}
                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Swap Request Modal */}
            <SwapRequestModal
                isOpen={showSwapModal}
                onClose={() => setShowSwapModal(false)}
                meeting={selectedMeeting}
                presenters={presenters}
                onSubmit={handleSwapSubmit}
                isSubmitting={isSubmitting}
            />

            {/* Postpone Meeting Modal */}
            <PostponeMeetingModal
                isOpen={showPostponeModal}
                onClose={() => setShowPostponeModal(false)}
                meeting={selectedMeeting}
                onSubmit={handlePostponeSubmit}
                isSubmitting={isSubmitting}
            />

            {/* Materials Upload Modal */}
            <MaterialsUploadModal
                isOpen={showMaterialsModal}
                onClose={() => setShowMaterialsModal(false)}
                meeting={selectedMeeting}
                onSubmit={handleMaterialsSubmit}
                isSubmitting={isSubmitting}
            />

            {/* Rotation Management Modal */}
            <RotationManagementModal
                isOpen={showRotationModal}
                onClose={() => setShowRotationModal(false)}
                presenters={presenters}
                meetings={meetings}
                onUpdateRotation={handleRotationUpdate}
                isSubmitting={isSubmitting}
            />

            <MeetingGenerationModal
                isOpen={showGenerationModal}
                onClose={() => setShowGenerationModal(false)}
                onGenerate={handleMeetingGeneration}
                isLoading={loading}
            />
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
    onSendReminder: (meeting: GroupMeeting) => Promise<void>;
    isSubmitting: boolean;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
    meeting,
    onEdit,
    onSwap,
    onPostpone,
    onUploadMaterials,
    onSendReminder,
    isSubmitting
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

                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${groupMeetingHelpers.getStatusColor(meeting.status)}`}>
                            {meeting.status.replace('_', ' ')}
                        </span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-gray-900 mb-1">{meeting.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{meeting.topic}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{groupMeetingHelpers.formatScheduleDate(meeting.date)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{groupMeetingHelpers.formatScheduleTime(meeting.start_time, meeting.end_time)}</span>
                        </div>
                        
                        {meeting.location && (
                            <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{meeting.location}</span>
                            </div>
                        )}
                        
                        {meeting.presenters && meeting.presenters.length > 0 && (
                            <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <span>
                                    {meeting.presenters.length === 1 ? 'Presenter: ' : 'Presenters: '}
                                    {meeting.presenters.map((presenter, idx) => (
                                        <span key={presenter.id}>
                                            {presenter.first_name} {presenter.last_name}
                                            {idx < meeting.presenters.length - 1 ? ', ' : ''}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        )}
                        {meeting.presenter && (
                            <div className="flex items-center gap-1">
                                <User className="w-4 h-4 text-purple-600" />
                                <span className="text-purple-700">Main: {meeting.presenter.first_name} {meeting.presenter.last_name}</span>
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
                                    onClick={async () => {
                                        try {
                                            await onSendReminder(meeting);
                                            setShowActions(false);
                                        } catch (error) {
                                            console.error('Error sending reminder:', error);
                                        }
                                    }}
                                    disabled={isSubmitting}
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