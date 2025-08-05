import React, { useState, useEffect } from 'react';
import { X, ArrowUpDown, Calendar, User, Clock, MessageSquare } from 'lucide-react';
import { GroupMeeting, Presenter } from '../services/groupMeetingApi.ts';

interface SwapRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: GroupMeeting | null;
  presenters: Presenter[];
  onSubmit: (swapData: SwapRequestData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface SwapRequestData {
  meetingId: number;
  currentPresenterId: number;
  targetPresenterId?: number;
  reason: string;
  swapType: 'find_replacement' | 'swap_with_specific' | 'postpone_to_next';
}

const SwapRequestModal: React.FC<SwapRequestModalProps> = ({
  isOpen,
  onClose,
  meeting,
  presenters,
  onSubmit,
  isSubmitting = false
}) => {
  const [swapType, setSwapType] = useState<SwapRequestData['swapType']>('find_replacement');
  const [targetPresenterId, setTargetPresenterId] = useState<number | undefined>();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSwapType('find_replacement');
      setTargetPresenterId(undefined);
      setReason('');
      setErrors({});
    }
  }, [isOpen]);

  const availablePresenters = presenters.filter(p => 
    p.is_active && p.id !== meeting?.presenter?.id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;

    // Validation
    const newErrors: Record<string, string> = {};
    if (!reason.trim()) {
      newErrors.reason = 'Please provide a reason for the swap request';
    }
    if (swapType === 'swap_with_specific' && !targetPresenterId) {
      newErrors.targetPresenter = 'Please select a presenter to swap with';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit({
        meetingId: meeting.id,
        currentPresenterId: meeting.presenter!.id,
        targetPresenterId,
        reason: reason.trim(),
        swapType
      });
      onClose();
    } catch (error) {
      console.error('Failed to submit swap request:', error);
      setErrors({ submit: 'Failed to submit swap request. Please try again.' });
    }
  };

  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ArrowUpDown className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Request Presenter Swap</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Meeting Info */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-2">{meeting.title}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(meeting.date).toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{meeting.start_time} - {meeting.end_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Current Presenter: {meeting.presenter?.first_name} {meeting.presenter?.last_name}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Swap Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Request Type</label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="swapType"
                  value="find_replacement"
                  checked={swapType === 'find_replacement'}
                  onChange={(e) => setSwapType(e.target.value as SwapRequestData['swapType'])}
                  className="mt-0.5"
                  disabled={isSubmitting}
                />
                <div>
                  <div className="font-medium text-gray-900">Find Any Replacement</div>
                  <div className="text-sm text-gray-600">Ask for any available presenter to take over</div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="swapType"
                  value="swap_with_specific"
                  checked={swapType === 'swap_with_specific'}
                  onChange={(e) => setSwapType(e.target.value as SwapRequestData['swapType'])}
                  className="mt-0.5"
                  disabled={isSubmitting}
                />
                <div>
                  <div className="font-medium text-gray-900">Swap with Specific Presenter</div>
                  <div className="text-sm text-gray-600">Exchange presentation slots with another presenter</div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="swapType"
                  value="postpone_to_next"
                  checked={swapType === 'postpone_to_next'}
                  onChange={(e) => setSwapType(e.target.value as SwapRequestData['swapType'])}
                  className="mt-0.5"
                  disabled={isSubmitting}
                />
                <div>
                  <div className="font-medium text-gray-900">Postpone to Next Session</div>
                  <div className="text-sm text-gray-600">Move presentation to the next available slot</div>
                </div>
              </label>
            </div>
          </div>

          {/* Target Presenter Selection */}
          {swapType === 'swap_with_specific' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Presenter to Swap With *
              </label>
              <select
                value={targetPresenterId || ''}
                onChange={(e) => setTargetPresenterId(e.target.value ? Number(e.target.value) : undefined)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  errors.targetPresenter ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              >
                <option value="">Choose a presenter...</option>
                {availablePresenters.map((presenter) => (
                  <option key={presenter.id} value={presenter.id}>
                    {presenter.first_name} {presenter.last_name} ({presenter.username})
                  </option>
                ))}
              </select>
              {errors.targetPresenter && (
                <p className="text-red-500 text-xs mt-1">{errors.targetPresenter}</p>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Swap Request *
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                  errors.reason ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Please explain why you need to swap presentation slots..."
                disabled={isSubmitting}
              />
            </div>
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <ArrowUpDown className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SwapRequestModal;