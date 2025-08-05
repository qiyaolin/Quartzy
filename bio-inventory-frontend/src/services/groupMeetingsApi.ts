import { buildApiUrl } from '../config/api.ts';

// Enhanced Group Meetings API Service
export interface GroupMeeting {
    id: number;
    title: string;
    description?: string;
    date: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
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
    next_scheduled?: string;
    position_in_rotation?: number;
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
    admin_notes?: string;
}

export interface EmailReminder {
    id: number;
    meeting_id: number;
    reminder_type: 'pre_meeting' | 'materials_submission' | 'presenter_assignment';
    sent_at: string;
    recipients: string[];
    subject: string;
    content: string;
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
    created_at: string;
    updated_at: string;
}

export interface AutoGenerationSettings {
    enable_auto_generation: boolean;
    research_update_config: MeetingConfiguration;
    journal_club_config: MeetingConfiguration;
    rotation_pattern: 'alternating' | 'separate_weeks' | 'custom';
    skip_holidays: boolean;
    holiday_list?: string[];
}

// Group Meetings API Service
export const groupMeetingsApi = {
    // Get all group meetings
    getGroupMeetings: async (token: string, params: any = {}): Promise<GroupMeeting[]> => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value as string);
        });
        
        const url = queryParams.toString() 
            ? `${buildApiUrl('schedule/group-meetings/')}?${queryParams.toString()}`
            : buildApiUrl('schedule/group-meetings/');
            
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.info('Group meetings API endpoint not implemented yet, returning empty data');
                return [];
            }
            throw new Error(`Failed to fetch group meetings: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    // Create new group meeting
    createGroupMeeting: async (token: string, meetingData: Partial<GroupMeeting>): Promise<GroupMeeting> => {
        const response = await fetch(buildApiUrl('schedule/group-meetings/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create group meeting: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Update group meeting
    updateGroupMeeting: async (token: string, id: number, meetingData: Partial<GroupMeeting>): Promise<GroupMeeting> => {
        const response = await fetch(buildApiUrl(`schedule/group-meetings/${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update group meeting: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Auto-generate meetings based on configuration
    autoGenerateMeetings: async (token: string, settings: AutoGenerationSettings): Promise<GroupMeeting[]> => {
        const response = await fetch(buildApiUrl('schedule/group-meetings/auto-generate/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to auto-generate meetings: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Upload materials for journal club
    uploadMaterials: async (token: string, meetingId: number, file: File, url?: string): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        if (url) formData.append('url', url);
        
        const response = await fetch(buildApiUrl(`schedule/group-meetings/${meetingId}/upload-materials/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to upload materials: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Send email reminders
    sendEmailReminder: async (token: string, meetingId: number, reminderType: string): Promise<EmailReminder> => {
        const response = await fetch(buildApiUrl(`schedule/group-meetings/${meetingId}/send-reminder/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reminder_type: reminderType })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to send email reminder: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Presenters API Service
export const presentersApi = {
    // Get all presenters
    getPresenters: async (token: string, params: any = {}): Promise<Presenter[]> => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value as string);
        });
        
        const url = queryParams.toString() 
            ? `${buildApiUrl('schedule/presenters/')}?${queryParams.toString()}`
            : buildApiUrl('schedule/presenters/');
            
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.info('Presenters API endpoint not implemented yet, returning empty data');
                return [];
            }
            throw new Error(`Failed to fetch presenters: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    // Create presenter
    createPresenter: async (token: string, presenterData: Partial<Presenter>): Promise<Presenter> => {
        const response = await fetch(buildApiUrl('schedule/presenters/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(presenterData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create presenter: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Update presenter
    updatePresenter: async (token: string, id: number, presenterData: Partial<Presenter>): Promise<Presenter> => {
        const response = await fetch(buildApiUrl(`schedule/presenters/${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(presenterData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update presenter: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Rotation Lists API Service
export const rotationListsApi = {
    // Get all rotation lists
    getRotationLists: async (token: string): Promise<RotationList[]> => {
        const response = await fetch(buildApiUrl('schedule/rotation-lists/'), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.info('Rotation lists API endpoint not implemented yet, returning empty data');
                return [];
            }
            throw new Error(`Failed to fetch rotation lists: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    // Create rotation list
    createRotationList: async (token: string, rotationData: Partial<RotationList>): Promise<RotationList> => {
        const response = await fetch(buildApiUrl('schedule/rotation-lists/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(rotationData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create rotation list: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Update rotation list
    updateRotationList: async (token: string, id: number, rotationData: Partial<RotationList>): Promise<RotationList> => {
        const response = await fetch(buildApiUrl(`schedule/rotation-lists/${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(rotationData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update rotation list: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Advance rotation (move to next presenter)
    advanceRotation: async (token: string, id: number): Promise<RotationList> => {
        const response = await fetch(buildApiUrl(`schedule/rotation-lists/${id}/advance/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to advance rotation: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Swap Requests API Service
export const swapRequestsApi = {
    // Get all swap requests
    getSwapRequests: async (token: string, params: any = {}): Promise<SwapRequest[]> => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value as string);
        });
        
        const url = queryParams.toString() 
            ? `${buildApiUrl('schedule/swap-requests/')}?${queryParams.toString()}`
            : buildApiUrl('schedule/swap-requests/');
            
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.info('Swap requests API endpoint not implemented yet, returning empty data');
                return [];
            }
            throw new Error(`Failed to fetch swap requests: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    // Create swap request
    createSwapRequest: async (token: string, swapData: Partial<SwapRequest>): Promise<SwapRequest> => {
        const response = await fetch(buildApiUrl('schedule/swap-requests/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(swapData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create swap request: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Approve/reject swap request
    reviewSwapRequest: async (token: string, id: number, action: 'approve' | 'reject', notes?: string): Promise<SwapRequest> => {
        const response = await fetch(buildApiUrl(`schedule/swap-requests/${id}/review/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, admin_notes: notes })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to review swap request: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Meeting Configuration API Service
export const meetingConfigApi = {
    // Get meeting configurations
    getConfigurations: async (token: string): Promise<MeetingConfiguration[]> => {
        const response = await fetch(buildApiUrl('schedule/meeting-config/'), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.info('Meeting config API endpoint not implemented yet, returning empty data');
                return [];
            }
            throw new Error(`Failed to fetch meeting configurations: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.results || data;
    },

    // Update meeting configuration
    updateConfiguration: async (token: string, id: number, configData: Partial<MeetingConfiguration>): Promise<MeetingConfiguration> => {
        const response = await fetch(buildApiUrl(`schedule/meeting-config/${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update meeting configuration: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Email Notifications Integration
export const emailNotificationApi = {
    // Send custom notification (integrates with existing email system)
    sendNotification: async (token: string, notificationData: {
        recipients: string[];
        subject: string;
        template: string;
        context: Record<string, any>;
    }): Promise<any> => {
        // This would integrate with the existing email notification system
        // For now, we'll use a generic endpoint that would route to the existing system
        const response = await fetch(buildApiUrl('notifications/send/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notificationData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to send notification: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Schedule notification for future delivery
    scheduleNotification: async (token: string, notificationData: {
        recipients: string[];
        subject: string;
        template: string;
        context: Record<string, any>;
        scheduled_for: string; // ISO datetime string
    }): Promise<any> => {
        const response = await fetch(buildApiUrl('notifications/schedule/'), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notificationData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to schedule notification: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Helper functions for group meetings
export const groupMeetingsHelpers = {
    // Generate meeting title based on type and topic
    generateMeetingTitle: (meetingType: string, topic: string): string => {
        const typeLabels = {
            research_update: 'Research Update',
            journal_club: 'Journal Club',
            general: 'Group Meeting'
        };
        
        return `${typeLabels[meetingType as keyof typeof typeLabels] || 'Meeting'}: ${topic}`;
    },

    // Calculate materials deadline
    calculateMaterialsDeadline: (meetingDate: string, daysBefore: number): string => {
        const date = new Date(meetingDate);
        date.setDate(date.getDate() - daysBefore);
        return date.toISOString().split('T')[0];
    },

    // Get next presenter in rotation
    getNextPresenter: (rotation: RotationList): Presenter | null => {
        if (!rotation.presenters.length) return null;
        
        const nextIndex = (rotation.current_presenter_index + 1) % rotation.presenters.length;
        return rotation.presenters[nextIndex];
    },

    // Check if materials are overdue
    isMaterialsOverdue: (meeting: GroupMeeting): boolean => {
        if (meeting.meeting_type !== 'journal_club' || meeting.is_materials_submitted) {
            return false;
        }
        
        if (!meeting.materials_deadline) return false;
        
        return new Date(meeting.materials_deadline) < new Date();
    },

    // Get meeting status color
    getMeetingStatusColor: (meeting: GroupMeeting): string => {
        if (meeting.meeting_type === 'journal_club' && !meeting.is_materials_submitted) {
            const isOverdue = groupMeetingsHelpers.isMaterialsOverdue(meeting);
            if (isOverdue) return 'bg-red-100 text-red-800';
            return 'bg-yellow-100 text-yellow-800';
        }
        
        const colors: Record<string, string> = {
            scheduled: 'bg-blue-100 text-blue-800',
            in_progress: 'bg-yellow-100 text-yellow-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        };
        
        return colors[meeting.status] || colors.scheduled;
    },

    // Validate meeting data
    validateGroupMeeting: (meeting: Partial<GroupMeeting>): { isValid: boolean; errors: Record<string, string> } => {
        const errors: Record<string, string> = {};
        
        if (!meeting.title?.trim()) {
            errors.title = 'Title is required';
        }
        
        if (!meeting.topic?.trim()) {
            errors.topic = 'Topic is required';
        }
        
        if (!meeting.date) {
            errors.date = 'Date is required';
        }
        
        if (!meeting.start_time) {
            errors.start_time = 'Start time is required';
        }
        
        if (!meeting.end_time) {
            errors.end_time = 'End time is required';
        }
        
        if (meeting.start_time && meeting.end_time && meeting.start_time >= meeting.end_time) {
            errors.time = 'End time must be after start time';
        }
        
        // Journal club specific validation
        if (meeting.meeting_type === 'journal_club' && !meeting.materials_url && !meeting.materials_file && !meeting.is_materials_submitted) {
            errors.materials = 'Journal club meetings require materials (URL or file)';
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
};