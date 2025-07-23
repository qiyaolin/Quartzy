import React, { useContext, useState } from 'react';
import { History, FileText, User, DollarSign, Package, Eye, CheckCircle, Clock, ShoppingCart, RotateCcw } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

const RequestsTable = ({ requests, onApprove, onPlaceOrder, onMarkReceived, onReorder, onShowHistory, onViewDetails, onBatchAction, currentStatus }) => {
    const { user } = useContext(AuthContext);
    const [selectedRequests, setSelectedRequests] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    
    const handleSelectAll = (checked) => {
        setSelectAll(checked);
        if (checked) {
            const allRequestIds = new Set(requests.map(req => req.id));
            setSelectedRequests(allRequestIds);
        } else {
            setSelectedRequests(new Set());
        }
    };
    
    const handleSelectRequest = (requestId, checked) => {
        const newSelected = new Set(selectedRequests);
        if (checked) {
            newSelected.add(requestId);
        } else {
            newSelected.delete(requestId);
        }
        setSelectedRequests(newSelected);
        setSelectAll(newSelected.size === requests.length);
    };
    
    const getStatusBadge = (status) => {
        const statusConfig = {
            'NEW': { class: 'badge-warning', label: 'New' },
            'APPROVED': { class: 'badge-success', label: 'Approved' },
            'ORDERED': { class: 'badge-primary', label: 'Ordered' },
            'RECEIVED': { class: 'badge-secondary', label: 'Received' }
        };
        const config = statusConfig[status] || { class: 'badge-secondary', label: status };
        return <span className={`badge ${config.class}`}>{config.label}</span>;
    };
    
    
    return (
        <div className="card overflow-hidden">
            {/* Enhanced Selection Bar */}
            {selectedRequests.size > 0 && (
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200 p-6 animate-slide-down">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-primary-500 rounded-2xl">
                                <span className="text-white font-bold text-sm">{selectedRequests.size}</span>
                            </div>
                            <div>
                                <span className="text-lg font-semibold text-primary-900">
                                    {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''} selected
                                </span>
                                <p className="text-sm text-primary-700">Choose an action to apply to selected requests</p>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            {/* Status-specific batch actions */}
                            {currentStatus === 'NEW' && user?.is_staff && (
                                <>
                                    <button 
                                        onClick={() => onBatchAction && onBatchAction('approve', Array.from(selectedRequests))}
                                        className="btn btn-success btn-sm hover:scale-105 transition-transform"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Approve Selected
                                    </button>
                                    <button 
                                        onClick={() => onBatchAction && onBatchAction('reject', Array.from(selectedRequests))}
                                        className="btn btn-danger btn-sm hover:scale-105 transition-transform"
                                    >
                                        Reject Selected
                                    </button>
                                </>
                            )}
                            
                            {currentStatus === 'APPROVED' && (
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('batch_place_order', Array.from(selectedRequests))}
                                    className="btn btn-warning btn-sm hover:scale-105 transition-transform"
                                >
                                    <ShoppingCart className="w-4 h-4 mr-1" />
                                    Batch Place Order
                                </button>
                            )}
                            
                            {currentStatus === 'ORDERED' && (
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('batch_mark_received', Array.from(selectedRequests))}
                                    className="btn btn-primary btn-sm hover:scale-105 transition-transform"
                                >
                                    <Package className="w-4 h-4 mr-1" />
                                    Batch Mark Received
                                </button>
                            )}
                            
                            {currentStatus === 'RECEIVED' && (
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('batch_reorder', Array.from(selectedRequests))}
                                    className="btn btn-secondary btn-sm hover:scale-105 transition-transform"
                                >
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    Batch Reorder
                                </button>
                            )}
                            
                            <button 
                                onClick={() => onBatchAction && onBatchAction('export', Array.from(selectedRequests))}
                                className="btn btn-secondary btn-sm hover:scale-105 transition-transform"
                            >
                                Export Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced Table */}
            <div className="overflow-x-auto">
                <table className="table">
                    <thead className="table-header">
                        <tr>
                            <th className="table-header-cell w-12">
                                <input 
                                    type="checkbox" 
                                    className="checkbox" 
                                    checked={selectAll}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="table-header-cell w-80">
                                <div className="flex items-center space-x-2">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    <span>Item Details</span>
                                </div>
                            </th>
                            <th className="table-header-cell w-40">
                                <div className="flex items-center space-x-2">
                                    <Package className="w-4 h-4 text-gray-500" />
                                    <span>Vendor</span>
                                </div>
                            </th>
                            <th className="table-header-cell w-24">
                                <div className="flex items-center space-x-2">
                                    <DollarSign className="w-4 h-4 text-gray-500" />
                                    <span>Price</span>
                                </div>
                            </th>
                            <th className="table-header-cell w-36">
                                <div className="flex items-center space-x-2">
                                    <User className="w-4 h-4 text-gray-500" />
                                    <span>Requested By</span>
                                </div>
                            </th>
                            <th className="table-header-cell w-24">
                                <div className="flex items-center space-x-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span>Status</span>
                                </div>
                            </th>
                            <th className="table-header-cell w-28">Actions</th>
                        </tr>
                    </thead>
                <tbody className="table-body">
                    {requests.map(req => (
                        <tr key={req.id} className="table-row">
                            <td className="table-cell">
                                <input 
                                    type="checkbox" 
                                    className="checkbox" 
                                    checked={selectedRequests.has(req.id)}
                                    onChange={(e) => handleSelectRequest(req.id, e.target.checked)}
                                />
                            </td>
                            <td className="table-cell">
                                <div 
                                    className="cursor-pointer hover:bg-primary-50 py-1 px-2 rounded transition-colors group"
                                    onClick={() => onViewDetails && onViewDetails(req)}
                                >
                                    <div className="font-medium text-gray-900 group-hover:text-primary-700 text-sm">
                                        {req.item_name}
                                    </div>
                                    {req.catalog_number && (
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            Cat: {req.catalog_number}
                                        </div>
                                    )}
                                    {req.notes && (
                                        <div className="text-xs text-gray-400 mt-0.5 truncate" title={req.notes}>
                                            {req.notes.length > 40 ? req.notes.substring(0, 40) + '...' : req.notes}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="table-cell">
                                <div className="text-sm text-gray-700 font-medium">{req.vendor?.name || 'N/A'}</div>
                            </td>
                            <td className="table-cell">
                                <div className="font-mono font-bold text-gray-900 text-lg">${req.unit_price}</div>
                                {req.quantity > 1 && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        Qty: <span className="font-medium">{req.quantity}</span>
                                    </div>
                                )}
                            </td>
                            <td className="table-cell">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                        {req.requested_by?.username ? req.requested_by.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{req.requested_by?.username || 'N/A'}</span>
                                </div>
                            </td>
                            <td className="table-cell">{getStatusBadge(req.status)}</td>
                            <td className="table-cell">
                                <div className="flex items-center space-x-1">
                                    {user?.is_staff && req.status === 'NEW' && (
                                        <button 
                                            onClick={() => onApprove(req.id)} 
                                            className="btn btn-success px-3 py-1.5 text-xs hover:scale-105 transition-transform"
                                        >
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Approve
                                        </button>
                                    )}
                                    {req.status === 'APPROVED' && (
                                        <button 
                                            onClick={() => onPlaceOrder(req.id)} 
                                            className="btn btn-warning px-3 py-1.5 text-xs hover:scale-105 transition-transform"
                                        >
                                            Place Order
                                        </button>
                                    )}
                                    {req.status === 'ORDERED' && (
                                        <button 
                                            onClick={() => onMarkReceived(req)} 
                                            className="btn btn-primary px-3 py-1.5 text-xs hover:scale-105 transition-transform"
                                        >
                                            Mark Received
                                        </button>
                                    )}
                                    {req.status === 'RECEIVED' && (
                                        <button 
                                            onClick={() => onReorder(req.id)} 
                                            className="btn btn-secondary px-3 py-1.5 text-xs hover:scale-105 transition-transform"
                                        >
                                            Reorder
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => onShowHistory(req.id)} 
                                        className="p-2.5 hover:bg-info-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                        title="View history"
                                    >
                                        <History className="w-4 h-4 text-gray-400 group-hover:text-info-600 transition-colors" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RequestsTable;
