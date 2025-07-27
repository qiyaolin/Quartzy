import { useState, useEffect, useContext } from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Bell, AlertTriangle, CheckCircle, Info, Trash2, Check, Calendar, Package, User, Clock, Filter } from 'lucide-react';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_item?: string;
  related_request?: number;
}

const MobileNotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'read'>('all');

  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('MobileNotificationsPage must be used within an AuthProvider');
  }
  const { token } = authContext;

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS), {
          headers: { 'Authorization': `Token ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setNotifications(data);
        } else {
          setError('Failed to fetch notifications');
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [token]);

  useEffect(() => {
    let filtered = notifications;

    switch (activeFilter) {
      case 'unread':
        filtered = notifications.filter(notif => !notif.is_read);
        break;
      case 'read':
        filtered = notifications.filter(notif => notif.is_read);
        break;
      default:
        filtered = notifications;
    }

    // Sort by created_at (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setFilteredNotifications(filtered);
  }, [notifications, activeFilter]);

  const getNotificationConfig = (type: string) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bg: 'bg-gradient-to-r from-green-100 to-green-200',
          dotColor: 'bg-green-500',
          borderColor: 'border-green-200'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600',
          bg: 'bg-gradient-to-r from-orange-100 to-orange-200',
          dotColor: 'bg-orange-500',
          borderColor: 'border-orange-200'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bg: 'bg-gradient-to-r from-red-100 to-red-200',
          dotColor: 'bg-red-500',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: Info,
          color: 'text-blue-600',
          bg: 'bg-gradient-to-r from-blue-100 to-blue-200',
          dotColor: 'bg-blue-500',
          borderColor: 'border-blue-200'
        };
    }
  };

  const markAsRead = async (notificationId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}/mark_read/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}/`), {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl('/api/notifications/mark_all_read/'), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const groups: { [key: string]: Notification[] } = {};
    
    notifications.forEach(notif => {
      const date = new Date(notif.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = date.toLocaleDateString();
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notif);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="text-center bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.2'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3Ccircle cx='53' cy='7' r='1'/%3E%3Ccircle cx='7' cy='53' r='1'/%3E%3Ccircle cx='53' cy='53' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>
      
      <div className="relative z-10 p-4 space-y-6 pb-24">
        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center space-x-3 bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-lg border border-white/20">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Notifications
              </h1>
              <p className="text-gray-500 text-sm">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 overflow-hidden">
          <div className="grid grid-cols-3">
            {[
              { key: 'all', label: 'All', count: notifications.length, color: 'indigo' },
              { key: 'unread', label: 'Unread', count: unreadCount, color: 'orange' },
              { key: 'read', label: 'Read', count: notifications.length - unreadCount, color: 'green' }
            ].map((tab) => {
              const isActive = activeFilter === tab.key;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key as 'all' | 'unread' | 'read')}
                  className={`relative flex flex-col items-center py-4 px-2 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? `text-${tab.color}-700 bg-gradient-to-b from-${tab.color}-50 to-${tab.color}-100`
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span className="mb-2">{tab.label}</span>
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? `bg-gradient-to-r from-${tab.color}-200 to-${tab.color}-300 text-${tab.color}-800 shadow-sm`
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </div>
                  {isActive && (
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-${tab.color}-500 to-${tab.color}-600 rounded-t-full`}></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mark All Read Button */}
        {unreadCount > 0 && (
          <div className="flex justify-end">
            <Button
              onClick={markAllAsRead}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
            <div key={dateGroup}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-700">{dateGroup}</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent"></div>
              </div>
              <div className="space-y-3">
                {groupNotifications.map((notification) => {
                  const config = getNotificationConfig(notification.type);
                  const NotificationIcon = config.icon;
                  
                  return (
                    <div key={notification.id} className={`bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] ${!notification.is_read ? 'ring-2 ring-blue-200' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className={`w-12 h-12 ${config.bg} rounded-xl flex items-center justify-center border ${config.borderColor}`}>
                            <NotificationIcon className={`w-6 h-6 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className={`font-bold text-gray-800 ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <div className={`w-3 h-3 ${config.dotColor} rounded-full animate-pulse`}></div>
                              )}
                            </div>
                            <p className={`text-sm mb-3 leading-relaxed ${!notification.is_read ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                              {notification.message}
                            </p>
                            
                            {/* Meta Information */}
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimeAgo(notification.created_at)}</span>
                              </span>
                            </div>
                            
                            {/* Related Information */}
                            {(notification.related_item || notification.related_request) && (
                              <div className="space-y-2">
                                {notification.related_item && (
                                  <div className="flex items-center space-x-2 p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                    <Package className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm text-blue-700 font-medium">
                                      Related Item: {notification.related_item}
                                    </span>
                                  </div>
                                )}
                                {notification.related_request && (
                                  <div className="flex items-center space-x-2 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                    <User className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm text-purple-700 font-medium">
                                      Related Request: #{notification.related_request}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-2 ml-4">
                          {!notification.is_read && (
                            <Button
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 h-10 w-10 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 text-blue-600 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-110 active:scale-95"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-2 h-10 w-10 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 text-red-600 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-110 active:scale-95"
                            title="Delete notification"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredNotifications.length === 0 && !loading && (
          <div className="text-center py-12 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
            <div className="w-20 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-2">No notifications found</h3>
            <p className="text-gray-500 mb-6">
              {activeFilter === 'unread' ? 'No unread notifications' : 
               activeFilter === 'read' ? 'No read notifications' : 
               'You\'re all caught up!'}
            </p>
            {activeFilter !== 'all' && (
              <Button
                onClick={() => setActiveFilter('all')}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                View All Notifications
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileNotificationsPage;