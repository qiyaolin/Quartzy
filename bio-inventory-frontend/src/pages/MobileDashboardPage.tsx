import React, { useState, useEffect } from 'react';
import { useDevice } from '../hooks/useDevice.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';
import MobileHeader from '../components/mobile/MobileHeader.tsx';
import { InventoryFAB } from '../components/mobile/MobileFloatingActionButton.tsx';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Users,
  Calendar,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  expiringSoon: number;
  totalValue: string;
  newRequests: number;
  pendingRequests: number;
  completedRequests: number;
  activeUsers: number;
  recentActivity: ActivityItem[];
  monthlyTrends: MonthlyData[];
}

interface ActivityItem {
  id: number;
  type: 'inventory' | 'request' | 'user';
  action: string;
  user: string;
  item: string;
  timestamp: string;
}

interface MonthlyData {
  month: string;
  inventoryValue: number;
  requestsCount: number;
  itemsAdded: number;
}

interface MobileDashboardPageProps {
  onNavigateToInventory: () => void;
  onOpenAddItemModal: () => void;
  onOpenNewRequestModal: () => void;
  onSetInventoryFilters: (filters: any) => void;
  onMenuToggle: () => void;
  token: string;
}

const MobileDashboardPage: React.FC<MobileDashboardPageProps> = ({
  onNavigateToInventory,
  onOpenAddItemModal,
  onOpenNewRequestModal,
  onSetInventoryFilters,
  onMenuToggle,
  token
}) => {
  const device = useDevice();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    expiringSoon: 0,
    totalValue: '$0',
    newRequests: 0,
    pendingRequests: 0,
    completedRequests: 0,
    activeUsers: 0,
    recentActivity: [],
    monthlyTrends: []
  });
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      // Fetch dashboard statistics
      const [inventoryRes, requestsRes, usersRes] = await Promise.all([
        fetch(buildApiUrl(API_ENDPOINTS.ITEMS), { headers: { 'Authorization': `Token ${token}` } }),
        fetch(buildApiUrl(API_ENDPOINTS.REQUESTS), { headers: { 'Authorization': `Token ${token}` } }),
        fetch(buildApiUrl(API_ENDPOINTS.USERS), { headers: { 'Authorization': `Token ${token}` } })
      ]);
      
      const [inventory, requests, users] = await Promise.all([
        inventoryRes.json(),
        requestsRes.json(),
        usersRes.json()
      ]);

      // Calculate inventory stats
      const totalItems = inventory.length;
      const lowStockItems = inventory.filter((item: any) => 
        item.low_stock_threshold && item.quantity <= item.low_stock_threshold
      ).length;
      const expiringSoon = inventory.filter((item: any) => {
        if (!item.expiration_date) return false;
        const expDate = new Date(item.expiration_date);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return expDate <= thirtyDaysFromNow;
      }).length;
      const totalValue = inventory.reduce((sum: number, item: any) => 
        sum + (item.cost || 0) * item.quantity, 0
      );

      // Calculate request stats
      const newRequests = requests.filter((req: any) => req.status === 'NEW').length;
      const pendingRequests = requests.filter((req: any) => ['NEW', 'APPROVED'].includes(req.status)).length;
      const completedRequests = requests.filter((req: any) => req.status === 'RECEIVED').length;

      // Mock recent activity and trends (replace with real API calls)
      const recentActivity: ActivityItem[] = [
        {
          id: 1,
          type: 'inventory',
          action: 'Added new item',
          user: 'John Smith',
          item: 'PCR Buffer Solution',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        {
          id: 2,
          type: 'request',
          action: 'Approved request',
          user: 'Jane Doe',
          item: 'Centrifuge Tubes',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        },
        {
          id: 3,
          type: 'inventory',
          action: 'Updated stock',
          user: 'Bob Wilson',
          item: 'DNA Ladder',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
        }
      ];

      const monthlyTrends: MonthlyData[] = [
        { month: 'Jan', inventoryValue: 45000, requestsCount: 12, itemsAdded: 8 },
        { month: 'Feb', inventoryValue: 48000, requestsCount: 15, itemsAdded: 12 },
        { month: 'Mar', inventoryValue: 52000, requestsCount: 18, itemsAdded: 15 },
        { month: 'Apr', inventoryValue: 49000, requestsCount: 14, itemsAdded: 9 }
      ];

      setStats({
        totalItems,
        lowStockItems,
        expiringSoon,
        totalValue: `$${totalValue.toLocaleString()}`,
        newRequests,
        pendingRequests,
        completedRequests,
        activeUsers: users.length,
        recentActivity,
        monthlyTrends
      });
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleLowStockClick = () => {
    onSetInventoryFilters({ low_stock: ['true'] });
    onNavigateToInventory();
  };

  const handleExpiringClick = () => {
    onSetInventoryFilters({ expired: ['true'] });
    onNavigateToInventory();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'inventory': return Package;
      case 'request': return FileText;
      case 'user': return Users;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'inventory': return 'text-primary-600 bg-primary-100';
      case 'request': return 'text-success-600 bg-success-100';
      case 'user': return 'text-warning-600 bg-warning-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (!device.isMobile) {
    return null; // This component is only for mobile
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Dashboard"
        showMenuToggle={true}
        onMenuToggle={onMenuToggle}
        notificationCount={stats.newRequests + stats.lowStockItems}
      />

      {/* Overview Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div 
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[120px] cursor-pointer hover:shadow-md active:scale-95 touch-manipulation transition-all duration-200"
            onClick={handleLowStockClick}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-danger-500 rounded-xl flex items-center justify-center shadow-sm">
                <AlertTriangle size={22} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{stats.lowStockItems}</p>
              <p className="text-sm text-gray-600 leading-tight font-medium">Low Stock Items</p>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[120px] cursor-pointer hover:shadow-md active:scale-95 touch-manipulation transition-all duration-200"
            onClick={handleExpiringClick}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-warning-500 rounded-xl flex items-center justify-center shadow-sm">
                <Calendar size={22} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{stats.expiringSoon}</p>
              <p className="text-sm text-gray-600 leading-tight font-medium">Expiring Soon</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[120px] transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center shadow-sm">
                <Package size={22} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{stats.totalItems}</p>
              <p className="text-sm text-gray-600 leading-tight font-medium">Total Items</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[120px] transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-success-500 rounded-xl flex items-center justify-center shadow-sm">
                <DollarSign size={22} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{stats.totalValue}</p>
              <p className="text-sm text-gray-600 leading-tight font-medium">Total Value</p>
            </div>
          </div>
        </div>

        {/* Requests Overview */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Requests Overview</h3>
            <FileText size={20} className="text-gray-400" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-info-600 mb-1">{stats.newRequests}</p>
              <p className="text-xs text-gray-600">New</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning-600 mb-1">{stats.pendingRequests}</p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success-600 mb-1">{stats.completedRequests}</p>
              <p className="text-xs text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Activity size={20} className="text-gray-400" />
          </div>
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);
              
              return (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-600">
                      {activity.user} • {activity.item}
                    </p>
                    <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onOpenAddItemModal}
              className="flex items-center justify-center p-4 bg-primary-50 text-primary-700 rounded-xl border border-primary-200 hover:bg-primary-100 transition-colors duration-200 touch-manipulation"
            >
              <Package size={20} className="mr-2" />
              <span className="font-medium">Add Item</span>
            </button>
            <button
              onClick={onOpenNewRequestModal}
              className="flex items-center justify-center p-4 bg-success-50 text-success-700 rounded-xl border border-success-200 hover:bg-success-100 transition-colors duration-200 touch-manipulation"
            >
              <FileText size={20} className="mr-2" />
              <span className="font-medium">New Request</span>
            </button>
            <button
              onClick={onNavigateToInventory}
              className="flex items-center justify-center p-4 bg-gray-50 text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors duration-200 touch-manipulation"
            >
              <BarChart3 size={20} className="mr-2" />
              <span className="font-medium">View Reports</span>
            </button>
            <button
              onClick={() => {/* Handle analytics */}}
              className="flex items-center justify-center p-4 bg-warning-50 text-warning-700 rounded-xl border border-warning-200 hover:bg-warning-100 transition-colors duration-200 touch-manipulation"
            >
              <PieChart size={20} className="mr-2" />
              <span className="font-medium">Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <InventoryFAB
        onAddItem={onOpenAddItemModal}
        onAddRequest={onOpenNewRequestModal}
      />
    </div>
  );
};

export default MobileDashboardPage;