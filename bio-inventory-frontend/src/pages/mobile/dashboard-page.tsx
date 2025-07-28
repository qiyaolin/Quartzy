import { useState, useEffect, useContext } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  ShoppingCart, 
  Plus,
  Search,
  ScanLine,
  Activity,
  Zap,
  Star
} from 'lucide-react';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import { useNavigate } from 'react-router-dom';
import MobileItemFormModal from '../../modals/MobileItemFormModal.tsx';
import MobileRequestFormModal from '../../modals/MobileRequestFormModal.tsx';
import ZBarBarcodeScanner from '../../components/ZBarBarcodeScanner.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';

interface DashboardStats {
  total_items: number;
  low_stock_items: number;
  pending_requests: number;
  efficiency_score: number;
  recent_activities: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
    item_name?: string;
  }>;
}

const MobileDashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    total_items: 0,
    low_stock_items: 0,
    pending_requests: 0,
    efficiency_score: 0,
    recent_activities: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isItemFormModalOpen, setIsItemFormModalOpen] = useState(false);
  const [isRequestFormModalOpen, setIsRequestFormModalOpen] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('MobileDashboardPage must be used within an AuthProvider');
  }
  const { token, user } = authContext;
  const navigate = useNavigate();
  const notification = useNotification();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return;

      try {
        setLoading(true);
        
        // Fetch dashboard statistics in parallel
        const [itemsResponse, requestsResponse, notificationsResponse] = await Promise.all([
          fetch(buildApiUrl(API_ENDPOINTS.ITEMS), {
            headers: { 'Authorization': `Token ${token}` }
          }),
          fetch(buildApiUrl(API_ENDPOINTS.REQUESTS), {
            headers: { 'Authorization': `Token ${token}` }
          }),
          fetch(buildApiUrl(API_ENDPOINTS.NOTIFICATIONS), {
            headers: { 'Authorization': `Token ${token}` }
          })
        ]);

        if (itemsResponse.ok && requestsResponse.ok && notificationsResponse.ok) {
          const [itemsData, requestsData, notificationsData] = await Promise.all([
            itemsResponse.json(),
            requestsResponse.json(),
            notificationsResponse.json()
          ]);

          // Calculate statistics
          const totalItems = itemsData.length || 0;
          const lowStockItems = itemsData.filter((item: any) => 
            item.low_stock_threshold && item.quantity <= item.low_stock_threshold
          ).length || 0;
          const pendingRequests = requestsData.filter((req: any) => 
            req.status === 'NEW' || req.status === 'PENDING'
          ).length || 0;

          // Calculate efficiency score based on intuitive inventory health metrics
          const calculateEfficiencyScore = () => {
            if (totalItems === 0) return 85; // Default score for empty inventory
            
            // Stock Health: Higher score when less low stock items
            const stockHealthScore = totalItems > 0 ? Math.max(0, ((totalItems - lowStockItems) / totalItems) * 100) : 100;
            
            // Request Response: Higher score when fewer pending requests
            const maxPendingThreshold = Math.max(5, totalItems * 0.1); // 10% of items or min 5
            const requestResponseScore = Math.max(0, 100 - (pendingRequests / maxPendingThreshold) * 100);
            
            // Inventory Organization: Items with complete information
            const organizedItems = itemsData.filter((item: any) => 
              item.location && (item.low_stock_threshold || item.quantity > 0)
            ).length;
            const organizationScore = totalItems > 0 ? (organizedItems / totalItems) * 100 : 100;
            
            // Simple average with intuitive weighting:
            // 50% stock health (most important), 30% organization, 20% request response
            const efficiency = (stockHealthScore * 0.5 + organizationScore * 0.3 + requestResponseScore * 0.2);
            
            // Ensure score is between 0-100 and tends toward higher values for well-managed inventories
            return Math.round(Math.max(0, Math.min(efficiency, 100)));
          };

          const efficiencyScore = calculateEfficiencyScore();

          // Build comprehensive recent activities from multiple sources
          const buildRecentActivities = () => {
            const activities: any[] = [];
            
            // Recent items added (last 7 days)
            const recentItems = itemsData.filter((item: any) => {
              if (!item.created_at) return false;
              const itemDate = new Date(item.created_at);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return itemDate > weekAgo;
            }).slice(0, 3);

            recentItems.forEach((item: any, index: number) => {
              activities.push({
                id: `item_${item.id || index}`,
                type: 'item_added',
                description: `Added new inventory item: ${item.name || 'Unknown item'}`,
                timestamp: item.created_at,
                item_name: item.name
              });
            });

            // Recent requests (last 5)
            const recentRequests = requestsData
              .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .slice(0, 3);

            recentRequests.forEach((req: any) => {
              const statusText = req.status === 'NEW' ? 'created' : 
                               req.status === 'PENDING' ? 'pending' : 
                               req.status === 'APPROVED' ? 'approved' : 
                               req.status === 'COMPLETED' ? 'completed' : req.status;
              
              activities.push({
                id: `request_${req.id}`,
                type: req.status === 'APPROVED' ? 'request_approved' : 'request_created',
                description: `Purchase request ${statusText}: ${req.item_name || 'Unknown item'}`,
                timestamp: req.created_at || req.updated_at,
                user: req.requested_by_name || req.requested_by
              });
            });

            // Low stock alerts
            if (lowStockItems > 0) {
              const lowStockItem = itemsData.find((item: any) => 
                item.low_stock_threshold && item.quantity <= item.low_stock_threshold
              );
              if (lowStockItem) {
                activities.push({
                  id: 'low_stock_alert',
                  type: 'low_stock',
                  description: `Low stock alert: ${lowStockItem.name} (${lowStockItem.quantity} remaining)`,
                  timestamp: new Date().toISOString(),
                  item_name: lowStockItem.name
                });
              }
            }

            // Add notifications as fallback
            const notificationActivities = notificationsData.slice(0, 2).map((notif: any, index: number) => ({
              id: `notif_${notif.id || index}`,
              type: notif.type || 'info',
              description: notif.message || notif.title || 'System notification',
              timestamp: notif.created_at || new Date().toISOString()
            }));

            activities.push(...notificationActivities);

            // Sort by timestamp and return top 5
            return activities
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 5);
          };

          const recentActivities = buildRecentActivities();

          setStats({
            total_items: totalItems,
            low_stock_items: lowStockItems,
            pending_requests: pendingRequests,
            efficiency_score: efficiencyScore,
            recent_activities: recentActivities
          });
        } else {
          setError('Failed to fetch dashboard data');
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, refreshKey]);

  const quickActions = [
    {
      icon: Plus,
      label: 'Add Item',
      color: 'from-blue-500 to-cyan-500',
      action: () => setIsItemFormModalOpen(true),
      description: 'Add new inventory item'
    },
    {
      icon: ShoppingCart,
      label: 'New Request',
      color: 'from-purple-500 to-pink-500',
      action: () => setIsRequestFormModalOpen(true),
      description: 'Create purchase request'
    },
    {
      icon: Search,
      label: 'Search',
      color: 'from-green-500 to-emerald-500',
      action: () => navigate('/mobile/inventory'),
      description: 'Search inventory'
    },
    {
      icon: ScanLine,
      label: 'Scan Out',
      color: 'from-orange-500 to-red-500',
      action: () => setShowBarcodeScanner(true),
      description: 'Scan item checkout'
    }
  ];

  // Handler functions for modals
  const handleItemSaved = () => {
    setIsItemFormModalOpen(false);
    setRefreshKey(prev => prev + 1);
    notification.success('Item added successfully!');
  };

  const handleRequestSaved = () => {
    setIsRequestFormModalOpen(false);
    setRefreshKey(prev => prev + 1);
    notification.success('Request created successfully!');
  };

  const handleBarcodeScanned = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
  };

  const handleBarcodeConfirmed = async (barcode: string, itemData?: any) => {
    if (!token) {
      notification.error('Authentication required');
      return;
    }

    try {
      const checkoutData = {
        barcode: barcode,
        checkout_date: new Date().toISOString(),
        notes: `Mobile checkout via barcode scan: ${barcode}`
      };

      const response = await fetch(buildApiUrl('/api/items/checkout_by_barcode/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify(checkoutData)
      });

      if (response.ok) {
        const result = await response.json();
        notification.success(`Successfully checked out: ${result.item_name || itemData?.name || 'Item'}`);
        setRefreshKey(prev => prev + 1);
        setShowBarcodeScanner(false);
      } else {
        const errorData = await response.json();
        notification.error(`Checkout failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Barcode checkout error:', error);
      notification.error(`Failed to checkout item: ${error.message}`);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'item_added':
        return <Plus className="w-4 h-4 text-blue-600" />;
      case 'request_created':
        return <ShoppingCart className="w-4 h-4 text-purple-600" />;
      case 'request_approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBackgroundColor = (type: string) => {
    switch (type) {
      case 'item_added':
        return 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200';
      case 'request_created':
        return 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200';
      case 'request_approved':
        return 'bg-gradient-to-r from-green-50 to-green-100 border-green-200';
      case 'low_stock':
        return 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200';
      case 'request_rejected':
        return 'bg-gradient-to-r from-red-50 to-red-100 border-red-200';
      case 'order_placed':
        return 'bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200';
      case 'item_received':
        return 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200';
      default:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="text-center bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.2'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3Ccircle cx='53' cy='7' r='1'/%3E%3Ccircle cx='7' cy='53' r='1'/%3E%3Ccircle cx='53' cy='53' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>
      
      <div className="relative z-10 p-4 space-y-6 pb-40">
        {/* Welcome Header */}
        <div className="text-center py-6">
          <div className="inline-flex items-center space-x-3 bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-lg border border-white/20">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Welcome back!
              </h1>
              <p className="text-gray-500 text-sm">
                {user?.first_name || user?.username || 'User'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] min-h-[140px] flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="text-right flex-1 ml-3">
                <div className="text-2xl font-bold text-gray-800 leading-tight">{stats.total_items}</div>
                <div className="text-xs text-gray-500 font-medium mt-1">Total Items</div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>Status</span>
                <span className="font-medium">{stats.total_items > 0 ? 'Active' : 'Empty'}</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500" 
                  style={{width: stats.total_items > 0 ? '100%' : '0%'}}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] min-h-[140px] flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="text-right flex-1 ml-3">
                <div className="text-2xl font-bold text-gray-800 leading-tight">{stats.low_stock_items}</div>
                <div className="text-xs text-gray-500 font-medium mt-1">Low Stock</div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>Ratio</span>
                <span className="font-medium">{stats.total_items > 0 ? `${Math.round((stats.low_stock_items / stats.total_items) * 100)}%` : '0%'}</span>
              </div>
              <div className="w-full bg-orange-100 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500" 
                  style={{width: stats.total_items > 0 ? `${Math.min((stats.low_stock_items / stats.total_items) * 100, 100)}%` : '0%'}}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] min-h-[140px] flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div className="text-right flex-1 ml-3">
                <div className="text-2xl font-bold text-gray-800 leading-tight">{stats.pending_requests}</div>
                <div className="text-xs text-gray-500 font-medium mt-1">Pending</div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>Status</span>
                <span className="font-medium">{stats.pending_requests === 0 ? 'Complete' : 'Processing'}</span>
              </div>
              <div className="w-full bg-purple-100 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                  style={{width: stats.pending_requests > 0 ? `${Math.min((stats.pending_requests / 10) * 100, 100)}%` : '0%'}}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] min-h-[140px] flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="text-right flex-1 ml-3">
                <div className="text-2xl font-bold text-gray-800 leading-tight">{stats.efficiency_score}%</div>
                <div className="text-xs text-gray-500 font-medium mt-1">Efficiency</div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>Level</span>
                <span className="font-medium">
                  {stats.efficiency_score >= 90 ? 'Excellent' : 
                   stats.efficiency_score >= 75 ? 'Good' : 
                   stats.efficiency_score >= 60 ? 'Fair' : 'Poor'}
                </span>
              </div>
              <div className="w-full bg-green-100 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" 
                  style={{width: `${stats.efficiency_score}%`}}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] group"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-gray-800 text-sm mb-1">{action.label}</span>
                <span className="text-xs text-gray-500 text-center">{action.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Recent Activities</h3>
            </div>
            <Button
              onClick={() => navigate('/mobile/notifications')}
              className="bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 text-gray-600 font-semibold rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 text-xs px-3 py-2"
            >
              View All
            </Button>
          </div>
          
          <div className="space-y-3">
            {stats.recent_activities.length > 0 ? (
              stats.recent_activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className={`flex items-start space-x-3 p-3 rounded-xl border ${getActivityBackgroundColor(activity.type)}`}>
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No recent activities</p>
                <p className="text-sm text-gray-400 mt-1">Activities will appear here as you use the system</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">System Status</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">Database Connection</span>
              </div>
              <span className="text-xs text-green-600 font-semibold">Online</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">API Services</span>
              </div>
              <span className="text-xs text-green-600 font-semibold">Operational</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-blue-800">Last Backup</span>
              </div>
              <span className="text-xs text-blue-600 font-semibold">2 hours ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {token && (
        <>
          <MobileItemFormModal
            isOpen={isItemFormModalOpen}
            onClose={() => setIsItemFormModalOpen(false)}
            onSave={handleItemSaved}
            token={token}
          />
          
          <MobileRequestFormModal
            isOpen={isRequestFormModalOpen}
            onClose={() => setIsRequestFormModalOpen(false)}
            onSave={handleRequestSaved}
            token={token}
          />
          
          <ZBarBarcodeScanner
            isOpen={showBarcodeScanner}
            onClose={() => setShowBarcodeScanner(false)}
            onScan={handleBarcodeScanned}
            onConfirm={handleBarcodeConfirmed}
            title="Scan Out Item"
            token={token}
          />
        </>
      )}
    </div>
  );
};

export default MobileDashboardPage;
