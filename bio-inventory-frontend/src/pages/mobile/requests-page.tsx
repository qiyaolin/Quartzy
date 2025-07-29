import { useState, useEffect, useContext } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Search, Plus, Clock, CheckCircle, XCircle, User, Package, Eye, History, RotateCcw, ShoppingCart, FileDown, Calendar, DollarSign, Building, Zap } from 'lucide-react';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import MobileRequestFormModal from '../../modals/MobileRequestFormModal.tsx';
import RequestDetailModal from '../../modals/RequestDetailModal.tsx';
import RequestHistoryModal from '../../modals/RequestHistoryModal.tsx';
import MobileMarkReceivedModal from '../../modals/MobileMarkReceivedModal.tsx';
import FundSelectionModal from '../../modals/FundSelectionModal.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';
import { exportToExcel } from '../../utils/excelExport.ts';

interface Request {
  id: number;
  product_name?: string;
  item_name: string;
  specifications?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  status: string;
  requester_name?: string;
  requested_by_name: string;
  requested_by: number;
  approved_by_name?: string;
  received_by_name?: string;
  created_at: string;
  updated_at: string;
  requested_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  vendor?: string | { id: number; name: string; website?: string };
  product_link?: string;
  urgency?: string;
  department?: string;
  lab?: string;
}

const MobileRequestsPage = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'ordered' | 'received'>('pending');
  const [isRequestFormModalOpen, setIsRequestFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
  const [isFundSelectionModalOpen, setIsFundSelectionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [historyData, setHistoryData] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('MobileRequestsPage must be used within an AuthProvider');
  }
  const { token, user } = authContext;
  const notification = useNotification();

  useEffect(() => {
    const fetchRequests = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS), {
          headers: { 'Authorization': `Token ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setRequests(data);
        } else {
          setError('Failed to fetch requests');
        }
      } catch (err) {
        console.error('Error fetching requests:', err);
        setError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [token, refreshKey]);

  useEffect(() => {
    let filtered = requests;

    // Filter by status
    const statusMapping = {
      'pending': 'NEW',
      'approved': 'APPROVED', 
      'ordered': 'ORDERED',
      'received': 'RECEIVED'
    };
    const mappedStatus = statusMapping[activeTab] || activeTab.toUpperCase();
    filtered = filtered.filter(req => req.status === mappedStatus);

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(req =>
        (req.item_name || req.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.requested_by_name || req.requester_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.specifications || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof req.vendor === 'object' && req.vendor !== null
          ? req.vendor.name || ''
          : req.vendor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.department || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRequests(filtered);
  }, [requests, searchTerm, activeTab]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'pending':
        return {
          icon: Clock,
          text: 'Pending',
          color: 'text-orange-600',
          bg: 'bg-gradient-to-r from-orange-100 to-orange-200',
          dotColor: 'bg-orange-500',
          borderColor: 'border-orange-200'
        };
      case 'APPROVED':
      case 'approved':
        return {
          icon: CheckCircle,
          text: 'Approved',
          color: 'text-green-600',
          bg: 'bg-gradient-to-r from-green-100 to-green-200',
          dotColor: 'bg-green-500',
          borderColor: 'border-green-200'
        };
      case 'ORDERED':
      case 'ordered':
        return {
          icon: ShoppingCart,
          text: 'Ordered',
          color: 'text-blue-600',
          bg: 'bg-gradient-to-r from-blue-100 to-blue-200',
          dotColor: 'bg-blue-500',
          borderColor: 'border-blue-200'
        };
      case 'RECEIVED':
      case 'received':
        return {
          icon: Package,
          text: 'Received',
          color: 'text-purple-600',
          bg: 'bg-gradient-to-r from-purple-100 to-purple-200',
          dotColor: 'bg-purple-500',
          borderColor: 'border-purple-200'
        };
      case 'REJECTED':
      case 'rejected':
        return {
          icon: XCircle,
          text: 'Rejected',
          color: 'text-red-600',
          bg: 'bg-gradient-to-r from-red-100 to-red-200',
          dotColor: 'bg-red-500',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: Clock,
          text: status,
          color: 'text-gray-600',
          bg: 'bg-gradient-to-r from-gray-100 to-gray-200',
          dotColor: 'bg-gray-500',
          borderColor: 'border-gray-200'
        };
    }
  };

  const getUrgencyConfig = (urgency?: string) => {
    switch (urgency?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return {
          text: 'Urgent',
          color: 'text-red-600',
          bg: 'bg-gradient-to-r from-red-100 to-red-200',
          icon: Zap
        };
      case 'medium':
        return {
          text: 'Medium',
          color: 'text-orange-600',
          bg: 'bg-gradient-to-r from-orange-100 to-orange-200',
          icon: Clock
        };
      case 'low':
        return {
          text: 'Low',
          color: 'text-green-600',
          bg: 'bg-gradient-to-r from-green-100 to-green-200',
          icon: Clock
        };
      default:
        return null;
    }
  };

  const handleCreateRequest = () => {
    setIsRequestFormModalOpen(true);
  };

  const handleRequestSaved = () => {
    setIsRequestFormModalOpen(false);
    setRefreshKey(prev => prev + 1);
    notification.success('Request created successfully!');
  };

  const handleApproveRequest = async (requestId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/requests/${requestId}/approve/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        notification.success('Request approved successfully');
      } else {
        notification.error('Failed to approve request');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      notification.error('Error approving request');
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/requests/${requestId}/reject/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        notification.success('Request rejected successfully');
      } else {
        notification.error('Failed to reject request');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      notification.error('Error rejecting request');
    }
  };

  const handlePlaceOrder = (requestId: number) => {
    const request = requests.find(req => req.id === requestId);
    if (request) {
      setSelectedRequest(request);
      setIsFundSelectionModalOpen(true);
    }
  };

  const handlePlaceOrderWithFund = async (requestId: number, fundId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/requests/${requestId}/place_order/`), {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fund_id: fundId })
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        notification.success('Order placed successfully');
      } else {
        notification.error('Failed to place order');
      }
    } catch (err) {
      console.error('Error placing order:', err);
      notification.error('Error placing order');
    }
  };

  const handleMarkReceived = (request: Request) => {
    setSelectedRequest(request);
    setIsReceivedModalOpen(true);
  };

  const handleSaveReceived = async (requestId: number, data: any) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/requests/${requestId}/mark_received/`), {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        notification.success('Request marked as received');
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to mark as received: ${errorText}`);
      }
    } catch (err) {
      console.error('Error marking as received:', err);
      notification.error(err.message || 'Error marking as received');
      throw err;
    }
  };

  const handleReorder = async (requestId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/requests/${requestId}/reorder/`), {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        notification.success('Request reordered successfully');
      } else {
        notification.error('Failed to reorder request');
      }
    } catch (err) {
      console.error('Error reordering request:', err);
      notification.error('Error reordering request');
    }
  };

  const handleViewDetails = (request: Request) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleDetailSave = () => {
    setRefreshKey(prev => prev + 1);
    setIsDetailModalOpen(false);
  };

  const handleShowHistory = async (requestId: number) => {
    if (!token) return;

    try {
      const response = await fetch(buildApiUrl(`/api/requests/${requestId}/history/`), {
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data);
        setIsHistoryModalOpen(true);
      } else {
        notification.error('Failed to fetch request history');
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      notification.error('Error fetching request history');
    }
  };

  const handleBatchExport = () => {
    const formattedRequests = filteredRequests.map(req => ({
      'Request ID': req.id,
      'Product Name': req.product_name || req.item_name,
      'Specifications': req.specifications || '',
      'Quantity': req.quantity,
      'Unit Price': req.unit_price ? `$${req.unit_price}` : '',
      'Total Price': req.total_price ? `$${req.total_price}` : '',
      'Status': getStatusConfig(req.status).text,
      'Requester': req.requester_name || req.requested_by_name,
      'Department': req.department || '',
      'Laboratory': req.lab || '',
      'Vendor': typeof req.vendor === 'object' && req.vendor !== null
        ? req.vendor.name || 'Unknown Vendor'
        : req.vendor || '',
      'Product Link': req.product_link || '',
      'Urgency': req.urgency || '',
      'Request Date': req.requested_date ? new Date(req.requested_date).toLocaleDateString('en-US') : 
                      req.created_at ? new Date(req.created_at).toLocaleDateString('en-US') : '',
      'Expected Delivery': req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString('en-US') : '',
      'Notes': req.notes || ''
    }));

    const summary = {
      'Export Time': new Date().toLocaleString('en-US'),
      'Export Count': filteredRequests.length,
      'Status Filter': getStatusConfig(activeTab).text,
      'Total Value': `$${filteredRequests.reduce((sum, req) => sum + (parseFloat(req.total_price) || 0), 0).toFixed(2)}`
    };

    exportToExcel({
      fileName: `mobile-requests-${activeTab}-export`,
      sheetName: 'Mobile Requests',
      title: 'Mobile Laboratory Purchase Requests Export',
      data: formattedRequests,
      summary: summary
    });

    notification.success(`Exported ${filteredRequests.length} requests to Excel`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="text-center bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <p className="text-red-600 font-medium mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xs px-3 py-2"
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
        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center space-x-3 bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-lg border border-white/20">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Requests
              </h1>
              <p className="text-gray-500 text-sm">{filteredRequests.length} requests found</p>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 overflow-hidden">
          <div className="grid grid-cols-4">
            {[
              { key: 'pending', label: 'New', apiKey: 'NEW', color: 'orange' },
              { key: 'approved', label: 'Approved', apiKey: 'APPROVED', color: 'green' },
              { key: 'ordered', label: 'Ordered', apiKey: 'ORDERED', color: 'blue' },
              { key: 'received', label: 'Received', apiKey: 'RECEIVED', color: 'purple' }
            ].map((tab) => {
              const count = requests.filter(req => req.status === tab.apiKey).length;
              const isActive = activeTab === tab.key;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'pending' | 'approved' | 'ordered' | 'received')}
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
                    {count}
                  </div>
                  {isActive && (
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-${tab.color}-500 to-${tab.color}-600 rounded-t-full`}></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-white/20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search requests, products, requesters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white/70 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const urgencyConfig = getUrgencyConfig(request.urgency);
            // const StatusIcon = statusConfig.icon;
            
            return (
              <div key={request.id} className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                {/* Header */}
                <div className="flex items-start mb-4 gap-3">
                  <div className="flex items-center min-w-0 flex-1" onClick={() => handleViewDetails(request)}>
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1 ml-3">
                      <h3 className="font-bold text-gray-800 text-lg cursor-pointer hover:text-purple-600 transition-colors min-w-0 overflow-hidden leading-tight">
                        <span className="block truncate" title={request.product_name || request.item_name}>
                          {(request.product_name || request.item_name).length > 20 
                            ? `${(request.product_name || request.item_name).substring(0, 20)}...`
                            : (request.product_name || request.item_name)
                          }
                        </span>
                      </h3>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2 flex-shrink-0" style={{ minWidth: '110px', maxWidth: '110px' }}>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.color} border border-white/20 w-full justify-center`}>
                      <div className={`w-2 h-2 ${statusConfig.dotColor} rounded-full mr-1 flex-shrink-0`}></div>
                      <span className="truncate text-center">{statusConfig.text}</span>
                    </div>
                    {urgencyConfig && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${urgencyConfig.bg} ${urgencyConfig.color} border border-white/20 w-full justify-center`}>
                        <urgencyConfig.icon className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate text-center">{urgencyConfig.text}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Specifications - moved outside header */}
                <div className="mb-4" onClick={() => handleViewDetails(request)}>
                  <div className="flex-1">
                    {request.specifications && (
                      <div className="ml-13 bg-gradient-to-r from-gray-50 to-blue-50 p-2 rounded-lg overflow-hidden">
                        <p className="text-sm text-gray-600 overflow-hidden" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.4rem',
                          maxHeight: '2.8rem'
                        }} title={request.specifications}>
                          {request.specifications.length > 80 
                            ? `${request.specifications.substring(0, 80)}...`
                            : request.specifications
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Details Grid */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-800">Qty: {request.quantity}</span>
                    </div>
                    
                    {request.unit_price && (
                      <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-700">${request.unit_price}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <User className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-700">
                      {request.status === 'RECEIVED' ? (
                        `Received by: ${request.received_by_name || 'Unknown'}`
                      ) : (
                        `By: ${request.requester_name || request.requested_by_name}`
                      )}
                    </span>
                  </div>
                  
                  {request.vendor && (
                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl">
                      <div className="w-4 h-4 text-center text-indigo-600">🏪</div>
                      <span className="font-medium text-gray-700">
                        Vendor: {typeof request.vendor === 'object' && request.vendor !== null
                          ? (request.vendor as any).name || 'Unknown Vendor'
                          : request.vendor}
                      </span>
                    </div>
                  )}
                  
                  {request.department && (
                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                      <Building className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-gray-700">Dept: {request.department}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-700">
                      Created: {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {request.expected_delivery_date && (
                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span className="font-medium text-gray-700">
                        Expected: {new Date(request.expected_delivery_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {request.approved_by_name && (
                    <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                      <span className="text-sm text-green-700 font-medium">
                        ✓ Approved by: {request.approved_by_name}
                      </span>
                    </div>
                  )}
                  
                  {request.notes && (
                    <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                      <div className="text-xs text-yellow-700 font-semibold mb-1">Notes:</div>
                      <div className="text-sm text-yellow-800">{request.notes}</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Primary Actions based on status */}
                  {request.status === 'NEW' && user?.is_staff && (
                    <>
                      <Button
                        onClick={() => handleApproveRequest(request.id)}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleRejectRequest(request.id)}
                        className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  
                  {request.status === 'APPROVED' && user?.is_staff && (
                    <Button
                      onClick={() => handlePlaceOrder(request.id)}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Place Order
                    </Button>
                  )}
                  
                  {request.status === 'ORDERED' && user?.is_staff && (
                    <Button
                      onClick={() => handleMarkReceived(request)}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Mark Received
                    </Button>
                  )}
                  
                  {request.status === 'RECEIVED' && (
                    <Button
                      onClick={() => handleReorder(request.id)}
                      className="flex-1 bg-gradient-to-r from-gray-600 to-slate-600 hover:from-gray-700 hover:to-slate-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reorder
                    </Button>
                  )}
                  
                  {/* Secondary Actions */}
                  <Button
                    onClick={() => handleViewDetails(request)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-0"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Details
                  </Button>
                  
                  <Button
                    onClick={() => handleShowHistory(request.id)}
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-0"
                  >
                    <History className="w-4 h-4 mr-2" />
                    History
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredRequests.length === 0 && !loading && (
          <div className="text-center py-12 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
            <div className="w-20 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-2">No requests found</h3>
            <p className="text-gray-500 mb-6">
              No {getStatusConfig(activeTab).text.toLowerCase()} requests found
            </p>
            <Button
              onClick={handleCreateRequest}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Request
            </Button>
          </div>
        )}

        {/* Export Section */}
        {filteredRequests.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <FileDown className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Export Options</h3>
                </div>
                <p className="text-sm text-gray-500 ml-11">
                  {filteredRequests.length} requests in current view
                </p>
              </div>
              <Button
                onClick={handleBatchExport}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </div>
        )}

        {/* Floating Action Button */}
        <div className="fixed bottom-20 right-4 z-50">
          <button
            onClick={handleCreateRequest}
            className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Modals */}
        <MobileRequestFormModal
          isOpen={isRequestFormModalOpen}
          onClose={() => setIsRequestFormModalOpen(false)}
          onSave={handleRequestSaved}
          token={token}
        />
        
        <RequestDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onSave={handleDetailSave}
          token={token}
          request={selectedRequest}
        />
        
        <RequestHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          history={historyData}
        />
        
        <MobileMarkReceivedModal
          isOpen={isReceivedModalOpen}
          onClose={() => setIsReceivedModalOpen(false)}
          onSave={handleSaveReceived}
          token={token}
          request={selectedRequest}
        />
        
        <FundSelectionModal
          isOpen={isFundSelectionModalOpen}
          onClose={() => setIsFundSelectionModalOpen(false)}
          onPlaceOrder={handlePlaceOrderWithFund}
          token={token}
          request={selectedRequest}
        />
      </div>
    </div>
  );
};

export default MobileRequestsPage;
