import React, { useState, useEffect, useContext } from 'react';
import { 
  ArrowLeftRight, Calendar, Clock, User, AlertCircle, 
  CheckCircle, XCircle, Send, Eye, MessageSquare,
  RefreshCw, Filter, Search, ChevronRight, Info
} from 'lucide-react';
import { AuthContext } from './AuthContext';
import {
  SwapRequest,
  MeetingInstance,
  SwapRequestFormData,
  User as UserType
} from '../types/intelligentMeeting';
import {
  swapRequestApi,
  meetingInstanceApi,
  adminDashboardApi
} from '../services/intelligentMeetingApi';

/**
 * Swap/Postpone Workflow Component
 * Comprehensive interface for managing presentation swaps and postponements
 * All content in English as per system requirements
 */

interface SwapPostponeWorkflowProps {
  className?: string;
  currentUserId?: number;
  isAdmin?: boolean;
}

const SwapPostponeWorkflow: React.FC<SwapPostponeWorkflowProps> = ({ 
  className = '', 
  currentUserId,
  isAdmin = false
}) => {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('SwapPostponeWorkflow must be used within an AuthProvider');
  }
  const { token } = authContext;

  // State management
  const [activeTab, setActiveTab] = useState<'create' | 'pending' | 'history'>('create');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [myMeetings, setMyMeetings] = useState<MeetingInstance[]>([]);
  const [allMeetings, setAllMeetings] = useState<MeetingInstance[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  // Form state
  const [requestType, setRequestType] = useState<'swap' | 'postpone'>('swap');
  const [selectedMeeting, setSelectedMeeting] = useState<string>('');
  const [targetMeeting, setTargetMeeting] = useState<string>('');
  const [targetUser, setTargetUser] = useState<string>('');
  const [reason, setReason] = useState('');
  const [cascadeEffect, setCascadeEffect] = useState<'skip' | 'cascade'>('skip');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);

  // Load initial data
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [
        swapRequestsResult,
        myMeetingsResult,
        allMeetingsResult,
        usersResult
      ] = await Promise.allSettled([
        swapRequestApi.getSwapRequests(token, {}),
        meetingInstanceApi.getMeetings(token, {
          dateFrom: new Date().toISOString().split('T')[0]
        }),
        meetingInstanceApi.getMeetings(token, {
          dateFrom: new Date().toISOString().split('T')[0]
        }),
        adminDashboardApi.getUsers(token)
      ]);

      if (swapRequestsResult.status === 'fulfilled') {
        setSwapRequests(swapRequestsResult.value);
      }

      if (myMeetingsResult.status === 'fulfilled') {
        // Filter meetings where current user is a presenter
        const myPresentations = myMeetingsResult.value.results.filter(meeting =>
          meeting.presenters.some(p => p.user.id === currentUserId)
        );
        setMyMeetings(myPresentations);
      }

      if (allMeetingsResult.status === 'fulfilled') {
        setAllMeetings(allMeetingsResult.value.results);
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value.filter(u => u.is_active));
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Error loading swap/postpone data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle request submission
  const handleSubmitRequest = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const selectedMeetingData = myMeetings.find(m => m.id === selectedMeeting);
      if (!selectedMeetingData) {
        throw new Error('Selected meeting not found');
      }

      const requestData: Omit<SwapRequest, 'id' | 'status' | 'approvals' | 'createdAt' | 'updatedAt'> = {
        type: requestType,
        requester: {
          id: currentUserId || 0,
          username: '',
          first_name: '',
          last_name: '',
          email: '',
          is_active: true
        } as UserType,
        originalDate: selectedMeetingData.date,
        reason,
        ...(requestType === 'swap' && {
          targetDate: allMeetings.find(m => m.id === targetMeeting)?.date,
          targetUser: users.find(u => u.id === parseInt(targetUser))
        }),
        ...(requestType === 'postpone' && {
          cascadeEffect
        })
      };

      const newRequest = await swapRequestApi.createSwapRequest(token, requestData);
      setSwapRequests(prev => [newRequest, ...prev]);

      // Reset form
      setSelectedMeeting('');
      setTargetMeeting('');
      setTargetUser('');
      setReason('');
      setWizardStep(1);

      setSuccess(`${requestType === 'swap' ? 'Swap' : 'Postpone'} request submitted successfully!`);
      setTimeout(() => setSuccess(null), 3000);

      // Switch to pending tab
      setActiveTab('pending');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle request response (for target users)
  const handleRespondToRequest = async (requestId: string, approved: boolean) => {
    try {
      setSubmitting(true);
      const result = await swapRequestApi.respondToSwapRequest(token, requestId, approved);
      
      setSwapRequests(prev => prev.map(req => 
        req.id === requestId ? result : req
      ));

      setSuccess(`Request ${approved ? 'approved' : 'declined'} successfully`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to request');
    } finally {
      setSubmitting(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  // Get type color
  const getTypeColor = (type: string) => {
    const colors = {
      swap: 'bg-blue-100 text-blue-800',
      postpone: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || colors.swap;
  };

  // Filter requests
  const filteredRequests = swapRequests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesType = typeFilter === 'all' || request.type === typeFilter;
    return matchesStatus && matchesType;
  });

  // Render swap wizard
  const renderSwapWizard = () => {
    const steps = [
      { id: 1, title: 'Select Request Type', desc: 'Choose swap or postpone' },
      { id: 2, title: 'Choose Your Meeting', desc: 'Select the meeting to change' },
      { id: 3, title: 'Set Target', desc: 'Choose swap target or postpone strategy' },
      { id: 4, title: 'Provide Reason', desc: 'Explain your request' },
      { id: 5, title: 'Review & Submit', desc: 'Confirm your request' }
    ];

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Request</h3>
          <p className="text-sm text-gray-600">Follow the steps to create a swap or postpone request</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  wizardStep >= step.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {wizardStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                </div>
                <div className="text-center mt-2">
                  <p className="text-xs font-medium text-gray-900">{step.title}</p>
                  <p className="text-xs text-gray-600">{step.desc}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  wizardStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {wizardStep === 1 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Select Request Type</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setRequestType('swap')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    requestType === 'swap'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <ArrowLeftRight className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="font-medium text-gray-900">Swap Presentation</span>
                  </div>
                  <p className="text-sm text-gray-600">Exchange your presentation date with another person</p>
                </button>

                <button
                  onClick={() => setRequestType('postpone')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    requestType === 'postpone'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <Calendar className="w-5 h-5 text-orange-600 mr-2" />
                    <span className="font-medium text-gray-900">Postpone Presentation</span>
                  </div>
                  <p className="text-sm text-gray-600">Delay your presentation to a later date</p>
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Choose Your Meeting</h4>
              {myMeetings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No upcoming presentations found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myMeetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => setSelectedMeeting(meeting.id)}
                      className={`w-full p-4 border rounded-lg text-left transition-colors ${
                        selectedMeeting === meeting.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              meeting.type === 'Research Update' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {meeting.type}
                            </div>
                            <span className="text-sm text-gray-600">{meeting.date}</span>
                          </div>
                          <p className="text-sm text-gray-900 font-medium">
                            {meeting.presenters.find(p => p.user.id === currentUserId)?.topic || 'No topic set'}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {wizardStep === 3 && (
            <div>
              {requestType === 'swap' ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">Choose Target Meeting</h4>
                    <div className="space-y-2">
                      {allMeetings
                        .filter(m => m.id !== selectedMeeting && m.type === myMeetings.find(meeting => meeting.id === selectedMeeting)?.type)
                        .map((meeting) => (
                        <button
                          key={meeting.id}
                          onClick={() => setTargetMeeting(meeting.id)}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            targetMeeting === meeting.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{meeting.date}</span>
                              <p className="text-xs text-gray-600">
                                Presenter: {meeting.presenters.length > 0 
                                  ? `${meeting.presenters[0].user.first_name} ${meeting.presenters[0].user.last_name}`
                                  : 'Unassigned'
                                }
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {targetMeeting && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-4">Select Target User</h4>
                      <select
                        value={targetUser}
                        onChange={(e) => setTargetUser(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Choose a user to swap with...</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Postpone Strategy</h4>
                  <div className="space-y-4">
                    <button
                      onClick={() => setCascadeEffect('skip')}
                      className={`w-full p-4 border rounded-lg text-left transition-colors ${
                        cascadeEffect === 'skip'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <span className="font-medium text-gray-900">Skip My Turn</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Skip my presentation this time. Other presenters continue as scheduled.
                      </p>
                    </button>

                    <button
                      onClick={() => setCascadeEffect('cascade')}
                      className={`w-full p-4 border rounded-lg text-left transition-colors ${
                        cascadeEffect === 'cascade'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <span className="font-medium text-gray-900">Cascade All Presentations</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Move all future presentations one slot later. Everyone shifts.
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {wizardStep === 4 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Provide Reason</h4>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why you need to swap/postpone your presentation..."
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                This will help administrators and other users understand your request.
              </p>
            </div>
          )}

          {wizardStep === 5 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Review Your Request</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Type:</span>
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(requestType)}`}>
                    {requestType === 'swap' ? 'Swap Request' : 'Postpone Request'}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Your Meeting:</span>
                  <span className="text-sm text-gray-900">
                    {myMeetings.find(m => m.id === selectedMeeting)?.date}
                  </span>
                </div>

                {requestType === 'swap' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Target Meeting:</span>
                      <span className="text-sm text-gray-900">
                        {allMeetings.find(m => m.id === targetMeeting)?.date}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Swap With:</span>
                      <span className="text-sm text-gray-900">
                        {users.find(u => u.id === parseInt(targetUser))?.first_name} {users.find(u => u.id === parseInt(targetUser))?.last_name}
                      </span>
                    </div>
                  </>
                )}

                {requestType === 'postpone' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Strategy:</span>
                    <span className="text-sm text-gray-900">
                      {cascadeEffect === 'skip' ? 'Skip My Turn' : 'Cascade All Presentations'}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700 block mb-1">Reason:</span>
                  <p className="text-sm text-gray-900">{reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
              disabled={wizardStep === 1}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {wizardStep < 5 ? (
              <button
                onClick={() => {
                  if (wizardStep === 2 && !selectedMeeting) return;
                  if (wizardStep === 3 && requestType === 'swap' && (!targetMeeting || !targetUser)) return;
                  if (wizardStep === 4 && !reason.trim()) return;
                  setWizardStep(wizardStep + 1);
                }}
                disabled={
                  (wizardStep === 2 && !selectedMeeting) ||
                  (wizardStep === 3 && requestType === 'swap' && (!targetMeeting || !targetUser)) ||
                  (wizardStep === 4 && !reason.trim())
                }
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render pending requests
  const renderPendingRequests = () => {
    const pendingRequests = filteredRequests.filter(req => req.status === 'pending');

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="swap">Swap</option>
                <option value="postpone">Postpone</option>
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {statusFilter === 'pending' ? 'Pending Requests' : 'All Requests'}
          </h3>

          {filteredRequests.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Requests Found</h4>
              <p className="text-gray-600">
                {statusFilter === 'pending' 
                  ? 'No pending requests at the moment'
                  : 'No requests match your current filters'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(request.type)}`}>
                          {request.type === 'swap' ? 'Swap Request' : 'Postpone Request'}
                        </div>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-900">
                        <p>
                          <span className="font-medium">From:</span> {request.requester.first_name} {request.requester.last_name}
                        </p>
                        <p>
                          <span className="font-medium">Original Date:</span> {request.originalDate}
                        </p>
                        {request.targetDate && (
                          <p>
                            <span className="font-medium">Target Date:</span> {request.targetDate}
                          </p>
                        )}
                        {request.targetUser && (
                          <p>
                            <span className="font-medium">Target User:</span> {request.targetUser.first_name} {request.targetUser.last_name}
                          </p>
                        )}
                      </div>

                      {request.reason && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                          <p className="text-sm text-gray-600">{request.reason}</p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons for target users and admins */}
                    {request.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        {/* If current user is target user and needs to respond */}
                        {request.type === 'swap' && request.targetUser?.id === currentUserId && (
                          <>
                            <button
                              onClick={() => handleRespondToRequest(request.id, true)}
                              disabled={submitting}
                              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondToRequest(request.id, false)}
                              disabled={submitting}
                              className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Decline
                            </button>
                          </>
                        )}

                        {/* Admin buttons would go here if isAdmin prop is true */}
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </button>
                            <button className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'create', label: 'Create Request', icon: Send },
    { id: 'pending', label: 'Pending', icon: Clock },
    { id: 'history', label: 'History', icon: Eye }
  ] as const;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Swap & Postpone</h2>
          <p className="text-gray-600">Manage your presentation schedule changes</p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
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
              const pendingCount = swapRequests.filter(req => req.status === 'pending').length;
              
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
                  {tab.id === 'pending' && pendingCount > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'create' && renderSwapWizard()}
          {activeTab === 'pending' && renderPendingRequests()}
          {activeTab === 'history' && renderPendingRequests()}
        </div>
      </div>
    </div>
  );
};

export default SwapPostponeWorkflow;