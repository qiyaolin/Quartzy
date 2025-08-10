import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, Search } from 'lucide-react';
import { User } from '../services/groupMeetingApi.ts';

interface AssignUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  initialSelectedIds?: number[];
  onSubmit: (userIds: number[]) => Promise<void>;
  isSubmitting?: boolean;
}

const AssignUsersModal: React.FC<AssignUsersModalProps> = ({
  isOpen,
  onClose,
  users,
  initialSelectedIds = [],
  onSubmit,
  isSubmitting = false
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      setSearch('');
      setError(null);
    }
  }, [isOpen, initialSelectedIds]);

  const filteredUsers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u =>
      (u.first_name || '').toLowerCase().includes(s) ||
      (u.last_name || '').toLowerCase().includes(s) ||
      (u.username || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    );
  }, [users, search]);

  const toggleUser = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedIds(filteredUsers.map(u => u.id));
  const clearAll = () => setSelectedIds([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(selectedIds);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign users';
      setError(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Select Participants</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Search / Actions */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name/email"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded" disabled={isSubmitting}>Select All</button>
              <button type="button" onClick={clearAll} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded" disabled={isSubmitting}>Clear</button>
            </div>
          </div>

          {/* List */}
          <div className="border border-gray-200 rounded-lg divide-y">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No users found</div>
            ) : (
              filteredUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    disabled={isSubmitting}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</div>
                    <div className="text-xs text-gray-500 truncate">{u.email}</div>
                  </div>
                </label>
              ))
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-500">Selected: <span className="font-medium text-gray-700">{selectedIds.length}</span></div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" disabled={isSubmitting}>Cancel</button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? 'Saving...' : 'Save Participants'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignUsersModal;



