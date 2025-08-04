import React, { useState, useEffect, useCallback } from 'react';
import { useDevice } from '../hooks/useDevice';
import { useMobileErrorHandler, useMobileLoadingState } from '../hooks/useMobileErrorHandler';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { validateFilterOptions, safeApiCall, formatErrorMessage } from '../utils/dataValidation';
import MobileHeader from '../components/mobile/MobileHeader';
import MobileRequestCard from '../components/mobile/MobileRequestCard';
import { RequestsFAB } from '../components/mobile/MobileFloatingActionButton';
import { RequestsStatsCards } from '../components/mobile/MobileStatsCards';
import MobileFilterDrawer from '../components/mobile/MobileFilterDrawer';
import MobileMarkReceivedModal from '../modals/MobileMarkReceivedModal';

interface RequestItem {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  requested_by: string;
  request_date: string;
  status: string;
  vendor?: string;
  notes?: string;
  urgency?: string;
  received_by_name?: string;
  approved_by_name?: string;
}

interface MobileRequestsPageProps {
  onAddRequestClick: () => void;
  refreshKey: number;
  filters: any;
  onFilterChange: (key: string, value: any) => void;
  highlightRequestId?: string | null;
  onMenuToggle: () => void;
  token: string;
}

const MobileRequestsPage: React.FC<MobileRequestsPageProps> = ({
  onAddRequestClick,
  refreshKey,
  filters,
  onFilterChange,
  highlightRequestId,
  onMenuToggle,
  token
}) => {
  const device = useDevice();
  const errorHandler = useMobileErrorHandler({
    maxRetries: 3,
    onError: (error) => console.error('Mobile Requests Error:', error),
    onRetry: () => console.log('Retrying requests data fetch...')
  });
  const loadingState = useMobileLoadingState();
  
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isMarkReceivedModalOpen, setIsMarkReceivedModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [stats, setStats] = useState({
    newRequests: 0,
    approvedRequests: 0,
    totalRequests: 0
  });

  const [filterOptions, setFilterOptions] = useState({
    vendors: [],
    users: [],
    statuses: [
      { label: 'New', value: 'NEW' },
      { label: 'Approved', value: 'APPROVED' },
      { label: 'Rejected', value: 'REJECTED' },
      { label: 'Received', value: 'RECEIVED' }
    ]
  });

  const filterSections = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: filterOptions.statuses,
      value: filters.status
    },
    {
      key: 'requested_by',
      label: 'Requested By',
      type: 'multiselect' as const,
      options: validateFilterOptions(filterOptions.users),
      value: filters.requested_by
    },
    {
      key: 'vendor',
      label: 'Vendor',
      type: 'multiselect' as const,
      options: validateFilterOptions(filterOptions.vendors),
      value: filters.vendor
    }
  ];

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    
    loadingState.setLoading('requests', true);
    errorHandler.clearError();
    
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.requested_by?.length) {
        filters.requested_by.forEach((user: string) => params.append('requested_by', user));
      }
      if (filters.vendor?.length) {
        filters.vendor.forEach((vendor: string) => params.append('vendor', vendor));
      }

      const result = await safeApiCall<RequestItem[]>(
        buildApiUrl(`${API_ENDPOINTS.REQUESTS}?${params.toString()}`),
        { headers: { 'Authorization': `Token ${token}` } }
      );
      
      if (result.success && result.data) {
        const data = result.data;
        setRequests(data);
        
        // Calculate stats
        const newRequests = data.filter((req: RequestItem) => req.status === 'NEW').length;
        const approvedRequests = data.filter((req: RequestItem) => req.status === 'APPROVED').length;
        const totalRequests = data.length;
        
        setStats({
          newRequests,
          approvedRequests,
          totalRequests
        });
      } else {
        errorHandler.handleError(result.error || 'Failed to fetch requests data', 'FETCH_REQUESTS');
      }
    } catch (error) {
      errorHandler.handleError(error, 'FETCH_REQUESTS_EXCEPTION');
    } finally {
      loadingState.setLoading('requests', false);
    }
  }, [token, filters, loadingState, errorHandler]);

  useEffect(() => {
    fetchRequests();
  }, [refreshKey, filters, token, fetchRequests]);

  // Fetch filter options with enhanced error handling
  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!token) return;
      
      loadingState.setLoading('filterOptions', true);
      
      try {
        const headers = { 'Authorization': `Token ${token}` };
        
        // Use safe API calls
        const [vendorsResult, usersResult] = await Promise.all([
          safeApiCall(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
          safeApiCall(buildApiUrl(API_ENDPOINTS.USERS), { headers })
        ]);
        
        // Validate and standardize data
        const vendors = vendorsResult.success ? validateFilterOptions(vendorsResult.data || []) : [];
        const users = usersResult.success ? validateFilterOptions(usersResult.data || []) : [];
        
        setFilterOptions(prev => ({
          ...prev,
          vendors,
          users
        }));
        
        // Log any failed API calls
        if (!vendorsResult.success) console.warn('Failed to fetch vendors:', vendorsResult.error);
        if (!usersResult.success) console.warn('Failed to fetch users:', usersResult.error);
        
      } catch (error) {
        console.error('Failed to fetch filter options:', formatErrorMessage(error));
        errorHandler.handleError(error, 'FETCH_FILTER_OPTIONS');
      } finally {
        loadingState.setLoading('filterOptions', false);
      }
    };
    
    fetchFilterOptions();
  }, [token, loadingState, errorHandler]);

  const handleFilterChange = (key: string, value: any) => {
    onFilterChange(key, value);
  };

  const handleClearFilters = () => {
    onFilterChange('search', '');
    onFilterChange('status', 'NEW');
    onFilterChange('requested_by', []);
    onFilterChange('vendor', []);
  };

  const handleNewRequestsClick = () => {
    onFilterChange('status', 'NEW');
  };

  const handleApprovedClick = () => {
    onFilterChange('status', 'APPROVED');
  };

  const handleApproveRequest = (request: RequestItem) => {
    // TODO: Implement request approval logic
    console.log('Approving request:', request.id);
  };

  const handleRejectRequest = (request: RequestItem) => {
    // TODO: Implement request rejection logic
    console.log('Rejecting request:', request.id);
  };

  const handleMarkReceived = (request: RequestItem) => {
    setSelectedRequest(request);
    setIsMarkReceivedModalOpen(true);
  };

  const handleSaveReceived = async (id: number, data: any) => {
    try {
      console.log('Sending mark_received request:', { id, data });
      const response = await fetch(buildApiUrl(`/api/requests/${id}/mark_received/`), {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      console.log('Mark received response status:', response.status);
      const responseText = await response.text();
      console.log('Mark received response:', responseText);
      
      if (!response.ok) {
        throw new Error(`Failed to mark as received: ${responseText}`);
      }
      
      fetchRequests(); // Refresh list on success
      // Don't close modal immediately - let the modal handle the success state
    } catch (error) {
      console.error('Mark received error:', error);
      errorHandler.handleError(error, 'MARK_RECEIVED');
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleReopenRequest = (request: RequestItem) => {
    // TODO: Implement reopen request logic
    console.log('Reopening request:', request.id);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onFilterChange('search', value);
  };

  if (!device.isMobile) {
    return null; // This component is only for mobile
  }

  // Show error state if there's an error
  if (errorHandler.hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Requests</h2>
          <p className="text-gray-600 mb-6 text-sm">{errorHandler.error}</p>
          <div className="space-y-3">
            {errorHandler.canRetry && (
              <button
                onClick={() => {
                  errorHandler.retry();
                  fetchRequests();
                }}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors touch-manipulation text-sm min-h-[44px]"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors touch-manipulation text-sm min-h-[44px]"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Requests"
        showSearch={true}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        showFilter={true}
        onFilterClick={() => setIsFilterDrawerOpen(true)}
        showMenuToggle={true}
        onMenuToggle={onMenuToggle}
        notificationCount={stats.newRequests}
      />

      {/* Stats Cards */}
      <RequestsStatsCards
        newRequests={stats.newRequests}
        approvedRequests={stats.approvedRequests}
        totalRequests={stats.totalRequests}
        onNewRequestsClick={handleNewRequestsClick}
        onApprovedClick={handleApprovedClick}
      />

      {/* Requests List */}
      <div className="px-4 pb-4">
        {loadingState.isLoading('requests') ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-40 animate-pulse"></div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No requests found</div>
            <p className="text-gray-500 text-sm">Tap the button below to create a new request</p>
          </div>
        ) : (
          <div className="space-y-0">
            {requests.map((request) => (
              <div
                key={request.id}
                className={`transition-all duration-300 ${
                  highlightRequestId === request.id.toString() ? 'ring-2 ring-primary-500 ring-opacity-50' : ''
                }`}
              >
                <MobileRequestCard
                  request={request}
                  onClick={() => {/* Handle request details */}}
                  onApprove={handleApproveRequest}
                  onReject={handleRejectRequest}
                  onMarkReceived={handleMarkReceived}
                  onReopen={handleReopenRequest}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <RequestsFAB onAddRequest={onAddRequestClick} />

      {/* Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Filter Requests"
        filters={filterSections}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearFilters}
      />

      {/* Mark Received Modal */}
      <MobileMarkReceivedModal
        isOpen={isMarkReceivedModalOpen}
        onClose={() => setIsMarkReceivedModalOpen(false)}
        onSave={handleSaveReceived}
        token={token}
        request={selectedRequest}
      />
    </div>
  );
};

export default MobileRequestsPage;