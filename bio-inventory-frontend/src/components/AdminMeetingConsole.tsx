import React, { useState, useEffect, useContext } from 'react';
import { 
  Settings, Users, Calendar, Clock, MapPin, Plus, Save, 
  RefreshCw, CheckCircle, XCircle, AlertCircle, Upload,
  Download, Eye, Edit3, Trash2, Filter, Search
} from 'lucide-react';
import { AuthContext } from './AuthContext';
import {
  MeetingConfiguration,
  MeetingInstance,
  SwapRequest,
  AdminDashboardStats,
  MeetingGenerationSettings,
  User,
  QueueEntry
} from '../types/intelligentMeeting';
import {
  meetingConfigurationApi,
  meetingInstanceApi,
  swapRequestApi,
  adminDashboardApi,
  rotationApi
} from '../services/intelligentMeetingApi';
import { meetingGenerationService, quebecHolidayService } from '../services/rotationAlgorithm';

/**
 * Admin Meeting Console Component
 * Central admin interface for intelligent meeting system management
 * All content in English as per system requirements
 */

interface AdminMeetingConsoleProps {
  className?: string;
}

const AdminMeetingConsole: React.FC<AdminMeetingConsoleProps> = ({ className = '' }) => {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('AdminMeetingConsole must be used within an AuthProvider');
  }
  const { token } = authContext;
  if (!token) {
    throw new Error('Token is required for AdminMeetingConsole');
  }

  // State management
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setup' | 'generation' | 'assignments' | 'approvals'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data state
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [configuration, setConfiguration] = useState<MeetingConfiguration | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingInstance[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [activeMembers, setActiveMembers] = useState<User[]>([]);
  const [rotationQueue, setRotationQueue] = useState<QueueEntry[]>([]);

  // Form state
  const [setupForm, setSetupForm] = useState({
    dayOfWeek: 1, // Monday
    startTime: '10:00',
    location: 'Conference Room A',
    researchUpdateDuration: 120,
    journalClubDuration: 60,
    jcSubmissionDeadline: 7,
    jcSubmissionFinalDeadline: 3,
    requireAdminApproval: true,
    defaultPostponeStrategy: 'skip' as 'skip' | 'cascade'
  });

  const [generationSettings, setGenerationSettings] = useState<MeetingGenerationSettings>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 months ahead
    skipHolidays: true,
    alternatingPattern: true,
    generatePresenterAssignments: true,
    sendInitialNotifications: false
  });

  // Load initial data
  useEffect(() => {
    if (token) {
      loadAdminData();
    }
  }, [token]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all admin data in parallel
      const [
        statsResult,
        configResult,
        meetingsResult,
        swapRequestsResult,
        usersResult,
        rotationResult
      ] = await Promise.allSettled([
        adminDashboardApi.getAdminStats(token),
        meetingConfigurationApi.getConfiguration(token),
        meetingInstanceApi.getMeetings(token, { 
          dateFrom: new Date().toISOString().split('T')[0],
          status: 'scheduled'
        }),
        swapRequestApi.getSwapRequests(token, { status: 'pending' }),
        adminDashboardApi.getUsers(token),
        rotationApi.getRotationSystem(token)
      ]);

      // Handle results
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      }

      if (configResult.status === 'fulfilled') {
        setConfiguration(configResult.value);
        // Update form with existing config
        if (configResult.value) {
          setSetupForm({
            dayOfWeek: configResult.value.schedule.dayOfWeek,
            startTime: configResult.value.schedule.startTime,
            location: configResult.value.schedule.location,
            researchUpdateDuration: configResult.value.durations.researchUpdate,
            journalClubDuration: configResult.value.durations.journalClub,
            jcSubmissionDeadline: configResult.value.settings.jcSubmissionDeadline,
            jcSubmissionFinalDeadline: configResult.value.settings.jcSubmissionFinalDeadline,
            requireAdminApproval: configResult.value.settings.requireAdminApproval,
            defaultPostponeStrategy: configResult.value.settings.defaultPostponeStrategy
          });
        }
      }

      if (meetingsResult.status === 'fulfilled') {
        setUpcomingMeetings(meetingsResult.value.results);
      }

      if (swapRequestsResult.status === 'fulfilled') {
        setSwapRequests(swapRequestsResult.value);
      }

      if (usersResult.status === 'fulfilled') {
        setActiveMembers(usersResult.value.filter(user => user.is_active));
      }

      if (rotationResult.status === 'fulfilled') {
        setRotationQueue(rotationResult.value.queue);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle setup form submission
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const configData: Partial<MeetingConfiguration> = {
        schedule: {
          dayOfWeek: setupForm.dayOfWeek,
          startTime: setupForm.startTime,
          location: setupForm.location
        },
        durations: {
          researchUpdate: setupForm.researchUpdateDuration,
          journalClub: setupForm.journalClubDuration
        },
        settings: {
          jcSubmissionDeadline: setupForm.jcSubmissionDeadline,
          jcSubmissionFinalDeadline: setupForm.jcSubmissionFinalDeadline,
          requireAdminApproval: setupForm.requireAdminApproval,
          defaultPostponeStrategy: setupForm.defaultPostponeStrategy
        },
        activeMembers
      };

      const result = await meetingConfigurationApi.updateConfiguration(token, configData);
      setConfiguration(result);
      setSuccess('Meeting configuration updated successfully');
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setLoading(false);
    }
  };

  // Handle meeting generation
  const handleGenerateMeetings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate settings first
      const validation = meetingGenerationService.validateGenerationSettings({
        startDate: generationSettings.startDate,
        endDate: generationSettings.endDate,
        dayOfWeek: setupForm.dayOfWeek,
        activeMembers
      });

      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      const meetings = await meetingInstanceApi.generateMeetings(token, generationSettings);
      setUpcomingMeetings(meetings);
      setSuccess(`Successfully generated ${meetings.length} meetings`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate meetings');
    } finally {
      setLoading(false);
    }
  };

  // Handle swap request approval/rejection
  const handleSwapRequestReview = async (requestId: string, approved: boolean, notes?: string) => {
    try {
      setLoading(true);
      const result = await swapRequestApi.adminReviewSwapRequest(token, requestId, approved, notes);
      
      // Update swap requests list
      setSwapRequests(prev => prev.map(req => 
        req.id === requestId ? result : req
      ));

      setSuccess(`Swap request ${approved ? 'approved' : 'rejected'} successfully`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review swap request');
    } finally {
      setLoading(false);
    }
  };

  // Get day name from day number
  const getDayName = (dayNumber: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  };

  // Render dashboard tab
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Meetings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMeetings}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Meetings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.upcomingMeetings}</p>
              </div>
              <Clock className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Submissions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingSubmissions}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Meetings</h3>
        <div className="space-y-4">
          {upcomingMeetings.slice(0, 5).map((meeting) => (
            <div key={meeting.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    meeting.type === 'Research Update' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {meeting.type}
                  </div>
                  <span className="font-medium text-gray-900">{meeting.date}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Presenters: {meeting.presenters.length > 0 
                    ? meeting.presenters.map(p => `${p.user.first_name} ${p.user.last_name}`).join(', ')
                    : 'Not assigned'
                  }
                </p>
              </div>
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                meeting.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                meeting.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {meeting.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render setup wizard tab
  const renderSetupWizard = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Meeting Configuration Setup</h3>
        
        <form onSubmit={handleSetupSubmit} className="space-y-6">
          {/* Basic Schedule Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meeting Day
              </label>
              <select
                value={setupForm.dayOfWeek}
                onChange={(e) => setSetupForm(prev => ({...prev, dayOfWeek: parseInt(e.target.value)}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                {[0,1,2,3,4,5,6].map(day => (
                  <option key={day} value={day}>{getDayName(day)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={setupForm.startTime}
                onChange={(e) => setSetupForm(prev => ({...prev, startTime: e.target.value}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={setupForm.location}
                onChange={(e) => setSetupForm(prev => ({...prev, location: e.target.value}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Conference Room A"
                required
              />
            </div>
          </div>

          {/* Duration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Research Update Duration (minutes)
              </label>
              <input
                type="number"
                value={setupForm.researchUpdateDuration}
                onChange={(e) => setSetupForm(prev => ({...prev, researchUpdateDuration: parseInt(e.target.value)}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                min="30"
                max="180"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Journal Club Duration (minutes)
              </label>
              <input
                type="number"
                value={setupForm.journalClubDuration}
                onChange={(e) => setSetupForm(prev => ({...prev, journalClubDuration: parseInt(e.target.value)}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                min="30"
                max="120"
                required
              />
            </div>
          </div>

          {/* Journal Club Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paper Submission Deadline (days before)
              </label>
              <input
                type="number"
                value={setupForm.jcSubmissionDeadline}
                onChange={(e) => setSetupForm(prev => ({...prev, jcSubmissionDeadline: parseInt(e.target.value)}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                min="1"
                max="14"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Final Deadline (days before)
              </label>
              <input
                type="number"
                value={setupForm.jcSubmissionFinalDeadline}
                onChange={(e) => setSetupForm(prev => ({...prev, jcSubmissionFinalDeadline: parseInt(e.target.value)}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                min="1"
                max="7"
                required
              />
            </div>
          </div>

          {/* Policy Settings */}
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="requireApproval"
                checked={setupForm.requireAdminApproval}
                onChange={(e) => setSetupForm(prev => ({...prev, requireAdminApproval: e.target.checked}))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="requireApproval" className="ml-2 block text-sm text-gray-900">
                Require admin approval for swap requests
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Postpone Strategy
              </label>
              <select
                value={setupForm.defaultPostponeStrategy}
                onChange={(e) => setSetupForm(prev => ({...prev, defaultPostponeStrategy: e.target.value as 'skip' | 'cascade'}))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="skip">Skip (user's turn is skipped)</option>
                <option value="cascade">Cascade (all future presentations shift)</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render meeting generation tab
  const renderMeetingGeneration = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Generation Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Generate Meetings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={generationSettings.startDate}
              onChange={(e) => setGenerationSettings(prev => ({...prev, startDate: e.target.value}))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={generationSettings.endDate}
              onChange={(e) => setGenerationSettings(prev => ({...prev, endDate: e.target.value}))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="skipHolidays"
              checked={generationSettings.skipHolidays}
              onChange={(e) => setGenerationSettings(prev => ({...prev, skipHolidays: e.target.checked}))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="skipHolidays" className="ml-2 block text-sm text-gray-900">
              Skip Quebec holidays
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="alternatingPattern"
              checked={generationSettings.alternatingPattern}
              onChange={(e) => setGenerationSettings(prev => ({...prev, alternatingPattern: e.target.checked}))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="alternatingPattern" className="ml-2 block text-sm text-gray-900">
              Alternate Research Update and Journal Club
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="generateAssignments"
              checked={generationSettings.generatePresenterAssignments}
              onChange={(e) => setGenerationSettings(prev => ({...prev, generatePresenterAssignments: e.target.checked}))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="generateAssignments" className="ml-2 block text-sm text-gray-900">
              Automatically assign presenters using fair rotation
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleGenerateMeetings}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate Meetings
          </button>
        </div>
      </div>

      {/* Preview Generated Meetings */}
      {upcomingMeetings.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Generated Meetings Preview</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {upcomingMeetings.map((meeting, index) => (
              <div key={meeting.id || index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{meeting.date}</span>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      meeting.type === 'Research Update' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {meeting.type}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {meeting.presenters.length > 0 
                      ? `Presenters: ${meeting.presenters.map(p => `${p.user.first_name} ${p.user.last_name}`).join(', ')}`
                      : 'No presenters assigned'
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render swap request approvals
  const renderApprovals = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Swap Requests</h3>
        
        {swapRequests.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No pending swap requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {swapRequests.map((request) => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        request.type === 'swap' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.type === 'swap' ? 'Swap Request' : 'Postpone Request'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-900 mb-2">
                      <span className="font-medium">From:</span> {request.requester.first_name} {request.requester.last_name}
                    </p>
                    
                    <p className="text-sm text-gray-900 mb-2">
                      <span className="font-medium">Original Date:</span> {request.originalDate}
                    </p>
                    
                    {request.targetDate && (
                      <p className="text-sm text-gray-900 mb-2">
                        <span className="font-medium">Target Date:</span> {request.targetDate}
                      </p>
                    )}
                    
                    {request.reason && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleSwapRequestReview(request.id, true)}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleSwapRequestReview(request.id, false)}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Settings },
    { id: 'setup', label: 'Setup Wizard', icon: Settings },
    { id: 'generation', label: 'Generate Meetings', icon: RefreshCw },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle }
  ] as const;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Meeting Console</h2>
          <p className="text-gray-600">Central management for intelligent meeting system</p>
        </div>
        <button
          onClick={loadAdminData}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'approvals' && swapRequests.length > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {swapRequests.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'setup' && renderSetupWizard()}
          {activeTab === 'generation' && renderMeetingGeneration()}
          {activeTab === 'approvals' && renderApprovals()}
        </div>
      </div>
    </div>
  );
};

export default AdminMeetingConsole;