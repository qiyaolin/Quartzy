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
            if (response.status === 404) {
                console.info('Group meetings API not implemented yet, returning mock data');
                return generateMockMeetings();
            }
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
            if (response.status === 404) {
                console.info('Meeting configurations API not implemented yet, returning mock data');
                return generateMockConfigurations();
            }
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
            if (response.status === 404) {
                console.info('Recurring tasks API not implemented yet, returning mock data');
                return generateMockRecurringTasks();
            }
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
            if (response.status === 404) {
                console.info('Users API not implemented yet, returning mock data');
                return generateMockUsers();
            }
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
            if (response.status === 404) {
                console.info('Presenter selection API not implemented yet, using client-side logic');
                return selectPresentersClientSide(meetingType, meetingDate);
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to select presenters: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.presenter_ids;
    }
};

// Mock Data Generators for Development
function generateMockUsers(): User[] {
    return [
        { id: 1, username: 'alice.johnson', first_name: 'Alice', last_name: 'Johnson', email: 'alice@lab.com', is_active: true, role: 'researcher' },
        { id: 2, username: 'bob.smith', first_name: 'Bob', last_name: 'Smith', email: 'bob@lab.com', is_active: true, role: 'researcher' },
        { id: 3, username: 'carol.davis', first_name: 'Carol', last_name: 'Davis', email: 'carol@lab.com', is_active: true, role: 'researcher' },
        { id: 4, username: 'david.wilson', first_name: 'David', last_name: 'Wilson', email: 'david@lab.com', is_active: true, role: 'researcher' },
        { id: 5, username: 'eve.brown', first_name: 'Eve', last_name: 'Brown', email: 'eve@lab.com', is_active: true, role: 'researcher' },
        { id: 6, username: 'frank.miller', first_name: 'Frank', last_name: 'Miller', email: 'frank@lab.com', is_active: true, role: 'researcher' }
    ];
}

function generateMockConfigurations(): MeetingConfiguration[] {
    return [
        {
            id: 1,
            meeting_type: 'lab_meeting',
            title_template: 'Lab Meeting - Week {week}',
            default_duration_minutes: 90,
            default_location: 'Conference Room A',
            default_day_of_week: 5, // Friday
            default_time: '14:00',
            presenter_count: 2,
            auto_generate_weeks_ahead: 12,
            is_active: true,
            reminder_schedule: {
                presenter_reminder_days: 3,
                pre_meeting_hours: 2
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 2,
            meeting_type: 'journal_club',
            title_template: 'Journal Club - Week {week}',
            default_duration_minutes: 60,
            default_location: 'Conference Room A',
            default_day_of_week: 5, // Friday
            default_time: '15:30',
            materials_deadline_days: 7,
            presenter_count: 1,
            auto_generate_weeks_ahead: 12,
            is_active: true,
            reminder_schedule: {
                presenter_reminder_days: 3,
                materials_reminder_days: 1,
                pre_meeting_hours: 2
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];
}

function generateMockMeetings(): GroupMeeting[] {
    const meetings: GroupMeeting[] = [];
    const today = new Date();
    const mockUsers = generateMockUsers();
    
    // Generate meetings for next 12 weeks alternating between lab meetings and journal clubs
    for (let i = 0; i < 12; i++) {
        const meetingDate = new Date(today);
        meetingDate.setDate(today.getDate() + (i * 7)); // Weekly meetings
        
        const isLabMeeting = i % 2 === 0;
        const meetingType = isLabMeeting ? 'lab_meeting' : 'journal_club';
        
        // Select presenters based on meeting type
        const selectedPresenters = isLabMeeting 
            ? [mockUsers[i % mockUsers.length], mockUsers[(i + 1) % mockUsers.length]]
            : [mockUsers[i % mockUsers.length]];
        
        const meeting: GroupMeeting = {
            id: 1000 + i,
            title: `${isLabMeeting ? 'Lab Meeting' : 'Journal Club'} - Week ${i + 1}`,
            description: isLabMeeting 
                ? 'Weekly research progress presentations and discussions'
                : 'Journal article discussion and literature review',
            date: meetingDate.toISOString().split('T')[0],
            start_time: isLabMeeting ? '14:00' : '15:30',
            end_time: isLabMeeting ? '15:30' : '16:30',
            location: 'Conference Room A',
            status: 'scheduled',
            meeting_type: meetingType,
            topic: isLabMeeting 
                ? `Research Progress Updates`
                : 'Recent Advances in Cell Biology',
            presenter_ids: selectedPresenters.map(p => p.id),
            presenters: selectedPresenters.map(user => ({
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                is_active: user.is_active,
                total_presentations: Math.floor(Math.random() * 20),
                last_presentation_date: i > 0 ? new Date(meetingDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined
            })),
            is_materials_submitted: !isLabMeeting ? Math.random() > 0.3 : undefined,
            materials_deadline: !isLabMeeting 
                ? new Date(meetingDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                : undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        meetings.push(meeting);
    }
    
    return meetings;
}

function generateMockRecurringTasks(): RecurringTask[] {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    
    const nextQuarter = new Date();
    nextQuarter.setMonth(Math.floor(nextQuarter.getMonth() / 3) * 3 + 3);
    nextQuarter.setDate(1);
    
    return [
        {
            id: 1,
            title: 'Cell Culture Room Cleaning',
            description: 'Monthly deep cleaning of cell culture facilities including benches, incubators, and storage areas',
            task_type: 'cell_culture_room_cleaning',
            frequency: 'monthly',
            assignee_count: 2,
            location: 'Cell Culture Room',
            estimated_duration_hours: 4,
            auto_assign: true,
            next_due_date: nextMonth.toISOString().split('T')[0],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 2,
            title: 'Cell Culture Incubator Cleaning',
            description: 'Quarterly maintenance and deep cleaning of cell culture incubators',
            task_type: 'cell_culture_incubator_cleaning',
            frequency: 'quarterly',
            assignee_count: 1,
            location: 'Cell Culture Room - Incubators',
            estimated_duration_hours: 2,
            auto_assign: true,
            next_due_date: nextQuarter.toISOString().split('T')[0],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];
}

// Client-side presenter selection logic (fallback when API not available)
async function selectPresentersClientSide(meetingType: 'lab_meeting' | 'journal_club', meetingDate: string): Promise<number[]> {
    const users = generateMockUsers();
    const eligibleUsers = users.filter(u => u.username !== 'admin' && u.username !== 'print_server' && u.is_active);
    
    const presenterCount = meetingType === 'lab_meeting' ? 2 : 1;
    const selectedIds: number[] = [];
    
    // Simple rotation logic - in real implementation, this would check previous assignments
    // and avoid consecutive weeks for same presenter
    const startIndex = Math.floor(Math.random() * eligibleUsers.length);
    
    for (let i = 0; i < presenterCount; i++) {
        const userIndex = (startIndex + i) % eligibleUsers.length;
        selectedIds.push(eligibleUsers[userIndex].id);
    }
    
    return selectedIds;
}

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