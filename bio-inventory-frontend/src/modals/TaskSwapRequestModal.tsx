import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, MessageSquare } from 'lucide-react';

interface UserOption {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
}

export interface TaskSwapFormData {
  taskId: number;
  toUserId: number;
  reason: string;
}

interface TaskSwapRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle?: string;
  taskId: number | null;
  users: UserOption[];
  currentUserId: number | null;
  submitting?: boolean;
  onSubmit: (data: TaskSwapFormData) => Promise<void>;
}

const TaskSwapRequestModal: React.FC<TaskSwapRequestModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  taskId,
  users,
  currentUserId,
  submitting = false,
  onSubmit,
}) => {
  const [toUserId, setToUserId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setToUserId('');
      setReason('');
      setErrors({});
    }
  }, [isOpen]);

  const candidateUsers = useMemo(() => {
    return (users || []).filter(u => u.id !== currentUserId);
  }, [users, currentUserId]);

  if (!isOpen || taskId === null) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!toUserId) newErrors.to_user = 'Please select a colleague to swap with';
    if (!reason.trim()) newErrors.reason = 'Please provide a reason for the swap';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    
    try {
      await onSubmit({ taskId, toUserId: Number(toUserId), reason: reason.trim() });
      // Modal will be closed by parent component after successful submission
    } catch (error) {
      // Error handling is done in parent component
      console.error('Failed to submit swap request:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="font-semibold text-gray-900">Request Task Swap</div>
          <button className="p-2 hover:bg-gray-100 rounded" onClick={onClose} disabled={submitting}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {taskTitle && (
            <div className="text-sm text-gray-600">Task: <span className="font-medium text-gray-800">{taskTitle}</span></div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Swap with *</label>
            <div className="relative">
              <Users className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <select
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.to_user ? 'border-red-300' : 'border-gray-300'}`}
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value ? Number(e.target.value) : '')}
                disabled={submitting}
              >
                <option value="">Select colleague...</option>
                {candidateUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {(u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.username}
                  </option>
                ))}
              </select>
            </div>
            {errors.to_user && <p className="text-xs text-red-600 mt-1">{errors.to_user}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for swap *</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${errors.reason ? 'border-red-300' : 'border-gray-300'}`}
                rows={4}
                placeholder="Please explain the reason for the swap request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>
            {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button 
              type="button" 
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50" 
              onClick={onClose} 
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting || !toUserId || !reason.trim()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskSwapRequestModal;


