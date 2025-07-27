import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Bell, X, Check, Trash2, Filter } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: 'info' | 'success' | 'warning' | 'error' | 'inventory_alert' | 'request_update' | 'system';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_read: boolean;
  is_dismissed: boolean;
  action_url?: string;
  metadata: Record<string, any>;
  created_at: string;
  expires_at?: string;
  related_object?: {
    type: string;
    id: number;
    name?: string;
    title?: string;
  };
}

interface NotificationSummary {
  total: number;
  unread: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

const NotificationCenter: React.FC = () => {
  const { token } = useContext(AuthContext);
  const notification = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{
    type?: string;
    priority?: string;
    is_read?: boolean;
  }>({});

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.priority) params.append('priority', filter.priority);
      if (filter.is_read !== undefined) params.append('is_read', filter.is_read.toString());

      const response = await fetch(buildApiUrl(`/api/notifications/?${params.toString()}`), {
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.results || data);
      }
    } catch (error) {
      notification.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [token, filter, notification]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS_SUMMARY), {
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch notification summary:', error);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
    fetchSummary();
  }, [token, isOpen, filter, fetchNotifications, fetchSummary]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const markAsRead = async (notificationId: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}/mark_read/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        fetchSummary();
      }
    } catch (error) {
      notification.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        fetchSummary();
        notification.success('All notifications marked as read');
      }
    } catch (error) {
      notification.error('Failed to mark all notifications as read');
    }
  };

  const dismissNotification = async (notificationId: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}/dismiss/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        fetchSummary();
      }
    } catch (error) {
      notification.error('Failed to dismiss notification');
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'success':
        return <Check className={`${iconClass} text-green-500`} />;
      case 'warning':
        return <Bell className={`${iconClass} text-yellow-500`} />;
      case 'error':
        return <X className={`${iconClass} text-red-500`} />;
      case 'inventory_alert':
        return <Bell className={`${iconClass} text-orange-500`} />;
      case 'request_update':
        return <Bell className={`${iconClass} text-blue-500`} />;
      default:
        return <Bell className={`${iconClass} text-gray-500`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-300 bg-white';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-6 h-6" />
        {summary && summary.unread > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {summary.unread > 99 ? '99+' : summary.unread}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {summary && summary.unread > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center space-x-2 mt-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter.type || ''}
                onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value || undefined }))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="">All Types</option>
                <option value="inventory_alert">Inventory</option>
                <option value="request_update">Requests</option>
                <option value="system">System</option>
              </select>
              <select
                value={filter.is_read === undefined ? '' : filter.is_read.toString()}
                onChange={(e) => setFilter(prev => ({ 
                  ...prev, 
                  is_read: e.target.value === '' ? undefined : e.target.value === 'true' 
                }))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="">All</option>
                <option value="false">Unread</option>
                <option value="true">Read</option>
              </select>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b border-gray-100 border-l-4 ${getPriorityColor(notif.priority)} ${
                    !notif.is_read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      {getNotificationIcon(notif.notification_type)}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium ${!notif.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notif.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notif.created_at)}
                          </span>
                          <div className="flex items-center space-x-1">
                            {!notif.is_read && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => dismissNotification(notif.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Dismiss"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-800">
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;