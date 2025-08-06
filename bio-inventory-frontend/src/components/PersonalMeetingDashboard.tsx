import React, { useState, useEffect, useContext } from 'react';
import { 
  Calendar, Clock, FileText, CheckCircle, AlertCircle, 
  Upload, Download, User, TrendingUp, ArrowRight,
  BookOpen, Presentation, Timer, Target
} from 'lucide-react';
import { AuthContext } from './AuthContext';
import {
  PersonalDashboardData,
  TodoItem,
  MeetingInstance,
  PresentationHistory,
  PreparationStatus
} from '../types/intelligentMeeting';
import {
  personalDashboardApi,
  journalClubApi
} from '../services/intelligentMeetingApi';

/**
 * Personal Meeting Dashboard Component
 * User-focused interface for managing personal meeting responsibilities
 * All content in English as per system requirements
 */

interface PersonalMeetingDashboardProps {
  className?: string;
}

const PersonalMeetingDashboard: React.FC<PersonalMeetingDashboardProps> = ({ className = '' }) => {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('PersonalMeetingDashboard must be used within an AuthProvider');
  }
  const { token } = authContext;

  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<PersonalDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'todos' | 'upcoming' | 'history'>('overview');

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load dashboard data
  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await personalDashboardApi.getDashboardData(token);
      setDashboardData(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle todo item completion
  const handleTodoItemToggle = async (todoId: string, completed: boolean) => {
    try {
      await personalDashboardApi.updateTodoItem(token, todoId, completed);
      
      // Update local state
      setDashboardData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          todoItems: prev.todoItems.map(item =>
            item.id === todoId ? { ...item, completed } : item
          )
        };
      });
      
      setSuccess(`Todo item ${completed ? 'completed' : 'unchecked'}`);
      setTimeout(() => setSuccess(null), 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo item');
    }
  };

  // Handle file upload for journal club
  const handleFileUpload = async (meetingId: string) => {
    if (!selectedFile) return;
    
    try {
      setUploading(true);
      setError(null);
      
      await journalClubApi.uploadPaper(token, meetingId, selectedFile, {
        title: 'Paper for Journal Club',
        authors: '',
        journal: '',
      });
      
      setSuccess('Paper uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setSelectedFile(null);
      
      // Refresh dashboard data
      await loadDashboardData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload paper');
    } finally {
      setUploading(false);
    }
  };

  // Get priority color for todo items
  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[priority as keyof typeof colors] || colors.low;
  };

  // Calculate days until date
  const getDaysUntil = (dateString: string): number => {
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Format preparation status
  const formatPreparationProgress = (status: PreparationStatus): string => {
    const completedItems = [
      status.materialsSubmitted,
      status.topicConfirmed,
      status.slidesUploaded,
      status.readyToPresent
    ].filter(Boolean).length;
    
    return `${completedItems}/4 items completed`;
  };

  // Render next presentation card
  const renderNextPresentation = () => {
    if (!dashboardData?.nextPresentation) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Presentations</h3>
            <p className="text-gray-600">You don't have any scheduled presentations at the moment.</p>
          </div>
        </div>
      );
    }

    const { nextPresentation } = dashboardData;
    const daysUntil = nextPresentation.daysUntil;
    const isUrgent = daysUntil <= 3;
    const meetingType = nextPresentation.meeting.type;

    return (
      <div className={`bg-white rounded-lg border-2 p-6 ${isUrgent ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${meetingType === 'Research Update' ? 'bg-blue-100' : 'bg-green-100'}`}>
              {meetingType === 'Research Update' ? (
                <Presentation className="w-6 h-6 text-blue-600" />
              ) : (
                <BookOpen className="w-6 h-6 text-green-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Your Next Presentation</h3>
              <p className="text-sm text-gray-600">{meetingType}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isUrgent ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {daysUntil === 0 ? 'Today' : 
             daysUntil === 1 ? 'Tomorrow' : 
             `${daysUntil} days`}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{nextPresentation.meeting.date}</span>
          </div>

          {nextPresentation.presenter.topic && (
            <div className="flex items-center text-sm text-gray-600">
              <FileText className="w-4 h-4 mr-2" />
              <span>Topic: {nextPresentation.presenter.topic}</span>
            </div>
          )}

          {/* Preparation Status */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Preparation Status</h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Overall Progress</span>
                <span className="text-sm font-medium text-gray-900">
                  {nextPresentation.preparationStatus.overallProgress}%
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${nextPresentation.preparationStatus.overallProgress}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className={`flex items-center text-xs ${
                  nextPresentation.preparationStatus.topicConfirmed ? 'text-green-600' : 'text-gray-500'
                }`}>
                  <CheckCircle className={`w-3 h-3 mr-1 ${
                    nextPresentation.preparationStatus.topicConfirmed ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  Topic Confirmed
                </div>
                
                <div className={`flex items-center text-xs ${
                  nextPresentation.preparationStatus.materialsSubmitted ? 'text-green-600' : 'text-gray-500'
                }`}>
                  <CheckCircle className={`w-3 h-3 mr-1 ${
                    nextPresentation.preparationStatus.materialsSubmitted ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  Materials Submitted
                </div>
                
                <div className={`flex items-center text-xs ${
                  nextPresentation.preparationStatus.slidesUploaded ? 'text-green-600' : 'text-gray-500'
                }`}>
                  <CheckCircle className={`w-3 h-3 mr-1 ${
                    nextPresentation.preparationStatus.slidesUploaded ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  Slides Ready
                </div>
                
                <div className={`flex items-center text-xs ${
                  nextPresentation.preparationStatus.readyToPresent ? 'text-green-600' : 'text-gray-500'
                }`}>
                  <CheckCircle className={`w-3 h-3 mr-1 ${
                    nextPresentation.preparationStatus.readyToPresent ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  Ready to Present
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {meetingType === 'Journal Club' && !nextPresentation.preparationStatus.materialsSubmitted && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Quick Upload</h4>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-yellow-100 file:text-yellow-800"
                />
                <button
                  onClick={() => handleFileUpload(nextPresentation.meeting.id)}
                  disabled={!selectedFile || uploading}
                  className="inline-flex items-center px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 disabled:opacity-50"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render todo items
  const renderTodoItems = () => {
    if (!dashboardData?.todoItems.length) {
      return (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-600">You have no pending tasks at the moment.</p>
        </div>
      );
    }

    const incompleteTodos = dashboardData.todoItems.filter(item => !item.completed);
    const completedTodos = dashboardData.todoItems.filter(item => item.completed);

    return (
      <div className="space-y-4">
        {/* Pending Tasks */}
        {incompleteTodos.length > 0 && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Pending Tasks</h4>
            <div className="space-y-2">
              {incompleteTodos.map((todo) => (
                <div key={todo.id} className={`border rounded-lg p-4 ${getPriorityColor(todo.priority)}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={(e) => handleTodoItemToggle(todo.id, e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{todo.title}</h5>
                      <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center">
                          <Timer className="w-3 h-3 mr-1" />
                          Due: {new Date(todo.dueDate).toLocaleDateString()}
                        </div>
                        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                          {todo.priority}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Tasks */}
        {completedTodos.length > 0 && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Recently Completed</h4>
            <div className="space-y-2">
              {completedTodos.slice(-3).map((todo) => (
                <div key={todo.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={(e) => handleTodoItemToggle(todo.id, e.target.checked)}
                      className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 line-through">{todo.title}</h5>
                      <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render upcoming meetings
  const renderUpcomingMeetings = () => {
    if (!dashboardData?.upcomingMeetings.length) {
      return (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Meetings</h3>
          <p className="text-gray-600">No meetings scheduled in the near future.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {dashboardData.upcomingMeetings.map((meeting) => (
          <div key={meeting.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    meeting.type === 'Research Update' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {meeting.type}
                  </div>
                  <span className="text-sm text-gray-500">{meeting.date}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <User className="w-4 h-4 mr-2" />
                  <span>
                    Presenters: {meeting.presenters.length > 0 
                      ? meeting.presenters.map(p => `${p.user.first_name} ${p.user.last_name}`).join(', ')
                      : 'Not assigned'
                    }
                  </span>
                </div>
              </div>
              
              <div className="text-right text-sm text-gray-500">
                {getDaysUntil(meeting.date)} days
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render presentation history
  const renderPresentationHistory = () => {
    if (!dashboardData?.presentationHistory.length) {
      return (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Presentation History</h3>
          <p className="text-gray-600">Your presentation history will appear here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {dashboardData.presentationHistory.map((presentation) => (
          <div key={presentation.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    presentation.type === 'Research Update' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {presentation.type}
                  </div>
                  <span className="font-medium text-gray-900">{presentation.topic}</span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{presentation.presentationDate}</p>
                
                {presentation.materials?.paperTitle && (
                  <p className="text-xs text-gray-500">Paper: {presentation.materials.paperTitle}</p>
                )}
              </div>
              
              {presentation.duration && (
                <div className="text-sm text-gray-500">
                  {presentation.duration} min
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render statistics
  const renderStats = () => {
    if (!dashboardData?.stats) return null;

    const { stats } = dashboardData;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Presentations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPresentations}</p>
            </div>
            <Presentation className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Research Updates</p>
              <p className="text-2xl font-bold text-gray-900">{stats.researchUpdates}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Journal Clubs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.journalClubs}</p>
            </div>
            <BookOpen className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On-Time Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.onTimeSubmissionRate}%</p>
            </div>
            <Target className="w-8 h-8 text-orange-600" />
          </div>
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
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'todos', label: 'Todo List', icon: CheckCircle },
    { id: 'upcoming', label: 'Upcoming', icon: Clock },
    { id: 'history', label: 'History', icon: BookOpen }
  ] as const;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Meeting Dashboard</h2>
          <p className="text-gray-600">Track your presentations, tasks, and progress</p>
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

      {/* Statistics */}
      {dashboardData && renderStats()}

      {/* Next Presentation Card */}
      {renderNextPresentation()}

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
                  {tab.id === 'todos' && dashboardData?.todoItems.filter(item => !item.completed).length && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {dashboardData.todoItems.filter(item => !item.completed).length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {renderStats()}
              {dashboardData?.todoItems.filter(item => !item.completed).length && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Urgent Tasks</h3>
                  {renderTodoItems()}
                </div>
              )}
            </div>
          )}
          {activeTab === 'todos' && renderTodoItems()}
          {activeTab === 'upcoming' && renderUpcomingMeetings()}
          {activeTab === 'history' && renderPresentationHistory()}
        </div>
      </div>
    </div>
  );
};

export default PersonalMeetingDashboard;