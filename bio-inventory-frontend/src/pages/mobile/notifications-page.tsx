import { useState, useEffect, useContext } from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Bell, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-l-orange-500 bg-orange-50';
      case 'success':
        return 'border-l-green-500 bg-green-50';
      case 'error':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Bell className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-500 hover:bg-blue-600"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
        <p className="text-gray-600">
          {notifications.length} total, {unreadCount} unread
        </p>
      </div>

      {/* Mark All as Read Button */}
      {unreadCount > 0 && (
        <div className="flex justify-center">
          <Button
            onClick={markAllAsRead}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            Mark All as Read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card 
            key={notification.id} 
            className={`shadow-sm border-l-4 ${getNotificationColor(notification.type)} ${
              !notification.is_read ? 'ring-2 ring-blue-200' : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1">
                    <h3 className={`font-semibold text-gray-800 ${
                      !notification.is_read ? 'font-bold' : ''
                    }`}>
                      {notification.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                      {!notification.is_read && (
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                    
                    {/* Related Information */}
                    {notification.related_item && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded">
                        Related Item: {notification.related_item}
                      </div>
                    )}
                    {notification.related_request && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded">
                        Related Request: #{notification.related_request}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-2">
                  {!notification.is_read && (
                    <Button
                      onClick={() => markAsRead(notification.id)}
                      className="p-1 h-8 w-8 bg-blue-100 hover:bg-blue-200 text-blue-600"
                      title="Mark as read"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => deleteNotification(notification.id)}
                    className="p-1 h-8 w-8 bg-red-100 hover:bg-red-200 text-red-600"
                    title="Delete notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {notifications.length === 0 && !loading && (
        <div className="text-center py-8">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No notifications</p>
          <p className="text-sm text-gray-400 mt-2">
            You're all caught up!
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileNotificationsPage;