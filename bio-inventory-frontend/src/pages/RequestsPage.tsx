import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import RequestsTable from '../components/RequestsTable.tsx';
import MarkReceivedModal from '../modals/MarkReceivedModal.tsx';
import RequestHistoryModal from '../modals/RequestHistoryModal.tsx';
import RequestDetailModal from '../modals/RequestDetailModal.tsx';
import FundSelectionModal from '../modals/FundSelectionModal.tsx';

const RequestsPage = ({ onAddRequestClick, refreshKey, filters, onFilterChange }) => {
    const { token } = useContext(AuthContext);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFundSelectionModalOpen, setIsFundSelectionModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
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
            const response = await fetch(`http://127.0.0.1:8000/api/requests/?${params.toString()}`, { headers: { 'Authorization': `Token ${token}` } });
            if (!response.ok) throw new Error(`Authentication failed.`);
            const data = await response.json();
            setRequests(data);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [token, filters]);

    useEffect(() => {
        if (token) { fetchRequests(); }
    }, [token, refreshKey, fetchRequests]);

    const handleAction = async (url, options = {}) => {
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }, ...options });
            if (!response.ok) throw new Error('Action failed.');
            fetchRequests(); // Refresh list on success
        } catch (e) { alert(e.message); }
    };

    const handleApprove = (id) => handleAction(`http://127.0.0.1:8000/api/requests/${id}/approve/`);
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
            const response = await fetch(`http://127.0.0.1:8000/api/requests/${id}/place_order/`, {
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
            alert(e.message);
        }
    };
    const handleReorder = (id) => handleAction(`http://127.0.0.1:8000/api/requests/${id}/reorder/`);
    const handleMarkReceived = (req) => { setSelectedRequest(req); setIsReceivedModalOpen(true); };
    const handleSaveReceived = async (id, data) => {
        await handleAction(`http://127.0.0.1:8000/api/requests/${id}/mark_received/`, { body: JSON.stringify(data) });
        setIsReceivedModalOpen(false);
    };
    const handleShowHistory = async (id) => {
        const response = await fetch(`http://127.0.0.1:8000/api/requests/${id}/history/`, { headers: { 'Authorization': `Token ${token}` } });
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
                // Filter selected requests and export
                const selectedRequests = requests.filter(req => selectedIds.includes(req.id));
                const exportData = {
                    exportDate: new Date().toISOString(),
                    requests: selectedRequests,
                    totalRequests: selectedRequests.length
                };
                
                const dataStr = JSON.stringify(exportData, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const exportFileDefaultName = `requests-export-${new Date().toISOString().split('T')[0]}.json`;
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
                break;
                
            case 'approve':
                if (window.confirm(`Are you sure you want to approve ${selectedIds.length} request(s)?`)) {
                    try {
                        const response = await fetch('http://127.0.0.1:8000/api/requests/batch_approve/', {
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
                        alert('Failed to approve requests');
                    }
                }
                break;
                
            case 'reject':
                if (window.confirm(`Are you sure you want to reject ${selectedIds.length} request(s)?`)) {
                    try {
                        const response = await fetch('http://127.0.0.1:8000/api/requests/batch_reject/', {
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
                        alert('Failed to reject requests');
                    }
                }
                break;
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
        </>
    );
};

export default RequestsPage;
