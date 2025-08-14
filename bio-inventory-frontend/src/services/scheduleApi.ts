import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';
import { EASTERN_TIME_ZONE, formatTimeET, formatDateET, formatDateTimeET, getCurrentDateET } from '../utils/timezone.ts';

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
  event_type?: 'meeting' | 'booking' | 'task' | 'equipment' | 'personal';
  attendees_count?: number;
  // Optional fields that may be present depending on event type
  equipment?: string | { id?: number; name: string; location?: string };
  assigned_user?: string;
  created_by?: { id?: number; username?: string; first_name?: string; last_name?: string };
  created_at: string;
  updated_at: string;
}

// Intelligent Meeting Management Types
export interface MeetingConfiguration {
  id: number;
  day_of_week: number; // 0-6, 0=Sunday
  start_time: string; // "10:00"
  location: string;
  research_update_duration: number;
  journal_club_duration: number;
  jc_submission_deadline_days: number;
  jc_final_deadline_days: number;
  require_admin_approval: boolean;
  default_postpone_strategy: 'skip' | 'cascade';
  active_members: User[];
}

export interface User {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email: string;
}

export interface MeetingInstance {
  id: number;
  date: string;
  meeting_type: 'research_update' | 'journal_club';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  presenters: Presenter[];
  actual_duration?: number;
  notes?: string;
  event?: any;
}

export interface Presenter {
  id: number;
  user: User;
  meeting_instance: number;
  order: number;
  status: 'assigned' | 'confirmed' | 'completed' | 'swapped' | 'postponed';
  topic?: string;
  paper_title?: string;
  paper_url?: string;
  paper_file?: string;
  materials_submitted_at?: string;
}

export interface SwapRequest {
  id: number;
  request_type: 'swap' | 'postpone';
  requester: User;
  original_presentation: Presenter;
  target_presentation?: Presenter;
  target_date?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  cascade_effect?: 'skip' | 'cascade';
  created_at: string;
  updated_at: string;
}

export interface AdminDashboardData {
  meeting_statistics: {
    total_meetings: number;
    meetings_this_month: number;
    upcoming_meetings: number;
  };
  pending_items: {
    swap_requests: number;
    missing_jc_submissions: number;
  };
  equipment_status: {
    active_equipment: number;
    total_equipment: number;
    utilization_rate: number;
  };
  recent_activity: SwapRequest[];
}

export interface PersonalDashboardData {
  next_presentation?: Presenter;
  upcoming_meetings: MeetingInstance[];
  swap_requests: SwapRequest[];
  jc_deadlines: Array<{
    presentation_id: number;
    meeting_date: string;
    deadline: string;
    final_deadline: string;
    days_remaining: number;
    urgency: string;
  }>;
  today_equipment_bookings: Array<{
    id: number;
    equipment_name: string;
    start_time: string;
    end_time: string;
    status: string;
  }>;
  statistics: {
    presentations_this_year: number;
    active_swap_requests: number;
  };
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
    const today = getCurrentDateET();
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
  location: string;
  current_user?: {
    username: string;
    first_name?: string;
    last_name?: string;
  };
  current_checkin_time?: string;
  is_in_use: boolean;
  current_usage_duration?: string;
  current_booking?: {
    id: number;
    start_time: string;
    end_time: string;
    status: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: number;
  start_time: string;
  end_time: string;
  user: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress';
  title: string;
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


// Equipment API Service
export const equipmentApi = {
  // Get all equipment
  getEquipment: async (token: string, params: any = {}): Promise<Equipment[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value as string);
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/equipment/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/equipment/');
      
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
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${id}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch equipment: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Check in by equipment ID (button-based, no QR)
  checkIn: async (token: string, equipmentId: number): Promise<any> => {
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${equipmentId}/checkin/`), {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to check in: ${response.statusText}`);
    }
    return response.json();
  },

  // Check out by equipment ID (button-based, no QR)
  checkOut: async (token: string, equipmentId: number): Promise<any> => {
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${equipmentId}/checkout/`), {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to check out: ${response.statusText}`);
    }
    return response.json();
  },

  // Create new equipment
  createEquipment: async (token: string, equipmentData: Omit<Equipment, 'id' | 'created_at' | 'updated_at' | 'is_in_use' | 'current_user' | 'current_checkin_time' | 'current_usage_duration'>): Promise<Equipment> => {
    const response = await fetch(buildApiUrl('/api/schedule/equipment/'), {
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
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${id}/`), {
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
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${id}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete equipment: ${response.statusText}`);
    }
  },


  // Get equipment usage logs
  getUsageLogs: async (token: string, equipmentId: number, params: any = {}): Promise<EquipmentUsageLog[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value as string);
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl(`api/schedule/equipment/${equipmentId}/usage_logs/`)}?${queryParams.toString()}`
      : buildApiUrl(`api/schedule/equipment/${equipmentId}/usage_logs/`);
      
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
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${equipmentId}/current_status/`), {
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
    
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${equipmentId}/availability/?${params.toString()}`), {
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
      const response = await fetch(buildApiUrl('/api/schedule/equipment/initialize_defaults/'), {
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
  },

  // Equipment Booking Functions
  quickBookEquipment: async (token: string, bookingData: {
    equipment_id: number;
    duration_minutes?: number;
    start_time?: string;
    auto_checkin?: boolean;
  }): Promise<any> => {
    const response = await fetch(buildApiUrl('/api/schedule/quick-actions/quick_book_equipment/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to book equipment: ${response.statusText}`);
    }
    
    return response.json();
  },

  extendBooking: async (token: string, bookingId: number, extraMinutes: number = 30): Promise<any> => {
    const response = await fetch(buildApiUrl('/api/schedule/quick-actions/extend_booking/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        booking_id: bookingId,
        extra_minutes: extraMinutes
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to extend booking: ${response.statusText}`);
    }
    
    return response.json();
  },

  getEquipmentBookings: async (token: string, equipmentId: number, startDate?: string, endDate?: string): Promise<any[]> => {
    // Default to current date range if not provided
    if (!startDate) {
      const today = new Date();
      startDate = formatDateET(today);
    }
    if (!endDate) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // Get next 30 days
      endDate = formatDateET(futureDate);
    }

    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
    
    const response = await fetch(buildApiUrl(`api/schedule/equipment/${equipmentId}/availability/?${params}`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch bookings: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.bookings || [];
  },

  cancelBooking: async (token: string, bookingId: number): Promise<any> => {
    const response = await fetch(buildApiUrl(`api/schedule/bookings/${bookingId}/cancel/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to cancel booking: ${response.statusText}`);
    }
    
    return response.json();
  },

  getUserBookings: async (token: string, userId?: number): Promise<any[]> => {
    const params = userId ? new URLSearchParams({ user_id: userId.toString() }) : '';
    const response = await fetch(buildApiUrl(`api/schedule/bookings/?${params}`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user bookings: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  }
};

// Helper functions
export const scheduleHelpers = {
  // Format schedule time for display in Eastern Time
  formatScheduleTime: (startTime: string | null, endTime: string | null = null): string => {
    if (!startTime) return '';
    
    // Parse time string directly without creating a Date object to avoid timezone conversion
    const formatTimeString = (timeStr: string): string => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };
    
    const start = formatTimeString(startTime);
    
    if (endTime) {
      const end = formatTimeString(endTime);
      return `${start} - ${end}`;
    }
    
    return start;
  },

  // Format schedule date for display in Eastern Time
  formatScheduleDate: (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: EASTERN_TIME_ZONE,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Format full datetime for display in Eastern Time
  formatScheduleDateTime: (dateString: string, timeString?: string): string => {
    if (timeString) {
      const dateTime = new Date(`${dateString}T${timeString}`);
      return formatDateTimeET(dateTime);
    }
    return formatDateET(dateString);
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

  // Get event type and status combined color with improved contrast
  getEventColor: (eventType?: string, status?: string): string => {
    // Enhanced colors for event types with better visual distinction and contrast
    const eventColors: Record<string, Record<string, string>> = {
      meeting: {
        scheduled: 'bg-gradient-to-r from-purple-500 to-purple-600 border-l-4 border-purple-700 text-white shadow-md',
        in_progress: 'bg-gradient-to-r from-purple-600 to-purple-700 border-l-4 border-purple-800 text-white shadow-lg ring-2 ring-purple-300',
        completed: 'bg-gradient-to-r from-purple-100 to-purple-200 border-l-4 border-purple-400 text-purple-900 shadow-sm',
        cancelled: 'bg-gradient-to-r from-gray-100 to-gray-200 border-l-4 border-gray-400 text-gray-600 opacity-75 line-through'
      },
      booking: {
        scheduled: 'bg-gradient-to-r from-blue-500 to-blue-600 border-l-4 border-blue-700 text-white shadow-md',
        in_progress: 'bg-gradient-to-r from-blue-600 to-blue-700 border-l-4 border-blue-800 text-white shadow-lg ring-2 ring-blue-300',
        completed: 'bg-gradient-to-r from-blue-100 to-blue-200 border-l-4 border-blue-400 text-blue-900 shadow-sm',
        cancelled: 'bg-gradient-to-r from-gray-100 to-gray-200 border-l-4 border-gray-400 text-gray-600 opacity-75 line-through'
      },
      task: {
        scheduled: 'bg-gradient-to-r from-orange-500 to-orange-600 border-l-4 border-orange-700 text-white shadow-md',
        in_progress: 'bg-gradient-to-r from-orange-600 to-orange-700 border-l-4 border-orange-800 text-white shadow-lg ring-2 ring-orange-300',
        completed: 'bg-gradient-to-r from-orange-100 to-orange-200 border-l-4 border-orange-400 text-orange-900 shadow-sm',
        cancelled: 'bg-gradient-to-r from-gray-100 to-gray-200 border-l-4 border-gray-400 text-gray-600 opacity-75 line-through'
      },
      equipment: {
        scheduled: 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-l-4 border-emerald-700 text-white shadow-md',
        in_progress: 'bg-gradient-to-r from-emerald-600 to-emerald-700 border-l-4 border-emerald-800 text-white shadow-lg ring-2 ring-emerald-300',
        completed: 'bg-gradient-to-r from-emerald-100 to-emerald-200 border-l-4 border-emerald-400 text-emerald-900 shadow-sm',
        cancelled: 'bg-gradient-to-r from-gray-100 to-gray-200 border-l-4 border-gray-400 text-gray-600 opacity-75 line-through'
      },
      personal: {
        scheduled: 'bg-gradient-to-r from-indigo-500 to-indigo-600 border-l-4 border-indigo-700 text-white shadow-md',
        in_progress: 'bg-gradient-to-r from-indigo-600 to-indigo-700 border-l-4 border-indigo-800 text-white shadow-lg ring-2 ring-indigo-300',
        completed: 'bg-gradient-to-r from-indigo-100 to-indigo-200 border-l-4 border-indigo-400 text-indigo-900 shadow-sm',
        cancelled: 'bg-gradient-to-r from-gray-100 to-gray-200 border-l-4 border-gray-400 text-gray-600 opacity-75 line-through'
      }
    };

    const currentStatus = status || 'scheduled';
    const currentEventType = eventType || 'personal';
    
    // Return type-specific color or fallback to default
    return eventColors[currentEventType]?.[currentStatus] || 
           eventColors.personal[currentStatus] ||
           'bg-gradient-to-r from-gray-500 to-gray-600 border-l-4 border-gray-700 text-white shadow-md';
  },

  // Get lighter version for calendar month view with enhanced visibility
  getEventColorLight: (eventType?: string, status?: string): string => {
    const lightColors: Record<string, Record<string, string>> = {
      meeting: {
        scheduled: 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-all duration-200',
        in_progress: 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-900 border-l-4 border-purple-600 shadow-sm ring-1 ring-purple-200 hover:shadow-md transition-all duration-200',
        completed: 'bg-gradient-to-r from-purple-25 to-purple-50 text-purple-700 border-l-4 border-purple-300 shadow-sm opacity-90',
        cancelled: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border-l-4 border-gray-300 line-through opacity-70'
      },
      booking: {
        scheduled: 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-all duration-200',
        in_progress: 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-900 border-l-4 border-blue-600 shadow-sm ring-1 ring-blue-200 hover:shadow-md transition-all duration-200',
        completed: 'bg-gradient-to-r from-blue-25 to-blue-50 text-blue-700 border-l-4 border-blue-300 shadow-sm opacity-90',
        cancelled: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border-l-4 border-gray-300 line-through opacity-70'
      },
      task: {
        scheduled: 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-l-4 border-orange-500 shadow-sm hover:shadow-md transition-all duration-200',
        in_progress: 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-900 border-l-4 border-orange-600 shadow-sm ring-1 ring-orange-200 hover:shadow-md transition-all duration-200',
        completed: 'bg-gradient-to-r from-orange-25 to-orange-50 text-orange-700 border-l-4 border-orange-300 shadow-sm opacity-90',
        cancelled: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border-l-4 border-gray-300 line-through opacity-70'
      },
      equipment: {
        scheduled: 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border-l-4 border-emerald-500 shadow-sm hover:shadow-md transition-all duration-200',
        in_progress: 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-900 border-l-4 border-emerald-600 shadow-sm ring-1 ring-emerald-200 hover:shadow-md transition-all duration-200',
        completed: 'bg-gradient-to-r from-emerald-25 to-emerald-50 text-emerald-700 border-l-4 border-emerald-300 shadow-sm opacity-90',
        cancelled: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border-l-4 border-gray-300 line-through opacity-70'
      },
      personal: {
        scheduled: 'bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-all duration-200',
        in_progress: 'bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-900 border-l-4 border-indigo-600 shadow-sm ring-1 ring-indigo-200 hover:shadow-md transition-all duration-200',
        completed: 'bg-gradient-to-r from-indigo-25 to-indigo-50 text-indigo-700 border-l-4 border-indigo-300 shadow-sm opacity-90',
        cancelled: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border-l-4 border-gray-300 line-through opacity-70'
      }
    };

    const currentStatus = status || 'scheduled';
    const currentEventType = eventType || 'personal';
    
    return lightColors[currentEventType]?.[currentStatus] || 
           lightColors.personal[currentStatus] ||
           'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-l-4 border-gray-400 shadow-sm';
  },

  // Detect event type from schedule data
  getEventType: (schedule: Schedule): string => {
    if (schedule.event_type) {
      return schedule.event_type;
    }
    
    // Fallback detection based on title or other attributes
    const title = schedule.title.toLowerCase();
    if (title.includes('meeting') || title.includes('group') || title.includes('presentation')) {
      return 'meeting';
    }
    if (title.includes('booking') || title.includes('equipment') || title.includes('reserve')) {
      return 'booking';
    }
    if (title.includes('task') || title.includes('maintenance') || title.includes('clean')) {
      return 'task';
    }
    
    return 'personal';
  },

  // Check if schedule is today
  isToday: (dateString: string): boolean => {
    const todayET = getCurrentDateET();
    return dateString === todayET;
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

// Intelligent Meeting Management API
export const intelligentMeetingApi = {
  // Admin Dashboard
  getAdminDashboard: async (token: string): Promise<AdminDashboardData> => {
    const response = await fetch(buildApiUrl('/api/schedule/admin-dashboard/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch admin dashboard: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Personal Dashboard
  getPersonalDashboard: async (token: string): Promise<PersonalDashboardData> => {
    const response = await fetch(buildApiUrl('/api/schedule/personal-dashboard/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch personal dashboard: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Meeting Configuration
  getMeetingConfiguration: async (token: string): Promise<MeetingConfiguration> => {
    const response = await fetch(buildApiUrl('/api/schedule/meeting-configuration/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch meeting configuration: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results?.[0] || data;
  },

  updateMeetingConfiguration: async (token: string, config: Partial<MeetingConfiguration>): Promise<MeetingConfiguration> => {
    const response = await fetch(buildApiUrl('/api/schedule/meeting-configuration/'), {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update meeting configuration: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Meeting Instances
  getMeetings: async (token: string, params: { start_date?: string; end_date?: string } = {}): Promise<MeetingInstance[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/meetings/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/meetings/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch meetings: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  generateMeetings: async (token: string, data: {
    start_date: string;
    end_date: string;
    meeting_types?: string[];
    auto_assign_presenters?: boolean;
  }): Promise<{ message: string; meetings: MeetingInstance[] }> => {
    const response = await fetch(buildApiUrl('/api/schedule/meetings/generate/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to generate meetings: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Journal Club Management
  uploadPaper: async (token: string, meetingId: number, formData: FormData): Promise<{ message: string; presenter: Presenter }> => {
    const response = await fetch(buildApiUrl(`api/schedule/meetings/${meetingId}/upload-paper/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to upload paper: ${response.statusText}`);
    }
    
    return response.json();
  },

  submitPaperUrl: async (token: string, meetingId: number, data: {
    paper_url: string;
    paper_title: string;
  }): Promise<{ message: string; presenter: Presenter }> => {
    const response = await fetch(buildApiUrl(`api/schedule/meetings/${meetingId}/submit-paper-url/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to submit paper URL: ${response.statusText}`);
    }
    
    return response.json();
  },

  getPaperSubmissionStatus: async (token: string, meetingId: number): Promise<{
    meeting: MeetingInstance;
    submission_status: Array<{
      presenter: User;
      paper_title?: string;
      has_paper_url: boolean;
      has_paper_file: boolean;
      submitted_at?: string;
      status: string;
      deadline?: string;
      final_deadline?: string;
      is_overdue: boolean;
    }>;
  }> => {
    const response = await fetch(buildApiUrl(`api/schedule/meetings/${meetingId}/paper-submission/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch paper submission status: ${response.statusText}`);
    }
    
    return response.json();
  },

  distributePaper: async (token: string, meetingId: number): Promise<{ message: string; recipients_count: number }> => {
    const response = await fetch(buildApiUrl(`api/schedule/meetings/${meetingId}/distribute-paper/`), {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to distribute paper: ${response.statusText}`);
    }
    
    return response.json();
  },

  getPaperArchive: async (token: string, params: {
    start_date?: string;
    end_date?: string;
    presenter_id?: number;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<{
    papers: Array<{
      id: number;
      meeting_date: string;
      presenter: User;
      paper_title?: string;
      has_file: boolean;
      has_url: boolean;
      paper_url?: string;
      submitted_at: string;
      file_download_url?: string;
    }>;
    pagination: {
      total_count: number;
      total_pages: number;
      current_page: number;
      has_next: boolean;
      has_previous: boolean;
    };
  }> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/paper-archive/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/paper-archive/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch paper archive: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Swap Requests
  getSwapRequests: async (token: string): Promise<SwapRequest[]> => {
    const response = await fetch(buildApiUrl('/api/schedule/swap-requests/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch swap requests: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  createSwapRequest: async (token: string, data: {
    request_type: 'swap' | 'postpone';
    original_presentation_id: number;
    target_presentation_id?: number;
    target_date?: string;
    reason: string;
    cascade_effect?: 'skip' | 'cascade';
  }): Promise<SwapRequest> => {
    const response = await fetch(buildApiUrl('/api/schedule/swap-requests/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  approveSwapRequest: async (token: string, requestId: number): Promise<{ message: string }> => {
    const response = await fetch(buildApiUrl(`api/schedule/swap-requests/${requestId}/approve/`), {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to approve swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  rejectSwapRequest: async (token: string, requestId: number, reason?: string): Promise<{ message: string }> => {
    const response = await fetch(buildApiUrl(`api/schedule/swap-requests/${requestId}/reject/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to reject swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Quebec Holidays
  getQuebecHolidays: async (token: string, year: number): Promise<{
    year: number;
    holidays: Array<{
      name: string;
      date: string;
      type: 'fixed' | 'moveable';
    }>;
    count: number;
  }> => {
    const response = await fetch(buildApiUrl(`api/schedule/quebec-holidays/${year}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Quebec holidays: ${response.statusText}`);
    }
    
    return response.json();
  },

  isHoliday: async (token: string, date: string): Promise<{
    date: string;
    is_holiday: boolean;
    holiday_name?: string;
  }> => {
    const response = await fetch(buildApiUrl(`api/schedule/is-holiday/${date}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check if date is holiday: ${response.statusText}`);
    }
    
    return response.json();
  },

  getNextAvailableDate: async (token: string, preferredDate: string): Promise<{
    preferred_date: string;
    next_available_date: string;
    days_difference: number;
  }> => {
    const response = await fetch(buildApiUrl(`api/schedule/next-available-date/${preferredDate}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get next available date: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Users
  getUsers: async (token: string, search?: string): Promise<{ users: User[]; count: number }> => {
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/users/active/')}?${queryParams.toString()}`
      : buildApiUrl('/api/users/active/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    return response.json();
  },

  getUserDetail: async (token: string, userId: number): Promise<{
    user: User;
    statistics: {
      total_presentations: number;
      completed_presentations: number;
      completion_rate: number;
    };
    queue_status: {
      priority?: number;
      last_presented?: string;
      postpone_count: number;
    };
  }> => {
    const response = await fetch(buildApiUrl(`/api/users/${userId}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user detail: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Notifications
  sendNotification: async (token: string, data: {
    recipients: number[];
    subject: string;
    message: string;
    template_name?: string;
  }): Promise<{ message: string }> => {
    const response = await fetch(buildApiUrl('/api/schedule/notifications/send/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to send notification: ${response.statusText}`);
    }
    
    return response.json();
  },

  getNotificationHistory: async (token: string): Promise<{ notifications: any[] }> => {
    const response = await fetch(buildApiUrl('/api/schedule/notification-history/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notification history: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// ===============================================
// Periodic Task Management Types
// ===============================================

export interface TaskTemplate {
  id: number;
  name: string;
  description: string;
  task_type: 'one_time' | 'recurring';
  category: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  interval: number;
  start_date: string;
  end_date?: string;
  min_people: number;
  max_people: number;
  default_people: number;
  estimated_hours: number;
  window_type: 'fixed' | 'flexible';
  fixed_start_day?: number;
  fixed_end_day?: number;
  flexible_position?: 'beginning' | 'middle' | 'end';
  flexible_duration?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  created_by: User;
  created_at: string;
  updated_at: string;
}

export interface PeriodicTaskInstance {
  id: number;
  template: TaskTemplate;
  template_name: string;
  scheduled_period: string;
  execution_start_date: string;
  execution_end_date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  status_display: string;
  original_assignees: number[];
  current_assignees: number[];
  assignees: User[];
  primary_assignee?: User;
  assignment_metadata: any;
  is_overdue: boolean;
  can_complete: boolean;
  completed_by?: User;
  completed_at?: string;
  completion_duration?: number;
  completion_notes?: string;
  completion_photos?: string[];
  completion_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRotationQueue {
  id: number;
  template: TaskTemplate;
  algorithm: 'fair_rotation' | 'random' | 'manual';
  last_updated: string;
  min_gap_months: number;
  consider_workload: boolean;
  random_factor: number;
  queue_members: QueueMember[];
  member_count: number;
}

export interface QueueMember {
  id: number;
  user: User;
  total_assignments: number;
  last_assigned_date?: string;
  last_assigned_period?: string;
  completion_rate: number;
  average_completion_time: number;
  priority_score: number;
  is_active: boolean;
  availability_data: any;
  created_at: string;
  updated_at: string;
}

export interface TaskSwapRequest {
  id: number;
  task_instance: PeriodicTaskInstance;
  request_type: 'swap' | 'pool';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  from_user: User;
  to_user?: User;
  reason: string;
  target_user_approved: boolean;
  target_user_approved_at?: string;
  admin_approved: boolean;
  admin_approved_at?: string;
  admin_approved_by?: User;
  is_public_pool: boolean;
  pool_published_at?: string;
  can_approve: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskStatistics {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  average_completion_time: number;
  user_statistics: Array<{
    user: User;
    total_assignments: number;
    completed_assignments: number;
    completion_rate: number;
    average_completion_time: number;
  }>;
  template_statistics: Array<{
    template: TaskTemplate;
    total_instances: number;
    completed_instances: number;
    completion_rate: number;
    average_completion_time: number;
  }>;
}

export interface TaskGenerationPreview {
  period: string;
  template_name: string;
  execution_window: {
    start_date: string;
    end_date: string;
    duration_days: number;
  };
  suggested_assignees: string[];
  assignee_details: User[];
}

// ===============================================
// Periodic Task Management API
// ===============================================

export const periodicTaskApi = {
  // Task Templates
  getTaskTemplates: async (token: string, params: { is_active?: boolean; category?: string } = {}): Promise<TaskTemplate[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, value.toString());
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/task-templates/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/task-templates/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch task templates: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  createTaskTemplate: async (token: string, templateData: Omit<TaskTemplate, 'id' | 'created_by' | 'created_at' | 'updated_at'>): Promise<TaskTemplate> => {
    const response = await fetch(buildApiUrl('/api/schedule/task-templates/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create task template: ${response.statusText}`);
    }
    
    return response.json();
  },

  updateTaskTemplate: async (token: string, id: number, templateData: Partial<TaskTemplate>): Promise<TaskTemplate> => {
    const response = await fetch(buildApiUrl(`api/schedule/task-templates/${id}/`), {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update task template: ${response.statusText}`);
    }
    
    return response.json();
  },

  deleteTaskTemplate: async (token: string, id: number): Promise<void> => {
    const response = await fetch(buildApiUrl(`api/schedule/task-templates/${id}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete task template: ${response.statusText}`);
    }
  },

  // Task Instances
  getPeriodicTasks: async (token: string, params: {
    period?: string;
    status?: string;
    template_id?: number;
    assigned_to?: number;
  } = {}): Promise<PeriodicTaskInstance[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, value.toString());
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/periodic-tasks/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/periodic-tasks/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch periodic tasks: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  completeTask: async (token: string, taskId: number, completionData: {
    completion_duration?: number;
    completion_notes?: string;
    completion_photos?: string[];
    completion_rating?: number;
  }): Promise<PeriodicTaskInstance> => {
    const response = await fetch(buildApiUrl(`api/schedule/periodic-tasks/${taskId}/complete/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(completionData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to complete task: ${response.statusText}`);
    }
    
    return response.json();
  },

  updateTaskAssignees: async (token: string, taskId: number, assigneeIds: number[]): Promise<PeriodicTaskInstance> => {
    const response = await fetch(buildApiUrl(`api/schedule/periodic-tasks/${taskId}/update-assignees/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assignee_ids: assigneeIds })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update task assignees: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Task Rotation Queues
  getTaskRotationQueues: async (token: string): Promise<TaskRotationQueue[]> => {
    const response = await fetch(buildApiUrl('/api/schedule/task-rotation-queues/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rotation queues: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  updateQueueSettings: async (token: string, queueId: number, settings: {
    algorithm?: string;
    min_gap_months?: number;
    consider_workload?: boolean;
    random_factor?: number;
  }): Promise<TaskRotationQueue> => {
    const response = await fetch(buildApiUrl(`api/schedule/task-rotation-queues/${queueId}/`), {
      method: 'PATCH',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update queue settings: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Task Swap Requests
  getTaskSwapRequests: async (token: string, params: { status?: string; user_id?: number } = {}): Promise<TaskSwapRequest[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, value.toString());
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/task-swap-requests/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/task-swap-requests/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch task swap requests: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  createTaskSwapRequest: async (token: string, data: {
    task_instance_id: number;
    request_type: 'swap' | 'pool';
    to_user_id?: number;
    reason: string;
    is_public_pool?: boolean;
  }): Promise<TaskSwapRequest> => {
    const response = await fetch(buildApiUrl('/api/schedule/task-swap-requests/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  approveTaskSwapRequest: async (token: string, requestId: number): Promise<{ message: string }> => {
    const response = await fetch(buildApiUrl(`api/schedule/task-swap-requests/${requestId}/approve/`), {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to approve swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  rejectTaskSwapRequest: async (token: string, requestId: number, reason?: string): Promise<{ message: string }> => {
    const response = await fetch(buildApiUrl(`api/schedule/task-swap-requests/${requestId}/reject/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to reject swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Task Status Management - Start Task
  startTask: async (token: string, taskId: number): Promise<PeriodicTaskInstance> => {
    const response = await fetch(buildApiUrl(`api/schedule/periodic-tasks/${taskId}/start/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to start task: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Task Status Management - Cancel Task
  cancelTask: async (token: string, taskId: number, reason: string): Promise<PeriodicTaskInstance> => {
    const response = await fetch(buildApiUrl(`api/schedule/periodic-tasks/${taskId}/cancel/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to cancel task: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Task Management - Delete Task (Admin only)
  deleteTask: async (token: string, taskId: number): Promise<void> => {
    const response = await fetch(buildApiUrl(`api/schedule/periodic-tasks/${taskId}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to delete task: ${response.statusText}`);
    }
  },

  // Task Generation and Management
  previewTaskGeneration: async (token: string, data: {
    periods: string[];
    template_ids?: number[];
  }): Promise<TaskGenerationPreview[]> => {
    const response = await fetch(buildApiUrl('/api/schedule/periodic-tasks/preview-generation/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...data, preview_only: true })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to preview task generation: ${response.statusText}`);
    }
    
    return response.json();
  },

  generateTasks: async (token: string, data: {
    periods: string[];
    template_ids?: number[];
  }): Promise<{ message: string; generated_tasks: PeriodicTaskInstance[] }> => {
    const response = await fetch(buildApiUrl('/api/schedule/periodic-tasks/generate/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...data, preview_only: false })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to generate tasks: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Statistics
  getTaskStatistics: async (token: string, params: {
    start_period?: string;
    end_period?: string;
    template_ids?: number[];
  } = {}): Promise<TaskStatistics> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          queryParams.append(key, value.join(','));
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('/api/schedule/periodic-tasks/statistics/')}?${queryParams.toString()}`
      : buildApiUrl('/api/schedule/periodic-tasks/statistics/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch task statistics: ${response.statusText}`);
    }
    
    return response.json();
  }
};