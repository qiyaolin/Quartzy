import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';
import { EASTERN_TIME_ZONE } from '../utils/timezone.ts';

// Group Meeting Types
export interface GroupMeeting {
    id: number;
    title: string;
    description?: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
    meeting_type: 'lab_meeting' | 'journal_club';
    topic: string;
    presenter_ids: number[];
    // Main presenter for display and operations (first presenter by default)
    presenter?: Presenter;
    presenters: Presenter[];
    materials_url?: string;
    materials_file?: string;
    materials_deadline?: string;
    is_materials_submitted?: boolean;
    attendees_count?: number;
    created_at: string;
    updated_at: string;
}

export interface Presenter {
    // User ID
    id: number;
    // Backend Presenter model record ID for swap/postpone operations
    presenter_record_id?: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
    last_presentation_date?: string;
    total_presentations: number;
    consecutive_weeks?: number;
}

export interface MeetingConfiguration {
    id: number;
    meeting_type: 'lab_meeting' | 'journal_club';
    title_template: string;
    default_duration_minutes: number;
    default_location: string; 
    default_day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
    default_time: string;
    materials_deadline_days?: number; // Days before meeting (for journal club)
    presenter_count: number; // 2 for lab meetings, 1 for journal club
    auto_generate_weeks_ahead: number;
    is_active: boolean;
    reminder_schedule: {
        presenter_reminder_days: number;
        materials_reminder_days?: number;
        pre_meeting_hours: number;
    };
    created_at: string;
    updated_at: string;
}

export interface RecurringTask {
    id: number;
    title: string;
    description: string;
    // Backend-compatible fields
    cron_schedule?: string;
    assignee_group?: User[]; // returned by backend serializer
    // Creation-time field for backend compatibility (IDs for rotation queue)
    assignee_group_ids?: number[];
    is_active?: boolean;
    // Legacy/UI fields (optional)
    task_type?: 'cell_culture_room_cleaning' | 'cell_culture_incubator_cleaning';
    frequency?: 'monthly' | 'quarterly';
    assignee_count?: number; // derived from assignee_group if missing
    location?: string;
    estimated_duration_hours?: number;
    auto_assign?: boolean;
    last_assigned_date?: string;
    last_assigned_user_ids?: number[];
    next_due_date?: string;
    created_at?: string;
    updated_at?: string;
}

export interface OneTimeTask {
    id: number;
    template_name: string;
    execution_start_date: string;
    execution_end_date: string; // deadline
    status: 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
    current_assignees: number[];
    assignment_metadata?: any;
}

export interface User {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
    role: string;
}

export interface PostponeRequest {
    meeting_id: number;
    new_date: string;
    reason: string;
    cascade_following_meetings: boolean;
}

export interface PresenterAssignment {
    meeting_id: number;
    presenter_ids: number[];
    assignment_date: string;
    assignment_method: 'automatic' | 'manual';
}

// Group Meeting API Service
export const groupMeetingApi = {
    // Meeting Management
    getMeetings: async (token: string, params?: { 
        start_date?: string; 
        end_date?: string; 
        meeting_type?: string; 
        status?: string;
    }): Promise<GroupMeeting[]> => {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });
        }
        
        const url = queryParams.toString() 
            ? `${buildApiUrl('/api/schedule/group-meetings/')}?${queryParams.toString()}`
            : buildApiUrl('/api/schedule/group-meetings/');
            
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch meetings: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    updateMeeting: async (token: string, id: number, meetingData: Partial<GroupMeeting>): Promise<GroupMeeting> => {
        const response = await fetch(buildApiUrl(`/api/group-meetings/${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update meeting: ${response.statusText}`);
        }
        
        return response.json();
    },

    postponeMeeting: async (token: string, postponeData: PostponeRequest): Promise<GroupMeeting[]> => {
        const response = await fetch(buildApiUrl('/api/group-meetings/postpone/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postponeData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to postpone meeting: ${response.statusText}`);
        }
        
        return response.json();
    },

    assignPresenters: async (token: string, assignment: PresenterAssignment): Promise<GroupMeeting> => {
        const response = await fetch(buildApiUrl('/api/group-meetings/assign-presenters/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assignment)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to assign presenters: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Configuration Management
    getConfigurations: async (token: string): Promise<MeetingConfiguration[]> => {
        const response = await fetch(buildApiUrl('/api/meeting-configurations/'), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch configurations: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    updateConfiguration: async (token: string, id: number, configData: Partial<MeetingConfiguration>): Promise<MeetingConfiguration> => {
        const response = await fetch(buildApiUrl(`/api/meeting-configurations/${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update configuration: ${response.statusText}`);
        }
        
        return response.json();
    },

    generateMeetings: async (token: string, configId: number): Promise<GroupMeeting[]> => {
        const response = await fetch(buildApiUrl(`/api/schedule/meeting-configuration/${configId}/generate-meetings/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to generate meetings: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Recurring Tasks Management
    getRecurringTasks: async (token: string): Promise<RecurringTask[]> => {
        const response = await fetch(buildApiUrl('/api/recurring-tasks/'), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch recurring tasks: ${response.statusText}`);
        }
        
        const data = await response.json();
        const tasks: RecurringTask[] = (data.results || data) as RecurringTask[];
        // Normalize: derive assignee_count from assignee_group when missing
        return tasks.map((t) => ({
            ...t,
            assignee_count: typeof t.assignee_count === 'number' 
                ? t.assignee_count 
                : Array.isArray(t.assignee_group) 
                    ? t.assignee_group.length 
                    : 0,
        }));
    },

    createRecurringTask: async (token: string, taskData: Partial<RecurringTask>): Promise<RecurringTask> => {
        // Always use enhanced system endpoint via compatibility view
        const res = await fetch(buildApiUrl('/api/recurring-tasks/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        if (!res.ok) {
            const contentType = res.headers.get('content-type') || '';
            const errBody = contentType.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
            const pick = (obj: any) => obj?.detail || obj?.error || obj?.message || obj?.title || res.statusText;
            const message = typeof errBody === 'string' ? errBody : pick(errBody);
            throw new Error(message);
        }
        return res.json();
    },

    assignRecurringTask: async (token: string, taskId: number, userIds: number[]): Promise<any> => {
        const response = await fetch(buildApiUrl(`/api/recurring-tasks/${taskId}/assign/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_ids: userIds })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to assign recurring task: ${response.statusText}`);
        }
        
        return response.json();
    },

    // User Management
    getActiveUsers: async (token: string): Promise<User[]> => {
        const response = await fetch(buildApiUrl('/api/users/active/'), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    // One-time tasks
    getOneTimeTasks: async (token: string): Promise<OneTimeTask[]> => {
        const response = await fetch(buildApiUrl('/api/one-time-tasks/'), {
            headers: { 'Authorization': `Token ${token}` }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch one-time tasks: ${response.statusText}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    },
    claimOneTimeTask: async (token: string, taskId: number): Promise<OneTimeTask> => {
        const response = await fetch(buildApiUrl(`/api/one-time-tasks/${taskId}/claim/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to claim task: ${response.statusText}`);
        }
        return response.json();
    },

    // Presenter Selection Logic
    selectPresenters: async (token: string, meetingType: 'lab_meeting' | 'journal_club', meetingDate: string): Promise<number[]> => {
        const response = await fetch(buildApiUrl('/api/presenters/select/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                meeting_type: meetingType, 
                meeting_date: meetingDate 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to select presenters: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.presenter_ids;
    },

    // Auto-generate recurring task instances for multiple months
    generateTaskInstances: async (token: string, taskId: number, months: number): Promise<any> => {
        const response = await fetch(buildApiUrl(`/api/tasks/generate/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                template_ids: [taskId],
                periods: Array.from({length: months}, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() + i);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                }),
                preview_only: false
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to generate task instances: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Enhanced auto-generation with rotation and user selection
    generateTasksWithRotation: async (token: string, config: {
        start_date: string;
        end_date: string;
        task_ids: number[];
        user_ids: number[];
        rotation_settings: {
            avoidConsecutive: boolean;
            maxAssignmentsPerPeriod: number;
            balanceWorkload: boolean;
        };
    }): Promise<{
        total_tasks_generated: number;
        assignments_created: number;
        rotation_summary: any[];
    }> => {
        const response = await fetch(buildApiUrl('/api/tasks/generate-with-rotation/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to generate tasks with rotation: ${response.statusText}`);
        }
        
        return response.json();
    }
};


// Helper functions
export const groupMeetingHelpers = {
    formatMeetingType: (type: string): string => {
        switch (type) {
            case 'lab_meeting':
                return 'Lab Meeting';
            case 'journal_club':
                return 'Journal Club';
            default:
                return type;
        }
    },

    getMeetingTypeColor: (type: string): string => {
        switch (type) {
            case 'lab_meeting':
                return 'bg-blue-100 text-blue-800';
            case 'journal_club':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    },

    isOverdue: (deadline: string): boolean => {
        return new Date(deadline) < new Date();
    },

    getNextMeetingDate: (lastDate: string, weeksToAdd: number = 1): string => {
        const date = new Date(lastDate);
        date.setDate(date.getDate() + (weeksToAdd * 7));
        return date.toISOString().split('T')[0];
    },

    validateConsecutiveWeeks: (presenterId: number, meetingDate: string, previousMeetings: GroupMeeting[]): boolean => {
        const date = new Date(meetingDate);
        const previousWeek = new Date(date);
        previousWeek.setDate(date.getDate() - 7);
        const nextWeek = new Date(date);
        nextWeek.setDate(date.getDate() + 7);
        
        const previousWeekStr = previousWeek.toISOString().split('T')[0];
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        
        // Check if presenter is assigned to previous or next week
        const hasConflict = previousMeetings.some(meeting => 
            (meeting.date === previousWeekStr || meeting.date === nextWeekStr) &&
            meeting.presenter_ids.includes(presenterId)
        );
        
        return !hasConflict;
    },

    getStatusColor: (status: string): string => {
        switch (status) {
            case 'scheduled':
                return 'bg-blue-100 text-blue-800';
            case 'in_progress':
                return 'bg-yellow-100 text-yellow-800';
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            case 'postponed':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    },

    formatScheduleDate: (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            timeZone: EASTERN_TIME_ZONE,
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    },

    formatScheduleTime: (startTime: string, endTime?: string): string => {
        const formatTime = (timeString: string) => {
            const [hours, minutes] = timeString.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        if (endTime) {
            return `${formatTime(startTime)} - ${formatTime(endTime)}`;
        }
        return formatTime(startTime);
    }
};