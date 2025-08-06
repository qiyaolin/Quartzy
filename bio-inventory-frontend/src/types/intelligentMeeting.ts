// Core data models for intelligent meeting system
// All content in English as per system requirements

// User interface for meeting system
export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
}

// Quebec holiday definition
export interface QuebecHoliday {
  id: string;
  name: string;
  date: string; // "MM-DD" for fixed holidays
  year?: number; // For moveable holidays
  is_moveable: boolean;
}

// Meeting configuration (global settings)
export interface MeetingConfiguration {
  id: string;
  schedule: {
    dayOfWeek: number; // 0-6, 0=Sunday
    startTime: string; // "10:00"
    location: string;
  };
  durations: {
    researchUpdate: number; // minutes
    journalClub: number; // minutes
  };
  holidays: QuebecHoliday[];
  activeMembers: User[];
  settings: {
    jcSubmissionDeadline: number; // days before meeting (7 days)
    jcSubmissionFinalDeadline: number; // final deadline (3 days)
    requireAdminApproval: boolean;
    defaultPostponeStrategy: 'skip' | 'cascade';
  };
  createdAt: string;
  updatedAt: string;
}

// Meeting instance
export interface MeetingInstance {
  id: string;
  date: string; // "2024-03-15"
  type: 'Research Update' | 'Journal Club';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  presenters: Presenter[];
  actualDuration?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Presenter information
export interface Presenter {
  user: User;
  order: number; // presentation order
  status: 'assigned' | 'confirmed' | 'completed' | 'swapped' | 'postponed';
  topic?: string; // Research Update topic
  materials?: {
    paper?: {
      title: string;
      url?: string;
      file?: string; // file storage key
      submittedAt: Date;
    };
    slides?: string; // file storage key
  };
}

// Rotation system for fair presenter assignment
export interface RotationSystem {
  queue: QueueEntry[];
  history: PresentationHistory[];
  rules: {
    minGapBetweenPresentations: number; // minimum weeks between presentations (4 weeks)
    maxConsecutivePresenters: number; // maximum presenters per meeting (2)
    fairnessWeight: number; // fairness algorithm weight
  };
}

export interface QueueEntry {
  user: User;
  nextScheduledDate?: string;
  lastPresentedDate?: string;
  postponeCount: number;
  priority: number; // calculated by fairness algorithm
}

export interface PresentationHistory {
  id: string;
  user: User;
  meetingInstance: MeetingInstance;
  presentationDate: string;
  type: 'Research Update' | 'Journal Club';
  topic: string;
  materials?: {
    paperTitle?: string;
    paperUrl?: string;
    slidesUrl?: string;
  };
  duration?: number;
  feedback?: string;
  createdAt: string;
}

// Swap/postpone requests
export interface SwapRequest {
  id: string;
  type: 'swap' | 'postpone';
  requester: User;
  originalDate: string;
  targetDate?: string; // for swap requests
  targetUser?: User; // for swap requests
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvals: {
    targetUser?: { 
      approved: boolean; 
      at: Date; 
    };
    admin?: { 
      approved: boolean; 
      at: Date; 
      by: User; 
    };
  };
  cascadeEffect?: 'skip' | 'cascade'; // for postpone requests
  createdAt: string;
  updatedAt: string;
}

// Notification system interfaces
export interface NotificationTemplate {
  id: string;
  type: 'journal_club_reminder' | 'research_update_reminder' | 'general_meeting_reminder';
  timing: NotificationTiming;
  recipients: ('presenter' | 'all_members' | 'admin')[];
  subject: string;
  template: string;
  condition?: string; // conditional logic for sending
  attachments?: string[];
}

export interface NotificationTiming {
  daysBeforeMeeting?: number;
  hoursBeforeMeeting?: number;
  condition?: 'if_not_submitted' | 'if_paper_submitted' | 'always';
  frequency?: 'once' | 'daily' | 'weekly';
}

export interface ScheduledNotification {
  id: string;
  templateId: string;
  meetingInstanceId: string;
  scheduledFor: Date;
  recipients: string[];
  subject: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
}

// Admin dashboard interfaces
export interface AdminDashboardStats {
  totalMeetings: number;
  upcomingMeetings: number;
  pendingSubmissions: number;
  pendingSwapRequests: number;
  activeMembers: number;
  completionRate: number; // percentage of meetings completed as scheduled
}

export interface MeetingGenerationSettings {
  startDate: string;
  endDate: string;
  skipHolidays: boolean;
  alternatingPattern: boolean; // true for RU/JC alternating, false for separate weeks
  generatePresenterAssignments: boolean;
  sendInitialNotifications: boolean;
}

// Personal dashboard interfaces
export interface PersonalDashboardData {
  nextPresentation?: {
    meeting: MeetingInstance;
    presenter: Presenter;
    daysUntil: number;
    preparationStatus: PreparationStatus;
  };
  todoItems: TodoItem[];
  upcomingMeetings: MeetingInstance[];
  presentationHistory: PresentationHistory[];
  stats: PersonalStats;
}

export interface PreparationStatus {
  materialsSubmitted: boolean;
  topicConfirmed: boolean;
  slidesUploaded: boolean;
  readyToPresent: boolean;
  overallProgress: number; // 0-100 percentage
}

export interface TodoItem {
  id: string;
  type: 'submit_paper' | 'respond_swap' | 'prepare_slides' | 'confirm_topic';
  title: string;
  description: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  relatedMeetingId?: string;
}

export interface PersonalStats {
  totalPresentations: number;
  researchUpdates: number;
  journalClubs: number;
  averageGapBetweenPresentations: number; // in weeks
  onTimeSubmissionRate: number; // percentage
  swapRequestCount: number;
}

// File handling interfaces
export interface FileUploadResult {
  success: boolean;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  error?: string;
}

export interface PaperSubmission {
  meetingInstanceId: string;
  presenterId: string;
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  url?: string;
  file?: FileUploadResult;
  submittedAt: Date;
  isApproved: boolean;
  adminNotes?: string;
}

// Quebec holiday service interfaces
export interface HolidayService {
  isHoliday(date: Date): boolean;
  getNextMeetingDate(preferredDate: Date): Date;
  getHolidaysInRange(startDate: Date, endDate: Date): QuebecHoliday[];
  getHolidayName(date: Date): string | null;
}

// Rotation algorithm interfaces
export interface FairRotationAlgorithm {
  calculateNextPresenters(
    queue: QueueEntry[],
    meetingDate: string,
    requiredCount: number
  ): User[];
  updateQueueAfterAssignment(
    queue: QueueEntry[],
    assignedUsers: User[],
    meetingDate: string
  ): QueueEntry[];
  handlePostponeRequest(
    queue: QueueEntry[],
    user: User,
    originalDate: string,
    strategy: 'skip' | 'cascade'
  ): QueueEntry[];
}

export interface RotationScore {
  user: User;
  score: number;
  factors: {
    weeksSinceLastPresentation: number;
    postponeCount: number;
    fairnessBonus: number;
    availabilityScore: number;
  };
}

// API response interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

// Form interfaces for UI components
export interface MeetingSetupFormData {
  dayOfWeek: number;
  startTime: string;
  location: string;
  researchUpdateDuration: number;
  journalClubDuration: number;
  jcSubmissionDeadline: number;
  jcSubmissionFinalDeadline: number;
  requireAdminApproval: boolean;
  defaultPostponeStrategy: 'skip' | 'cascade';
}

export interface SwapRequestFormData {
  type: 'swap' | 'postpone';
  originalDate: string;
  targetDate?: string;
  targetUserId?: number;
  reason: string;
  cascadeEffect?: 'skip' | 'cascade';
}

export interface PaperSubmissionFormData {
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  url?: string;
  file?: File;
  notes?: string;
}

// Error handling interfaces
export interface MeetingSystemError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Search and filter interfaces
export interface MeetingSearchParams {
  dateFrom?: string;
  dateTo?: string;
  type?: 'Research Update' | 'Journal Club';
  status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  presenterId?: number;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

export interface PresenterSearchParams {
  isActive?: boolean;
  hasUpcomingPresentation?: boolean;
  lastPresentationBefore?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'lastPresentation' | 'totalPresentations';
  sortOrder?: 'asc' | 'desc';
}

