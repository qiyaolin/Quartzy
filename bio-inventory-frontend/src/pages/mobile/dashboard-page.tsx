import { useState, useEffect, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Package, AlertTriangle, TrendingUp, Users, Plus, Send } from 'lucide-react';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import ItemFormModal from '../../modals/ItemFormModal.tsx';
import RequestFormModal from '../../modals/RequestFormModal.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  totalUsers: number;
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

const MobileDashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    pendingRequests: 0,
    totalUsers: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isItemFormModalOpen, setIsItemFormModalOpen] = useState(false);
  const [isRequestFormModalOpen, setIsRequestFormModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('MobileDashboardPage must be used within an AuthProvider');
  }
  const { token } = authContext;
  const notification = useNotification();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const headers = { 'Authorization': `Token ${token}` };

        // 获取库存统计
        const [itemsRes, requestsRes, usersRes] = await Promise.all([
          fetch(buildApiUrl(API_ENDPOINTS.ITEMS), { headers }),
          fetch(buildApiUrl(API_ENDPOINTS.REQUESTS), { headers }),
          fetch(buildApiUrl(API_ENDPOINTS.USERS), { headers })
        ]);

        const items = await itemsRes.json();
        const requests = await requestsRes.json();
        const users = await usersRes.json();

        // 计算统计数据
        const totalItems = items.length;
        const lowStockItems = items.filter((item: any) => item.quantity <= (item.min_quantity || 5)).length;
        const pendingRequests = requests.filter((req: any) => req.status === 'NEW').length;
        const totalUsers = users.length;

        // 生成最近活动（基于最近的请求）
        const recentActivity = requests
          .slice(0, 5)
          .map((req: any) => ({
            id: req.id,
            type: 'request',
            description: `Request for ${req.item_name} by ${req.requested_by_name}`,
            timestamp: req.created_at
          }));

        setStats({
          totalItems,
          lowStockItems,
          pendingRequests,
          totalUsers,
          recentActivity
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, refreshKey]);

  const handleItemSaved = () => {
    setIsItemFormModalOpen(false);
    setRefreshKey(prev => prev + 1);
    notification.success('Item saved successfully!');
  };

  const handleRequestSaved = () => {
    setIsRequestFormModalOpen(false);
    setRefreshKey(prev => prev + 1);
    notification.success('Request created successfully!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Bio-Inventory Management System</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Package className="w-4 h-4 mr-2" />
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.lowStockItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingRequests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={() => setIsItemFormModalOpen(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Item
          </Button>
          <Button 
            onClick={() => setIsRequestFormModalOpen(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
          >
            <Send className="w-4 h-4 mr-2" />
            Create Request
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ItemFormModal
        isOpen={isItemFormModalOpen}
        onClose={() => setIsItemFormModalOpen(false)}
        onSave={handleItemSaved}
        token={token}
      />

      <RequestFormModal
        isOpen={isRequestFormModalOpen}
        onClose={() => setIsRequestFormModalOpen(false)}
        onSave={handleRequestSaved}
        token={token}
      />
    </div>
  );
};

export default MobileDashboardPage;