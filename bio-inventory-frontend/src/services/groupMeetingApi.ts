import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

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
    presenters: Presenter[];
    materials_url?: string;
    materials_file?: string;
    materials_deadline?: string;
    is_materials_submitted?: boolean;
    created_at: string;
    updated_at: string;
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
    task_type: 'cell_culture_room_cleaning' | 'cell_culture_incubator_cleaning';
    frequency: 'monthly' | 'quarterly';
    assignee_count: number; // 2 for room cleaning, 1 for incubator
    location: string;
    estimated_duration_hours: number;
    auto_assign: boolean;
    last_assigned_date?: string;
    last_assigned_user_ids?: number[];
    next_due_date: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
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
            ? `${buildApiUrl('/api/group-meetings/')}?${queryParams.toString()}`
            : buildApiUrl('/api/group-meetings/');
            
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
        const response = await fetch(buildApiUrl(`/api/meeting-configurations/${configId}/generate-meetings/`), {
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
        return data.results || data;
    },

    createRecurringTask: async (token: string, taskData: Partial<RecurringTask>): Promise<RecurringTask> => {
        const response = await fetch(buildApiUrl('/api/recurring-tasks/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create recurring task: ${response.statusText}`);
        }
        
        return response.json();
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
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    },

    formatScheduleTime: (startTime: string, endTime?: string): string => {
        const formatTime = (timeString: string) => {
            const [hours, minutes] = timeString.split(':');
            const date = new Date();
            date.setHours(parseInt(hours), parseInt(minutes));
            return date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        };

        if (endTime) {
            return `${formatTime(startTime)} - ${formatTime(endTime)}`;
        }
        return formatTime(startTime);
    }
};