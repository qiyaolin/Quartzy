import React, { useState, useEffect } from 'react';
import { useDevice } from '../hooks/useDevice';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import MobileHeader from '../components/mobile/MobileHeader';
import MobileFloatingActionButton from '../components/mobile/MobileFloatingActionButton';
import { User, Mail, Shield, Calendar, Edit3, Trash2, UserPlus } from 'lucide-react';

interface UserItem {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
}

interface MobileUsersPageProps {
  onEditUser: (user: UserItem) => void;
  onDeleteUser: (user: UserItem) => void;
  refreshKey: number;
  users: UserItem[];
  setUsers: (users: UserItem[]) => void;
  onMenuToggle: () => void;
  onAddUserClick: () => void;
  token: string;
}

const MobileUsersPage: React.FC<MobileUsersPageProps> = ({
  onEditUser,
  onDeleteUser,
  refreshKey,
  users,
  setUsers,
  onMenuToggle,
  onAddUserClick,
  token
}) => {
  const device = useDevice();
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);

  const fetchUsers = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.USERS),
        { headers: { 'Authorization': `Token ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshKey, token]);

  useEffect(() => {
    if (searchValue) {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.email.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.first_name.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [users, searchValue]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US');
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Never';
    const now = new Date();
    const date = new Date(dateString);
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    return formatDate(dateString);
  };

  if (!device.isMobile) {
    return null; // This component is only for mobile
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Users"
        showSearch={true}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        showMenuToggle={true}
        onMenuToggle={onMenuToggle}
        showAdd={true}
        onAddClick={onAddUserClick}
      />

      {/* Stats Cards */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[100px] transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-sm">
                <User size={18} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 mb-1">{users.length}</p>
              <p className="text-xs text-gray-600 leading-tight font-medium">Total Users</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[100px] transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-success-500 rounded-xl flex items-center justify-center shadow-sm">
                <Shield size={18} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 mb-1">
                {users.filter(user => user.is_staff).length}
              </p>
              <p className="text-xs text-gray-600 leading-tight font-medium">Administrators</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[100px] transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-warning-500 rounded-xl flex items-center justify-center shadow-sm">
                <Calendar size={18} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 mb-1">
                {users.filter(user => user.is_active).length}
              </p>
              <p className="text-xs text-gray-600 leading-tight font-medium">Active Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-32 animate-pulse"></div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No users found</div>
            <p className="text-gray-500 text-sm">
              {searchValue ? 'Try adjusting your search' : 'Tap the button above to add a new user'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 touch-manipulation active:scale-[0.98]"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-semibold shadow-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-base truncate">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.username
                          }
                        </h3>
                        <p className="text-sm text-gray-600 truncate">@{user.username}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() => onEditUser(user)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors duration-200 touch-manipulation"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => onDeleteUser(user)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-colors duration-200 touch-manipulation"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center space-x-2 mb-4">
                    {user.is_staff && (
                      <div className="flex items-center space-x-1 bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
                        <Shield size={12} />
                        <span className="text-xs font-medium">Administrator</span>
                      </div>
                    )}
                    <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                      user.is_active 
                        ? 'bg-success-100 text-success-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        user.is_active ? 'bg-success-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs font-medium">
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* User details */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <Mail size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="font-medium min-w-0">Email:</span>
                      <span className="truncate">{user.email}</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="font-medium min-w-0">Joined:</span>
                      <span className="truncate">{formatDate(user.date_joined)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <User size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="font-medium min-w-0">Last login:</span>
                      <span className="truncate">{formatTimeAgo(user.last_login)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <MobileFloatingActionButton
        primaryAction={{
          icon: UserPlus,
          onClick: onAddUserClick
        }}
      />
    </div>
  );
};

export default MobileUsersPage;