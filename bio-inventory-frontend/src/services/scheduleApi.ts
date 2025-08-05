import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

// Schedule Types
export interface Schedule {
  id: number;
  title: string;
  description?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attendees_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleFormData {
  title: string;
  description?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface ScheduleParams {
  date?: string;
  view?: 'day' | 'week' | 'month';
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface ScheduleStats {
  total_schedules: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

// Schedule API Service
export const scheduleApi = {
  // Get all schedules
  getSchedules: async (token: string, params: ScheduleParams = {}): Promise<Schedule[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl(API_ENDPOINTS.SCHEDULES)}?${queryParams.toString()}`
      : buildApiUrl(API_ENDPOINTS.SCHEDULES);
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      // Handle 404 as "endpoint not implemented yet" - return empty array
      if (response.status === 404) {
        console.info('Schedule API endpoint not implemented yet, returning empty data');
        return [];
      }
      throw new Error(`Failed to fetch schedules: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  // Get schedule by ID
  getSchedule: async (token: string, id: number): Promise<Schedule> => {
    const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}${id}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Create new schedule
  createSchedule: async (token: string, scheduleData: ScheduleFormData): Promise<Schedule> => {
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
  updateSchedule: async (token: string, id: number, scheduleData: ScheduleFormData): Promise<Schedule> => {
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
  deleteSchedule: async (token: string, id: number): Promise<void> => {
    const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}${id}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete schedule: ${response.statusText}`);
    }
  },

  // Get schedules by date range
  getSchedulesByDateRange: async (token: string, startDate: string, endDate: string): Promise<Schedule[]> => {
    const params: ScheduleParams = {
      start_date: startDate,
      end_date: endDate
    };
    return scheduleApi.getSchedules(token, params);
  },

  // Get today's schedules
  getTodaySchedules: async (token: string): Promise<Schedule[]> => {
    const today = new Date().toISOString().split('T')[0];
    const params: ScheduleParams = {
      date: today
    };
    return scheduleApi.getSchedules(token, params);
  },

  // Get schedules by status
  getSchedulesByStatus: async (token: string, status: string): Promise<Schedule[]> => {
    const params: ScheduleParams = {
      status: status
    };
    return scheduleApi.getSchedules(token, params);
  },

  // Search schedules
  searchSchedules: async (token: string, searchTerm: string): Promise<Schedule[]> => {
    const params: ScheduleParams = {
      search: searchTerm
    };
    return scheduleApi.getSchedules(token, params);
  },

  // Update schedule status
  updateScheduleStatus: async (token: string, id: number, status: string): Promise<Schedule> => {
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
  getScheduleStats: async (token: string): Promise<ScheduleStats> => {
    const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}stats/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule statistics: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Initialize default schedules (meetings and tasks)
  initializeDefaultSchedules: async (token: string): Promise<Schedule[]> => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}initialize_defaults/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize default schedules: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Failed to initialize default schedules:', error);
      throw error;
    }
  }
};

// Equipment Types and API
export interface Equipment {
  id: number;
  name: string;
  description?: string;
  is_bookable: boolean;
  requires_qr_checkin: boolean;
  location: string;
  qr_code?: string;
  current_user?: {
    username: string;
    first_name?: string;
    last_name?: string;
  };
  current_checkin_time?: string;
  is_in_use: boolean;
  current_usage_duration?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentUsageLog {
  id: number;
  equipment: Equipment;
  user: {
    username: string;
    first_name?: string;
    last_name?: string;
  };
  booking?: any;
  check_in_time: string;
  check_out_time?: string;
  usage_duration?: string;
  current_duration?: string;
  qr_scan_method: 'mobile_camera' | 'desktop_webcam' | 'manual_entry';
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QRScanRequest {
  qr_code: string;
  scan_method?: 'mobile_camera' | 'desktop_webcam' | 'manual_entry';
  notes?: string;
}

// Equipment API Service
export const equipmentApi = {
  // Get all equipment
  getEquipment: async (token: string, params: any = {}): Promise<Equipment[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value as string);
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('schedule/equipment/')}?${queryParams.toString()}`
      : buildApiUrl('schedule/equipment/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.info('Equipment API endpoint not implemented yet, returning empty data');
        return [];
      }
      throw new Error(`Failed to fetch equipment: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  // Get equipment by ID
  getEquipmentById: async (token: string, id: number): Promise<Equipment> => {
    const response = await fetch(buildApiUrl(`schedule/equipment/${id}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch equipment: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Create new equipment
  createEquipment: async (token: string, equipmentData: Omit<Equipment, 'id' | 'created_at' | 'updated_at' | 'is_in_use' | 'current_user' | 'current_checkin_time' | 'current_usage_duration'>): Promise<Equipment> => {
    const response = await fetch(buildApiUrl('schedule/equipment/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(equipmentData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create equipment: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Update equipment
  updateEquipment: async (token: string, id: number, equipmentData: Partial<Equipment>): Promise<Equipment> => {
    const response = await fetch(buildApiUrl(`schedule/equipment/${id}/`), {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(equipmentData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update equipment: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Delete equipment
  deleteEquipment: async (token: string, id: number): Promise<void> => {
    const response = await fetch(buildApiUrl(`schedule/equipment/${id}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete equipment: ${response.statusText}`);
    }
  },

  // QR Code check-in
  qrCheckin: async (token: string, qrData: QRScanRequest): Promise<any> => {
    const response = await fetch(buildApiUrl('schedule/equipment/qr_checkin/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(qrData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to check in: ${response.statusText}`);
    }
    
    return response.json();
  },

  // QR Code check-out
  qrCheckout: async (token: string, qrData: QRScanRequest): Promise<any> => {
    const response = await fetch(buildApiUrl('schedule/equipment/qr_checkout/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(qrData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to check out: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get equipment QR code
  getEquipmentQR: async (token: string, equipmentId: number): Promise<any> => {
    const response = await fetch(buildApiUrl(`schedule/equipment/${equipmentId}/qr_code/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to get QR code: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get equipment usage logs
  getUsageLogs: async (token: string, equipmentId: number, params: any = {}): Promise<EquipmentUsageLog[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value as string);
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl(`schedule/equipment/${equipmentId}/usage_logs/`)}?${queryParams.toString()}`
      : buildApiUrl(`schedule/equipment/${equipmentId}/usage_logs/`);
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch usage logs: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.usage_logs || [];
  },

  // Get equipment current status
  getCurrentStatus: async (token: string, equipmentId: number): Promise<any> => {
    const response = await fetch(buildApiUrl(`schedule/equipment/${equipmentId}/current_status/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch current status: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get equipment availability
  getAvailability: async (token: string, equipmentId: number, startDate: string, endDate: string): Promise<any> => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
    
    const response = await fetch(buildApiUrl(`schedule/equipment/${equipmentId}/availability/?${params.toString()}`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch availability: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Initialize default equipment
  initializeDefaultEquipment: async (token: string): Promise<Equipment[]> => {
    try {
      const response = await fetch(buildApiUrl('schedule/equipment/initialize_defaults/'), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize default equipment: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Failed to initialize default equipment:', error);
      throw error;
    }
  }
};

// Helper functions
export const scheduleHelpers = {
  // Format schedule time for display
  formatScheduleTime: (startTime: string | null, endTime: string | null = null): string => {
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
  formatScheduleDate: (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Get status display color
  getStatusColor: (status: string): string => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.pending;
  },

  // Check if schedule is today
  isToday: (dateString: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  },

  // Check if schedule is past
  isPast: (dateString: string, timeString: string | null = null): boolean => {
    const now = new Date();
    const scheduleDate = new Date(dateString);
    
    if (timeString) {
      const [hours, minutes] = timeString.split(':');
      scheduleDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    return scheduleDate < now;
  },

  // Get time until schedule
  getTimeUntil: (dateString: string, timeString: string | null): string => {
    const now = new Date();
    const scheduleDate = new Date(dateString);
    
    if (timeString) {
      const [hours, minutes] = timeString.split(':');
      scheduleDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const diff = scheduleDate.getTime() - now.getTime();
    
    if (diff < 0) return 'Past';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  // Validate schedule data
  validateScheduleData: (data: ScheduleFormData): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    
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