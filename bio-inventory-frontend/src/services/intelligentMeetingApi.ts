import { buildApiUrl } from '../config/api';
import {
  User,
  MeetingConfiguration,
  MeetingInstance,
  SwapRequest,
  PresentationHistory,
  RotationSystem,
  PersonalDashboardData,
  AdminDashboardStats,
  MeetingGenerationSettings,
  PaperSubmission,
  QuebecHoliday,
  ApiResponse,
  PaginatedResponse,
  MeetingSearchParams,
  FileUploadResult
} from '../types/intelligentMeeting';

/**
 * Intelligent Meeting System API Service
 * Provides comprehensive meeting management functionality
 * All content in English as per system requirements
 */

// Meeting Configuration API
export const meetingConfigurationApi = {
  // Get current meeting configuration
  getConfiguration: async (token: string): Promise<MeetingConfiguration> => {
    const response = await fetch(buildApiUrl('schedule/meeting-configuration/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch meeting configuration: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Update meeting configuration
  updateConfiguration: async (
    token: string, 
    configData: Partial<MeetingConfiguration>
  ): Promise<MeetingConfiguration> => {
    const response = await fetch(buildApiUrl('schedule/meeting-configuration/'), {
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

  // Initialize default configuration
  initializeDefaults: async (token: string): Promise<MeetingConfiguration> => {
    const response = await fetch(buildApiUrl('schedule/meeting-configuration/initialize/'), {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to initialize configuration: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Meeting Instance Management API
export const meetingInstanceApi = {
  // Get all meeting instances
  getMeetings: async (
    token: string, 
    params: MeetingSearchParams = {}
  ): Promise<PaginatedResponse<MeetingInstance>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('schedule/meetings/')}?${queryParams.toString()}`
      : buildApiUrl('schedule/meetings/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch meetings: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get specific meeting by ID
  getMeeting: async (token: string, meetingId: string): Promise<MeetingInstance> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch meeting: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Create new meeting instance
  createMeeting: async (
    token: string, 
    meetingData: Partial<MeetingInstance>
  ): Promise<MeetingInstance> => {
    const response = await fetch(buildApiUrl('schedule/meetings/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meetingData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create meeting: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Update meeting instance
  updateMeeting: async (
    token: string,
    meetingId: string,
    meetingData: Partial<MeetingInstance>
  ): Promise<MeetingInstance> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/`), {
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

  // Delete meeting instance
  deleteMeeting: async (token: string, meetingId: string): Promise<void> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete meeting: ${response.statusText}`);
    }
  },

  // Generate meetings for a date range
  generateMeetings: async (
    token: string,
    settings: MeetingGenerationSettings
  ): Promise<MeetingInstance[]> => {
    const response = await fetch(buildApiUrl('schedule/meetings/generate/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to generate meetings: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Rotation System API
export const rotationApi = {
  // Get current rotation system state
  getRotationSystem: async (token: string): Promise<RotationSystem> => {
    const response = await fetch(buildApiUrl('schedule/rotation-system/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rotation system: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Update rotation system
  updateRotationSystem: async (
    token: string,
    rotationData: Partial<RotationSystem>
  ): Promise<RotationSystem> => {
    const response = await fetch(buildApiUrl('schedule/rotation-system/'), {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rotationData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update rotation system: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get next recommended presenters
  getNextPresenters: async (
    token: string,
    meetingDate: string,
    meetingType: 'Research Update' | 'Journal Club',
    requiredCount: number = 1
  ): Promise<User[]> => {
    const response = await fetch(buildApiUrl('schedule/rotation-system/next-presenters/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        meetingDate,
        meetingType,
        requiredCount
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to get next presenters: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Manually assign presenters (overrides algorithm)
  assignPresenters: async (
    token: string,
    meetingId: string,
    presenterIds: number[]
  ): Promise<MeetingInstance> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/assign-presenters/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ presenterIds })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to assign presenters: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Swap Request Management API
export const swapRequestApi = {
  // Get all swap requests (admin) or user's requests
  getSwapRequests: async (
    token: string,
    params: { status?: string; userId?: number } = {}
  ): Promise<SwapRequest[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('schedule/swap-requests/')}?${queryParams.toString()}`
      : buildApiUrl('schedule/swap-requests/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch swap requests: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  // Create new swap request
  createSwapRequest: async (
    token: string,
    swapData: Omit<SwapRequest, 'id' | 'status' | 'approvals' | 'createdAt' | 'updatedAt'>
  ): Promise<SwapRequest> => {
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

  // Respond to swap request (target user)
  respondToSwapRequest: async (
    token: string,
    requestId: string,
    approved: boolean
  ): Promise<SwapRequest> => {
    const response = await fetch(buildApiUrl(`schedule/swap-requests/${requestId}/respond/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to respond to swap request: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Admin approval/rejection
  adminReviewSwapRequest: async (
    token: string,
    requestId: string,
    approved: boolean,
    adminNotes?: string
  ): Promise<SwapRequest> => {
    const response = await fetch(buildApiUrl(`schedule/swap-requests/${requestId}/admin-review/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved, adminNotes })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to review swap request: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Journal Club Materials API
export const journalClubApi = {
  // Upload paper for journal club
  uploadPaper: async (
    token: string,
    meetingId: string,
    file: File,
    metadata: {
      title: string;
      authors?: string;
      journal?: string;
      year?: number;
      doi?: string;
    }
  ): Promise<PaperSubmission> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/upload-paper/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to upload paper: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Submit paper URL for journal club
  submitPaperUrl: async (
    token: string,
    meetingId: string,
    paperData: {
      title: string;
      url: string;
      authors?: string;
      journal?: string;
      year?: number;
      doi?: string;
    }
  ): Promise<PaperSubmission> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/submit-paper-url/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paperData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to submit paper URL: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get paper submissions for a meeting
  getPaperSubmission: async (
    token: string,
    meetingId: string
  ): Promise<PaperSubmission | null> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/paper-submission/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (response.status === 404) {
      return null; // No submission found
    }
    
    if (!response.ok) {
      throw new Error(`Failed to get paper submission: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Distribute paper to all members
  distributePaper: async (
    token: string,
    meetingId: string,
    customMessage?: string
  ): Promise<ApiResponse<any>> => {
    const response = await fetch(buildApiUrl(`schedule/meetings/${meetingId}/distribute-paper/`), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customMessage })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to distribute paper: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get paper archive
  getPaperArchive: async (
    token: string,
    params: {
      dateFrom?: string;
      dateTo?: string;
      presenterId?: number;
      searchTerm?: string;
    } = {}
  ): Promise<PaginatedResponse<PaperSubmission>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('schedule/paper-archive/')}?${queryParams.toString()}`
      : buildApiUrl('schedule/paper-archive/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch paper archive: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Personal Dashboard API
export const personalDashboardApi = {
  // Get user's dashboard data
  getDashboardData: async (token: string): Promise<PersonalDashboardData> => {
    const response = await fetch(buildApiUrl('schedule/personal-dashboard/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get user's presentation history
  getPresentationHistory: async (
    token: string,
    params: { limit?: number; offset?: number } = {}
  ): Promise<PaginatedResponse<PresentationHistory>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('schedule/presentation-history/')}?${queryParams.toString()}`
      : buildApiUrl('schedule/presentation-history/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch presentation history: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Update todo item completion
  updateTodoItem: async (
    token: string,
    todoId: string,
    completed: boolean
  ): Promise<ApiResponse<any>> => {
    const response = await fetch(buildApiUrl(`schedule/todo-items/${todoId}/`), {
      method: 'PATCH',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ completed })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update todo item: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Admin Dashboard API
export const adminDashboardApi = {
  // Get admin dashboard statistics
  getAdminStats: async (token: string): Promise<AdminDashboardStats> => {
    const response = await fetch(buildApiUrl('schedule/admin-dashboard/stats/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch admin stats: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get all users for management
  getUsers: async (token: string): Promise<User[]> => {
    const response = await fetch(buildApiUrl('schedule/users/'), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  },

  // Update user status
  updateUserStatus: async (
    token: string,
    userId: number,
    isActive: boolean
  ): Promise<User> => {
    const response = await fetch(buildApiUrl(`schedule/users/${userId}/`), {
      method: 'PATCH',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: isActive })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update user status: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Quebec Holiday Integration API
export const holidayApi = {
  // Get Quebec holidays for a year
  getQuebecHolidays: async (
    token: string,
    year: number
  ): Promise<QuebecHoliday[]> => {
    const response = await fetch(buildApiUrl(`schedule/quebec-holidays/${year}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Quebec holidays: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Check if a date is a Quebec holiday
  isHoliday: async (
    token: string,
    date: string
  ): Promise<{ isHoliday: boolean; holidayName?: string }> => {
    const response = await fetch(buildApiUrl(`schedule/is-holiday/${date}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check holiday: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get next available meeting date (skipping holidays)
  getNextAvailableDate: async (
    token: string,
    preferredDate: string
  ): Promise<{ date: string; skippedHolidays: string[] }> => {
    const response = await fetch(buildApiUrl(`schedule/next-available-date/${preferredDate}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get next available date: ${response.statusText}`);
    }
    
    return response.json();
  }
};

// Notification System API
export const notificationApi = {
  // Send manual notification
  sendManualNotification: async (
    token: string,
    notificationData: {
      recipients: string[];
      subject: string;
      message: string;
      meetingId?: string;
    }
  ): Promise<ApiResponse<any>> => {
    const response = await fetch(buildApiUrl('schedule/notifications/send/'), {
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

  // Get notification history
  getNotificationHistory: async (
    token: string,
    params: { meetingId?: string; limit?: number } = {}
  ): Promise<any[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = queryParams.toString() 
      ? `${buildApiUrl('schedule/notification-history/')}?${queryParams.toString()}`
      : buildApiUrl('schedule/notification-history/');
      
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notification history: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || data;
  }
};

// File Management API
export const fileManagementApi = {
  // Upload file
  uploadFile: async (
    token: string,
    file: File,
    category: 'paper' | 'slides' | 'other'
  ): Promise<FileUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    
    const response = await fetch(buildApiUrl('schedule/files/upload/'), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to upload file: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Download file
  downloadFile: async (
    token: string,
    fileKey: string
  ): Promise<Blob> => {
    const response = await fetch(buildApiUrl(`schedule/files/download/${fileKey}/`), {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    return response.blob();
  },

  // Delete file
  deleteFile: async (
    token: string,
    fileKey: string
  ): Promise<ApiResponse<any>> => {
    const response = await fetch(buildApiUrl(`schedule/files/${fileKey}/`), {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
    
    return response.json();
  }
};

