import { useState, useEffect, useContext } from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Search, Plus, Clock, CheckCircle, XCircle, User, Package, Eye, History, RotateCcw, ShoppingCart, FileDown } from 'lucide-react';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import RequestFormModal from '../../modals/RequestFormModal.tsx';
import RequestDetailModal from '../../modals/RequestDetailModal.tsx';
import RequestHistoryModal from '../../modals/RequestHistoryModal.tsx';
import MarkReceivedModal from '../../modals/MarkReceivedModal.tsx';
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

    // 根据状态过滤
    const statusMapping = {
      'pending': 'NEW',
      'approved': 'APPROVED', 
      'ordered': 'ORDERED',
      'received': 'RECEIVED'
    };
    const mappedStatus = statusMapping[activeTab] || activeTab.toUpperCase();
    filtered = filtered.filter(req => req.status === mappedStatus);

    // 搜索过滤
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'APPROVED':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'ORDERED':
      case 'ordered':
        return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      case 'RECEIVED':
      case 'received':
        return <Package className="w-4 h-4 text-purple-500" />;
      case 'REJECTED':
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'pending':
        return 'Pending';
      case 'APPROVED':
      case 'approved':
        return 'Approved';
      case 'ORDERED':
      case 'ordered':
        return 'Ordered';
      case 'RECEIVED':
      case 'received':
        return 'Received';
      case 'REJECTED':
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'pending':
        return 'text-orange-600 bg-orange-50';
      case 'APPROVED':
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'ORDERED':
      case 'ordered':
        return 'text-blue-600 bg-blue-50';
      case 'RECEIVED':
      case 'received':
        return 'text-purple-600 bg-purple-50';
      case 'REJECTED':
      case 'rejected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
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
        setRefreshKey(prev => prev + 1); // Refresh data
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
        setRefreshKey(prev => prev + 1); // Refresh data
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
    // Find the request and open fund selection modal
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
        setRefreshKey(prev => prev + 1); // Refresh data
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
        setRefreshKey(prev => prev + 1); // Refresh data
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
    setRefreshKey(prev => prev + 1); // Refresh data
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
    // Export filtered requests
    const formattedRequests = filteredRequests.map(req => ({
      'Request ID': req.id,
      'Product Name': req.product_name || req.item_name,
      'Specifications': req.specifications || '',
      'Quantity': req.quantity,
      'Unit Price': req.unit_price ? `$${req.unit_price}` : '',
      'Total Price': req.total_price ? `$${req.total_price}` : '',
      'Status': getStatusText(req.status),
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
      'Status Filter': getStatusText(activeTab),
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-12 h-12 text-red-500 mx-auto" />
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

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen pb-20">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Requests</h1>
        <p className="text-gray-600">{filteredRequests.length} requests found</p>
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex">
          {[
            { key: 'pending', label: 'New', apiKey: 'NEW' },
            { key: 'approved', label: 'Approved', apiKey: 'APPROVED' },
            { key: 'ordered', label: 'Ordered', apiKey: 'ORDERED' },
            { key: 'received', label: 'Received', apiKey: 'RECEIVED' }
          ].map((tab) => {
            const count = requests.filter(req => req.status === tab.apiKey).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'pending' | 'approved' | 'ordered' | 'received')}
                className={`flex-1 flex flex-col items-center py-3 px-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search requests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.map((request) => (
          <Card key={request.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 mr-3" onClick={() => handleViewDetails(request)}>
                  <h3 className="font-semibold text-gray-800 text-lg cursor-pointer hover:text-blue-600">
                    {request.product_name || request.item_name}
                  </h3>
                  {request.specifications && (
                    <p className="text-sm text-gray-600 mt-1">{request.specifications}</p>
                  )}
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  <span className="ml-1">{getStatusText(request.status)}</span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center">
                    <Package className="w-4 h-4 mr-2" />
                    <span>Qty: {request.quantity}</span>
                  </div>
                  
                  {request.unit_price && (
                    <div className="flex items-center">
                      <span className="text-green-600 font-semibold">${request.unit_price}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  <span>By: {request.requester_name || request.requested_by_name}</span>
                </div>
                
                {request.vendor && (
                  <div className="flex items-center">
                    <span className="w-4 h-4 mr-2 text-center">🏪</span>
                    <span>Vendor: {typeof request.vendor === 'object' && request.vendor !== null
                      ? (request.vendor as any).name || 'Unknown Vendor'
                      : request.vendor}</span>
                  </div>
                )}
                
                {request.department && (
                  <div className="flex items-center">
                    <span className="w-4 h-4 mr-2 text-center">🏢</span>
                    <span>Dept: {request.department}</span>
                  </div>
                )}
                
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
                </div>
                
                {request.expected_delivery_date && (
                  <div className="flex items-center">
                    <span className="w-4 h-4 mr-2 text-center">📅</span>
                    <span>Expected: {new Date(request.expected_delivery_date).toLocaleDateString()}</span>
                  </div>
                )}
                
                {request.approved_by_name && (
                  <div className="text-xs text-gray-500">
                    Approved by: {request.approved_by_name}
                  </div>
                )}
                
                {request.notes && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    Notes: {request.notes}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                {/* Primary Actions based on status */}
                {request.status === 'NEW' && user?.is_staff && (
                  <>
                    <Button
                      onClick={() => handleApproveRequest(request.id)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm py-2"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectRequest(request.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                
                {request.status === 'APPROVED' && user?.is_staff && (
                  <Button
                    onClick={() => handlePlaceOrder(request.id)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2"
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    Place Order
                  </Button>
                )}
                
                {request.status === 'ORDERED' && user?.is_staff && (
                  <Button
                    onClick={() => handleMarkReceived(request)}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-sm py-2"
                  >
                    <Package className="w-4 h-4 mr-1" />
                    Mark Received
                  </Button>
                )}
                
                {request.status === 'RECEIVED' && (
                  <Button
                    onClick={() => handleReorder(request.id)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-sm py-2"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reorder
                  </Button>
                )}
                
                {/* Secondary Actions */}
                <Button
                  onClick={() => handleViewDetails(request)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm py-2 px-3"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Details
                </Button>
                
                <Button
                  onClick={() => handleShowHistory(request.id)}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm py-2 px-3"
                >
                  <History className="w-4 h-4 mr-1" />
                  History
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRequests.length === 0 && !loading && (
        <div className="text-center py-8">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No requests found</p>
          <p className="text-sm text-gray-400 mt-2">
            No {getStatusText(activeTab).toLowerCase()} requests found
          </p>
        </div>
      )}

      {/* Export Section */}
      {filteredRequests.length > 0 && (
        <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Export Options</h3>
              <p className="text-xs text-gray-500">{filteredRequests.length} requests in current view</p>
            </div>
            <Button
              onClick={handleBatchExport}
              className="bg-green-500 hover:bg-green-600 text-white text-sm py-2"
            >
              <FileDown className="w-4 h-4 mr-1" />
              Export to Excel
            </Button>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={handleCreateRequest}
        className="fixed bottom-20 right-4 w-16 h-16 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-50"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <RequestFormModal
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
      
      <MarkReceivedModal
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
  );
};

export default MobileRequestsPage;