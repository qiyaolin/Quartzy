import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import RequestsTable from '../components/RequestsTable.tsx';
import MarkReceivedModal from '../modals/MarkReceivedModal.tsx';
import RequestHistoryModal from '../modals/RequestHistoryModal.tsx';
import RequestDetailModal from '../modals/RequestDetailModal.tsx';
import FundSelectionModal from '../modals/FundSelectionModal.tsx';
import BatchReceivedModal from '../modals/BatchReceivedModal.tsx';
import BatchFundSelectionModal from '../modals/BatchFundSelectionModal.tsx';
import { exportToExcel } from '../utils/excelExport.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const RequestsPage = ({ onAddRequestClick, refreshKey, filters, onFilterChange, highlightRequestId }) => {
    const { token } = useContext(AuthContext);
    const notification = useNotification();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFundSelectionModalOpen, setIsFundSelectionModalOpen] = useState(false);
    const [isBatchReceivedModalOpen, setIsBatchReceivedModalOpen] = useState(false);
    const [isBatchFundSelectionModalOpen, setIsBatchFundSelectionModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedRequests, setSelectedRequests] = useState([]);
    const [historyData, setHistoryData] = useState([]);

    const fetchRequests = useCallback(async () => {
        setLoading(true); setError(null);
        const params = new URLSearchParams();
        // Remove status from params to fetch all requests for accurate badge counts
        if (filters.search) params.append('search', filters.search);
        Object.keys(filters).forEach(key => {
            if (!['search', 'status'].includes(key) && filters[key].length > 0) {
                filters[key].forEach(value => params.append(key, value));
            }
        });
        try {
            const response = await fetch(`${buildApiUrl(API_ENDPOINTS.REQUESTS)}?${params.toString()}`, { headers: { 'Authorization': `Token ${token}` } });
            if (!response.ok) throw new Error(`Authentication failed.`);
            const data = await response.json();
            setRequests(data);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [token, filters]);

    useEffect(() => {
        if (token) { fetchRequests(); }
    }, [token, refreshKey, fetchRequests]);

    // Auto-open detail modal when highlightRequestId is provided (from email links)
    useEffect(() => {
        if (highlightRequestId && requests.length > 0) {
            const requestToHighlight = requests.find(req => req.id.toString() === highlightRequestId);
            if (requestToHighlight) {
                handleViewDetails(requestToHighlight);
            }
        }
    }, [highlightRequestId, requests]);

    const handleAction = async (url, options = {}) => {
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }, ...options });
            if (!response.ok) throw new Error('Action failed.');
            fetchRequests(); // Refresh list on success
        } catch (e) { notification.error(e.message); }
    };

    const handleApprove = (id) => handleAction(buildApiUrl(`/api/requests/${id}/approve/`));
    const handlePlaceOrder = (id) => {
        // Find the request and open fund selection modal
        const request = requests.find(req => req.id === id);
        if (request) {
            setSelectedRequest(request);
            setIsFundSelectionModalOpen(true);
        }
    };
    const handlePlaceOrderWithFund = async (id, fundId) => {
        try {
            const response = await fetch(buildApiUrl(`/api/requests/${id}/place_order/`), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fund_id: fundId })
            });
            if (!response.ok) throw new Error('Failed to place order.');
            fetchRequests(); // Refresh list on success
        } catch (e) {
            notification.error(e.message);
        }
    };
    const handleReorder = (id) => handleAction(buildApiUrl(`/api/requests/${id}/reorder/`));
    const handleMarkReceived = (req) => { setSelectedRequest(req); setIsReceivedModalOpen(true); };
    const handleSaveReceived = async (id, data) => {
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
            notification.error(error.message);
            throw error; // Re-throw so modal can handle it
        }
    };
    const handleShowHistory = async (id) => {
        const response = await fetch(buildApiUrl(`/api/requests/${id}/history/`), { headers: { 'Authorization': `Token ${token}` } });
        const data = await response.json();
        setHistoryData(data);
        setIsHistoryModalOpen(true);
    };
    
    const handleViewDetails = (request) => {
        setSelectedRequest(request);
        setIsDetailModalOpen(true);
    };

    const handleDetailSave = () => {
        fetchRequests(); // Refresh the data
        setIsDetailModalOpen(false);
    };

    const handleBatchAction = async (action, selectedIds) => {
        if (selectedIds.length === 0) return;
        
        switch (action) {
            case 'export':
                // Filter selected requests and export to Excel
                const selectedRequestsData = requests.filter(req => selectedIds.includes(req.id));
                
                // Prepare formatted data for Excel
                const formattedRequests = selectedRequestsData.map(req => ({
                    'Request ID': req.id,
                    'Product Name': req.product_name,
                    'Specifications': req.specifications,
                    'Quantity': req.quantity,
                    'Unit Price': req.unit_price ? `$${req.unit_price}` : '',
                    'Total Price': req.total_price ? `$${req.total_price}` : '',
                    'Status': req.status === 'pending' ? 'Pending' : 
                             req.status === 'approved' ? 'Approved' : 
                             req.status === 'ordered' ? 'Ordered' : 
                             req.status === 'received' ? 'Received' : 
                             req.status === 'rejected' ? 'Rejected' : req.status,
                    'Requester': req.requester_name,
                    'Department': req.department,
                    'Laboratory': req.lab,
                    'Vendor': req.vendor,
                    'Product Link': req.product_link,
                    'Urgency': req.urgency === 'high' ? 'High' : 
                              req.urgency === 'medium' ? 'Medium' : 
                              req.urgency === 'low' ? 'Low' : req.urgency,
                    'Request Date': req.requested_date ? new Date(req.requested_date).toLocaleDateString('en-US') : '',
                    'Expected Delivery': req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString('en-US') : '',
                    'Notes': req.notes || ''
                }));
                
                const summary = {
                    'Export Time': new Date().toLocaleString('en-US'),
                    'Export Count': selectedRequestsData.length,
                    'Pending': selectedRequestsData.filter(r => r.status === 'pending').length,
                    'Approved': selectedRequestsData.filter(r => r.status === 'approved').length,
                    'Ordered': selectedRequestsData.filter(r => r.status === 'ordered').length,
                    'Received': selectedRequestsData.filter(r => r.status === 'received').length,
                    'Rejected': selectedRequestsData.filter(r => r.status === 'rejected').length,
                    'Total Value': `$${selectedRequestsData.reduce((sum, req) => sum + (parseFloat(req.total_price) || 0), 0).toFixed(2)}`
                };
                
                exportToExcel({
                    fileName: 'requests-export',
                    sheetName: 'Purchase Requests',
                    title: 'Laboratory Purchase Requests Export Report',
                    data: formattedRequests,
                    summary: summary
                });
                break;
                
            case 'approve':
                if (window.confirm(`Are you sure you want to approve ${selectedIds.length} request(s)?`)) {
                    try {
                        const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS_BATCH_APPROVE), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Token ${token}`
                            },
                            body: JSON.stringify({ request_ids: selectedIds })
                        });
                        if (response.ok) {
                            fetchRequests(); // Refresh data
                        }
                    } catch (error) {
                        notification.error('Failed to approve requests');
                    }
                }
                break;
                
            case 'reject':
                if (window.confirm(`Are you sure you want to reject ${selectedIds.length} request(s)?`)) {
                    try {
                        const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS_BATCH_REJECT), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Token ${token}`
                            },
                            body: JSON.stringify({ request_ids: selectedIds })
                        });
                        if (response.ok) {
                            fetchRequests(); // Refresh data
                        }
                    } catch (error) {
                        notification.error('Failed to reject requests');
                    }
                }
                break;
                
            case 'batch_place_order':
                const selectedRequestsForOrder = requests.filter(req => selectedIds.includes(req.id));
                setSelectedRequests(selectedRequestsForOrder);
                setIsBatchFundSelectionModalOpen(true);
                break;
                
            case 'batch_mark_received':
                const selectedRequestsForReceived = requests.filter(req => selectedIds.includes(req.id));
                setSelectedRequests(selectedRequestsForReceived);
                setIsBatchReceivedModalOpen(true);
                break;
                
            case 'batch_reorder':
                if (window.confirm(`Are you sure you want to reorder ${selectedIds.length} request(s)?`)) {
                    try {
                        const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS_BATCH_REORDER), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Token ${token}`
                            },
                            body: JSON.stringify({ request_ids: selectedIds })
                        });
                        if (response.ok) {
                            const result = await response.json();
                            notification.success(`Successfully created ${result.created_count} new requests`);
                            fetchRequests(); // Refresh data
                        }
                    } catch (error) {
                        notification.error('Failed to reorder requests');
                    }
                }
                break;
        }
    };

    // Batch operation handlers
    const handleBatchPlaceOrder = async (selectedRequestsData, fundId) => {
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS_BATCH_PLACE_ORDER), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({ 
                    request_ids: selectedRequestsData.map(req => req.id),
                    fund_id: fundId 
                })
            });
            if (response.ok) {
                const result = await response.json();
                notification.success(`Successfully placed orders for ${result.updated_count} requests`);
                fetchRequests(); // Refresh data
            } else {
                const error = await response.json();
                notification.error(`Failed to place orders: ${error.error}`);
            }
        } catch (error) {
            notification.error('Failed to place orders');
        }
    };

    const handleBatchMarkReceived = async (selectedRequestsData, data) => {
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS_BATCH_MARK_RECEIVED), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({ 
                    request_ids: selectedRequestsData.map(req => req.id),
                    location_id: data.location_id
                })
            });
            if (response.ok) {
                const result = await response.json();
                notification.success(`Successfully marked ${result.updated_count} requests as received`);
                fetchRequests(); // Refresh data
            } else {
                const error = await response.json();
                notification.error(`Failed to mark as received: ${error.error}`);
            }
        } catch (error) {
            notification.error('Failed to mark as received');
        }
    };

    const statusTabs = [ { key: 'NEW', label: 'New' }, { key: 'APPROVED', label: 'Approved' }, { key: 'ORDERED', label: 'Ordered' }, { key: 'RECEIVED', label: 'Received' } ];

    return (
        <>
            <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Requests</h1>
                        <p className="text-secondary-600">Track and manage purchase requests</p>
                    </div>
                </div>
                
                <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden shadow-soft mb-6">
                    <nav className="flex border-b border-secondary-200 bg-secondary-50/30">
                        {statusTabs.map(tab => {
                            const count = requests.filter(r => r.status === tab.key).length;
                            return (
                                <button 
                                    key={tab.key} 
                                    onClick={() => onFilterChange('status', tab.key)} 
                                    className={`flex items-center px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${filters.status === tab.key ? 'border-primary-500 text-primary-700 bg-white' : 'border-transparent text-secondary-600 hover:text-secondary-900 hover:bg-white/50'}`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${filters.status === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-600'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
                
                <div className="card overflow-hidden">
                    {loading && (
                        <div className="flex justify-center items-center h-64">
                            <div className="text-center">
                                <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                                <p className="text-secondary-600">Loading Requests...</p>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="flex flex-col justify-center items-center h-64 text-danger-600 bg-danger-50 p-6 rounded-lg m-6">
                            <AlertTriangle className="w-12 h-12 mb-4 text-danger-500" />
                            <h3 className="text-lg font-semibold text-danger-800">Failed to load data</h3>
                            <p className="text-sm text-danger-600 mt-2">{error}</p>
                        </div>
                    )}
                    {!loading && !error && (
                        <RequestsTable 
                            requests={requests.filter(r => r.status === filters.status)} 
                            onApprove={handleApprove} 
                            onPlaceOrder={handlePlaceOrder} 
                            onMarkReceived={handleMarkReceived} 
                            onReorder={handleReorder} 
                            onShowHistory={handleShowHistory} 
                            onViewDetails={handleViewDetails}
                            onBatchAction={handleBatchAction}
                            currentStatus={filters.status}
                        />
                    )}
                </div>
            </main>
            <MarkReceivedModal isOpen={isReceivedModalOpen} onClose={() => setIsReceivedModalOpen(false)} onSave={handleSaveReceived} token={token} request={selectedRequest} />
            <RequestHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={historyData} />
            <RequestDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} onSave={handleDetailSave} token={token} request={selectedRequest} />
            <FundSelectionModal 
                isOpen={isFundSelectionModalOpen} 
                onClose={() => setIsFundSelectionModalOpen(false)} 
                onPlaceOrder={handlePlaceOrderWithFund} 
                token={token} 
                request={selectedRequest} 
            />
            <BatchReceivedModal 
                isOpen={isBatchReceivedModalOpen} 
                onClose={() => setIsBatchReceivedModalOpen(false)} 
                onSave={handleBatchMarkReceived} 
                token={token} 
                selectedRequests={selectedRequests} 
            />
            <BatchFundSelectionModal 
                isOpen={isBatchFundSelectionModalOpen} 
                onClose={() => setIsBatchFundSelectionModalOpen(false)} 
                onPlaceOrder={handleBatchPlaceOrder} 
                token={token} 
                selectedRequests={selectedRequests} 
            />
        </>
    );
};

export default RequestsPage;
