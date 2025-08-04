import { buildApiUrl, API_ENDPOINTS } from '../config/api';

// Schedule API Service - JavaScript Style (Compatible with stable version)
export const scheduleApi = {
    // Get all schedules
    getSchedules: async (token, params = {}) => {
        const queryParams = new URLSearchParams(params).toString();
        const url = queryParams 
            ? `${buildApiUrl(API_ENDPOINTS.SCHEDULES)}?${queryParams}`
            : buildApiUrl(API_ENDPOINTS.SCHEDULES);
            
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch schedules: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Get schedule by ID
    getSchedule: async (token, id) => {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}${id}/`), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Create new schedule
    createSchedule: async (token, scheduleData) => {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.SCHEDULES), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create schedule: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Update schedule
    updateSchedule: async (token, id, scheduleData) => {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}${id}/`), {
            method: 'PUT',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update schedule: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Delete schedule
    deleteSchedule: async (token, id) => {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}${id}/`), {
            method: 'DELETE',
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete schedule: ${response.statusText}`);
        }
        
        return true;
    },

    // Get schedules by date range
    getSchedulesByDateRange: async (token, startDate, endDate) => {
        const params = {
            start_date: startDate,
            end_date: endDate
        };
        return scheduleApi.getSchedules(token, params);
    },

    // Get today's schedules
    getTodaySchedules: async (token) => {
        const today = new Date().toISOString().split('T')[0];
        const params = {
            date: today
        };
        return scheduleApi.getSchedules(token, params);
    },

    // Get schedules by status
    getSchedulesByStatus: async (token, status) => {
        const params = {
            status: status
        };
        return scheduleApi.getSchedules(token, params);
    },

    // Search schedules
    searchSchedules: async (token, searchTerm) => {
        const params = {
            search: searchTerm
        };
        return scheduleApi.getSchedules(token, params);
    },

    // Update schedule status
    updateScheduleStatus: async (token, id, status) => {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}${id}/status/`), {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update schedule status: ${response.statusText}`);
        }
        
        return response.json();
    },

    // Get schedule statistics
    getScheduleStats: async (token) => {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}stats/`), {
            headers: { 'Authorization': `Token ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule statistics: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Helper functions
export const scheduleHelpers = {
    // Format schedule time for display
    formatScheduleTime: (startTime, endTime = null) => {
        if (!startTime) return '';
        
        const start = new Date(`2000-01-01T${startTime}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        if (endTime) {
            const end = new Date(`2000-01-01T${endTime}`).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            return `${start} - ${end}`;
        }
        
        return start;
    },

    // Format schedule date for display
    formatScheduleDate: (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Get status display color
    getStatusColor: (status) => {
        const colors = {
            scheduled: 'bg-blue-100 text-blue-800',
            in_progress: 'bg-yellow-100 text-yellow-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
            pending: 'bg-gray-100 text-gray-800'
        };
        return colors[status] || colors.pending;
    },

    // Check if schedule is today
    isToday: (dateString) => {
        const today = new Date().toISOString().split('T')[0];
        return dateString === today;
    },

    // Check if schedule is past
    isPast: (dateString, timeString = null) => {
        const now = new Date();
        const scheduleDate = new Date(dateString);
        
        if (timeString) {
            const [hours, minutes] = timeString.split(':');
            scheduleDate.setHours(parseInt(hours), parseInt(minutes));
        }
        
        return scheduleDate < now;
    },

    // Get time until schedule
    getTimeUntil: (dateString, timeString) => {
        const now = new Date();
        const scheduleDate = new Date(dateString);
        
        if (timeString) {
            const [hours, minutes] = timeString.split(':');
            scheduleDate.setHours(parseInt(hours), parseInt(minutes));
        }
        
        const diff = scheduleDate - now;
        
        if (diff < 0) return 'Past';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    // Validate schedule data
    validateScheduleData: (data) => {
        const errors = {};
        
        if (!data.title || data.title.trim() === '') {
            errors.title = 'Title is required';
        }
        
        if (!data.date) {
            errors.date = 'Date is required';
        }
        
        if (data.start_time && data.end_time) {
            if (data.start_time >= data.end_time) {
                errors.time = 'End time must be after start time';
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
};