import React, { useState, useEffect } from 'react';
import { X, Users, RotateCcw, Plus, Edit3, Trash2, ArrowUp, ArrowDown, Calendar, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { Presenter, GroupMeeting } from "../services/groupMeetingApi.ts";

interface RotationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  presenters: Presenter[];
  meetings: GroupMeeting[];
  onUpdateRotation: (rotationData: RotationUpdateData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface RotationUpdateData {
  rotationType: 'research_update' | 'journal_club';
  rotationList: RotationEntry[];
  postponementActions?: PostponementAction[];
}

export interface RotationEntry {
  id: number;
  presenterId: number;
  presenter: Presenter;
  order: number;
  lastPresentationDate?: string;
  nextScheduledDate?: string;
  isActive: boolean;
}

export interface PostponementAction {
  meetingId: number;
  presenterId: number;
  action: 'postpone_to_next' | 'swap_with_next';
  reason: string;
}

interface DualPresenterAssignment {
  meetingId: number;
  primaryPresenterId: number;
  secondaryPresenterId: number;
  presentationOrder: 'primary_first' | 'secondary_first' | 'simultaneous';
}

const RotationManagementModal: React.FC<RotationManagementModalProps> = ({
  isOpen,
  onClose,
  presenters,
  meetings,
  onUpdateRotation,
  isSubmitting = false
}) => {
  const [activeTab, setActiveTab] = useState<'research_update' | 'journal_club'>('research_update');
  const [rotationLists, setRotationLists] = useState<{
    research_update: RotationEntry[];
    journal_club: RotationEntry[];
  }>({
    research_update: [],
    journal_club: []
  });
  const [dualPresenterMode, setDualPresenterMode] = useState(true);
  const [pendingPostponements, setPendingPostponements] = useState<PostponementAction[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize rotation lists when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeRotationLists();
      setErrors({});
    }
  }, [isOpen, presenters]);

  const initializeRotationLists = () => {
    const activePresenters = presenters.filter(p => p.is_active);
    
    const researchRotation = activePresenters.map((presenter, index) => ({
      id: presenter.id,
      presenterId: presenter.id,
      presenter,
      order: index + 1,
      lastPresentationDate: presenter.last_presentation_date,
      nextScheduledDate: getNextScheduledDate(presenter.id, 'research_update'),
      isActive: true
    }));

    const journalRotation = activePresenters.map((presenter, index) => ({
      id: presenter.id,
      presenterId: presenter.id,
      presenter,
      order: index + 1,
      lastPresentationDate: presenter.last_presentation_date,
      nextScheduledDate: getNextScheduledDate(presenter.id, 'journal_club'),
      isActive: true
    }));

    setRotationLists({
      research_update: researchRotation,
      journal_club: journalRotation
    });
  };

  const getNextScheduledDate = (presenterId: number, meetingType: string): string | undefined => {
    const upcomingMeeting = meetings
      .filter(m => m.meeting_type === meetingType && m.presenter_ids.includes(presenterId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    
    return upcomingMeeting?.date;
  };

  const movePresenterInRotation = (direction: 'up' | 'down', presenterId: number) => {
    const currentRotation = rotationLists[activeTab];
    const currentIndex = currentRotation.findIndex(entry => entry.presenterId === presenterId);
    
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= currentRotation.length) return;

    const newRotation = [...currentRotation];
    [newRotation[currentIndex], newRotation[newIndex]] = [newRotation[newIndex], newRotation[currentIndex]];
    
    // Update order numbers
    newRotation.forEach((entry, index) => {
      entry.order = index + 1;
    });

    setRotationLists(prev => ({
      ...prev,
      [activeTab]: newRotation
    }));
  };

  const togglePresenterActive = (presenterId: number) => {
    const currentRotation = rotationLists[activeTab];
    const updatedRotation = currentRotation.map(entry =>
      entry.presenterId === presenterId 
        ? { ...entry, isActive: !entry.isActive }
        : entry
    );

    setRotationLists(prev => ({
      ...prev,
      [activeTab]: updatedRotation
    }));
  };

  const addPostponementAction = (meetingId: number, presenterId: number, action: PostponementAction['action'], reason: string) => {
    const newAction: PostponementAction = {
      meetingId,
      presenterId,
      action,
      reason
    };
    setPendingPostponements(prev => [...prev, newAction]);
  };

  const removePostponementAction = (index: number) => {
    setPendingPostponements(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      await onUpdateRotation({
        rotationType: activeTab,
        rotationList: rotationLists[activeTab],
        postponementActions: pendingPostponements.length > 0 ? pendingPostponements : undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to update rotation:', error);
      setErrors({ submit: 'Failed to update rotation. Please try again.' });
    }
  };

  const getUpcomingMeetings = (meetingType: 'research_update' | 'journal_club') => {
    return meetings
      .filter(m => m.meeting_type === meetingType && new Date(m.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  };

  const canMoveUp = (presenterId: number) => {
    const currentIndex = rotationLists[activeTab].findIndex(entry => entry.presenterId === presenterId);
    return currentIndex > 0;
  };

  const canMoveDown = (presenterId: number) => {
    const currentIndex = rotationLists[activeTab].findIndex(entry => entry.presenterId === presenterId);
    return currentIndex < rotationLists[activeTab].length - 1;
  };

  if (!isOpen) return null;

  const currentRotation = rotationLists[activeTab];
  const upcomingMeetings = getUpcomingMeetings(activeTab);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <RotateCcw className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Rotation Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex p-6 pb-0">
            <button
              onClick={() => setActiveTab('research_update')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'research_update'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Research Updates
            </button>
            <button
              onClick={() => setActiveTab('journal_club')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'journal_club'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Journal Club
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex gap-6">
            {/* Left Column - Rotation List */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {activeTab === 'research_update' ? 'Research Update' : 'Journal Club'} Rotation
                </h3>
                {activeTab === 'research_update' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dualPresenterMode"
                      checked={dualPresenterMode}
                      onChange={(e) => setDualPresenterMode(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="dualPresenterMode" className="text-sm text-gray-700">
                      Dual Presenter Mode
                    </label>
                  </div>
                )}
              </div>

              {dualPresenterMode && activeTab === 'research_update' && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-blue-800 mb-1">Dual Presenter Mode Enabled</div>
                      <div className="text-blue-700">
                        Each Research Update meeting will automatically assign 2 presenters. 
                        If one presenter runs overtime, you can postpone the second presenter to the next session.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <span>Presenter</span>
                    <span>Actions</span>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {currentRotation.map((entry, index) => (
                    <div key={entry.presenterId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                            {entry.order}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">
                                {entry.presenter.first_name} {entry.presenter.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                @{entry.presenter.username}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {entry.isActive ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                            
                            {entry.nextScheduledDate && (
                              <span className="text-xs text-gray-500">
                                Next: {new Date(entry.nextScheduledDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => movePresenterInRotation('up', entry.presenterId)}
                            disabled={!canMoveUp(entry.presenterId) || isSubmitting}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => movePresenterInRotation('down', entry.presenterId)}
                            disabled={!canMoveDown(entry.presenterId) || isSubmitting}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => togglePresenterActive(entry.presenterId)}
                            disabled={isSubmitting}
                            className={`p-1 transition-colors ${
                              entry.isActive 
                                ? 'text-red-400 hover:text-red-600' 
                                : 'text-green-400 hover:text-green-600'
                            }`}
                          >
                            {entry.isActive ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Upcoming Meetings */}
            <div className="w-80">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Meetings</h3>
              
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                        <div className="text-sm text-gray-500">
                          {new Date(meeting.date).toLocaleDateString('en-US', { 
                            weekday: 'short', month: 'short', day: 'numeric' 
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">{meeting.start_time}</div>
                      </div>
                    </div>

                    {meeting.presenters && meeting.presenters.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {meeting.presenters.map((presenter, idx) => (
                          <div key={presenter.id} className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {presenter.first_name} {presenter.last_name}
                              {meeting.presenters.length > 1 && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({idx === 0 ? 'Primary' : 'Secondary'})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {dualPresenterMode && activeTab === 'research_update' && (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for postponing second presenter:');
                            if (reason && meeting.presenters && meeting.presenters.length > 1) {
                              addPostponementAction(meeting.id, meeting.presenters[1].id, 'postpone_to_next', reason);
                            }
                          }}
                          className="w-full px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                          disabled={!meeting.presenters || meeting.presenters.length < 2}
                        >
                          Postpone 2nd Presenter
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for swapping presenter order:');
                            if (reason && meeting.presenters && meeting.presenters.length > 0) {
                              addPostponementAction(meeting.id, meeting.presenters[0].id, 'swap_with_next', reason);
                            }
                          }}
                          className="w-full px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          disabled={!meeting.presenters || meeting.presenters.length === 0}
                        >
                          Swap Order
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {upcomingMeetings.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No upcoming meetings scheduled</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pending Postponements */}
          {pendingPostponements.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Actions</h3>
              <div className="space-y-2">
                {pendingPostponements.map((action, index) => {
                  const meeting = meetings.find(m => m.id === action.meetingId);
                  const presenter = presenters.find(p => p.id === action.presenterId);
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div>
                        <div className="font-medium text-orange-900">
                          {action.action === 'postpone_to_next' ? 'Postpone' : 'Swap'} {presenter?.first_name} {presenter?.last_name}
                        </div>
                        <div className="text-sm text-orange-700">
                          Meeting: {meeting?.title} - {action.reason}
                        </div>
                      </div>
                      <button
                        onClick={() => removePostponementAction(index)}
                        className="p-1 text-orange-600 hover:text-orange-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Update Rotation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotationManagementModal;