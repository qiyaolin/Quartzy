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
      // If API is not available, create mock default schedules
      console.info('Initialize API not available, creating mock schedules');
      
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      
      const defaultSchedules: Schedule[] = [
        // Group Meetings
        {
          id: Date.now() + 1,
          title: 'Weekly Lab Meeting - Research Updates',
          description: 'Weekly team meeting to discuss research progress, findings, and upcoming presentations. Each member presents their current work and research developments.',
          date: nextWeek.toISOString().split('T')[0],
          start_time: '14:00',
          end_time: '15:30',
          location: 'Conference Room A',
          status: 'scheduled',
          attendees_count: 8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 2,
          title: 'Journal Club Session',
          description: 'Bi-weekly journal discussion where team members present and discuss recent publications relevant to our research areas.',
          date: new Date(nextWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          start_time: '15:00',
          end_time: '16:00',
          location: 'Main Lab',
          status: 'scheduled',
          attendees_count: 6,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 3,
          title: 'Monthly Safety Training',
          description: 'Mandatory monthly laboratory safety training covering protocols, emergency procedures, and equipment safety guidelines.',
          date: nextMonth.toISOString().split('T')[0],
          start_time: '10:00',
          end_time: '11:30',
          location: 'Training Room',
          status: 'scheduled',
          attendees_count: 12,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        
        // Recurring Tasks
        {
          id: Date.now() + 4,
          title: 'Equipment Calibration Check',
          description: 'Monthly calibration verification for all sensitive measurement equipment including microscopes, scales, and analytical instruments.',
          date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          start_time: '09:00',
          end_time: '12:00',
          location: 'Equipment Room',
          status: 'scheduled',
          attendees_count: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 5,
          title: 'Inventory Audit and Restocking',
          description: 'Weekly inventory review, expiration date checks, and restocking of consumables and reagents.',
          date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          start_time: '13:00',
          end_time: '15:00',
          location: 'Storage Area',
          status: 'scheduled',
          attendees_count: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 6,
          title: 'Waste Disposal and Lab Cleanup',
          description: 'Bi-weekly hazardous waste collection, general lab cleanup, and maintenance of common areas.',
          date: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          start_time: '16:00',
          end_time: '17:30',
          location: 'Entire Lab',
          status: 'scheduled',
          attendees_count: 4,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      return defaultSchedules;
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
      // If API is not available, create mock default equipment
      console.info('Initialize equipment API not available, creating mock equipment');
      
      const defaultEquipment: Equipment[] = [
        {
          id: Date.now() + 101,
          name: 'Microscope - Zeiss Axio Observer',
          description: 'Advanced inverted microscope for live cell imaging and fluorescence microscopy. Equipped with multiple objectives and LED illumination system.',
          location: 'Imaging Room A',
          is_bookable: true,
          requires_qr_checkin: true,
          qr_code: 'EQ-MICROSCOPE-001',
          is_in_use: false,
          current_user: undefined,
          current_checkin_time: undefined,
          current_usage_duration: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 102,
          name: 'Analytical Balance - Mettler Toledo',
          description: 'High precision analytical balance with 0.1mg readability for accurate weighing of samples and reagents.',
          location: 'Preparation Room',
          is_bookable: true,
          requires_qr_checkin: true,
          qr_code: 'EQ-BALANCE-002',
          is_in_use: false,
          current_user: undefined,
          current_checkin_time: undefined,
          current_usage_duration: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 103,
          name: 'PCR Thermal Cycler',
          description: 'DNA amplification system for PCR reactions. 96-well capacity with gradient functionality for temperature optimization.',
          location: 'Molecular Biology Lab',
          is_bookable: true,
          requires_qr_checkin: false,
          qr_code: undefined,
          is_in_use: true,
          current_user: {
            username: 'researcher1',
            first_name: 'Sarah',
            last_name: 'Johnson'
          },
          current_checkin_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          current_usage_duration: '2 hours 15 minutes',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 104,
          name: 'Centrifuge - Eppendorf 5424R',
          description: 'Refrigerated microcentrifuge for sample preparation and separation. Variable speed control with cooling capability.',
          location: 'General Lab Area',
          is_bookable: false,
          requires_qr_checkin: false,
          qr_code: undefined,
          is_in_use: false,
          current_user: undefined,
          current_checkin_time: undefined,
          current_usage_duration: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: Date.now() + 105,
          name: 'Flow Cytometer - BD FACSCanto II',
          description: 'Multi-color flow cytometry system for cell analysis and sorting. Equipped with blue, red, and violet lasers.',
          location: 'Flow Cytometry Core',
          is_bookable: true,
          requires_qr_checkin: true,
          qr_code: 'EQ-FLOWCYT-005',
          is_in_use: false,
          current_user: undefined,
          current_checkin_time: undefined,
          current_usage_duration: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      return defaultEquipment;
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