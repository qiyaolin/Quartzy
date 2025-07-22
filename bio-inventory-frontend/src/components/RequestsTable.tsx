import React, { useContext, useState } from 'react';
import { History } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

const RequestsTable = ({ requests, onApprove, onPlaceOrder, onMarkReceived, onReorder, onShowHistory, onViewDetails, onBatchAction }) => {
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
        <div className="overflow-x-auto">
            {selectedRequests.size > 0 && (
                <div className="bg-primary-50 border-b border-primary-200 p-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-700">
                        {selectedRequests.size} request(s) selected
                    </span>
                    <div className="flex space-x-2">
                        {user?.is_staff && (
                            <>
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('approve', Array.from(selectedRequests))}
                                    className="btn btn-success btn-sm"
                                >
                                    Approve Selected
                                </button>
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('reject', Array.from(selectedRequests))}
                                    className="btn btn-danger btn-sm"
                                >
                                    Reject Selected
                                </button>
                            </>
                        )}
                        <button 
                            onClick={() => onBatchAction && onBatchAction('export', Array.from(selectedRequests))}
                            className="btn btn-secondary btn-sm"
                        >
                            Export Selected
                        </button>
                    </div>
                </div>
            )}
            <table className="table">
                <thead className="table-header"><tr>
                    <th className="table-header-cell w-12">
                        <input 
                            type="checkbox" 
                            className="checkbox" 
                            checked={selectAll}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                    </th>
                    <th className="table-header-cell w-80">Item Details</th>
                    <th className="table-header-cell w-40">Vendor</th>
                    <th className="table-header-cell w-24">Price</th>
                    <th className="table-header-cell w-36">Requested By</th>
                    <th className="table-header-cell w-24">Status</th>
                    <th className="table-header-cell w-28">Actions</th>
                </tr></thead>
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
                                    className="cursor-pointer hover:bg-primary-50 p-2 rounded-lg transition-colors"
                                    onClick={() => onViewDetails && onViewDetails(req)}
                                >
                                    <div className="font-medium text-secondary-900 hover:text-primary-700">{req.item_name}</div>
                                    {req.notes && <p className="text-xs text-secondary-500 mt-1 line-clamp-2">{req.notes}</p>}
                                    {req.catalog_number && <p className="text-xs text-secondary-400 mt-1">Cat: {req.catalog_number}</p>}
                                    <p className="text-xs text-primary-600 mt-1 opacity-0 hover:opacity-100 transition-opacity">Click to view details →</p>
                                </div>
                            </td>
                            <td className="table-cell text-secondary-600">{req.vendor?.name || 'N/A'}</td>
                            <td className="table-cell">
                                <div className="font-mono font-medium text-secondary-900">${req.unit_price}</div>
                                {req.quantity > 1 && <div className="text-xs text-secondary-500">Qty: {req.quantity}</div>}
                            </td>
                            <td className="table-cell text-secondary-600">{req.requested_by?.username || 'N/A'}</td>
                            <td className="table-cell">{getStatusBadge(req.status)}</td>
                            <td className="table-cell">
                                <div className="flex items-center space-x-2">
                                    {user?.is_staff && req.status === 'NEW' && (
                                        <button onClick={() => onApprove(req.id)} className="btn btn-success px-3 py-1 text-xs">
                                            Approve
                                        </button>
                                    )}
                                    {req.status === 'APPROVED' && (
                                        <button onClick={() => onPlaceOrder(req.id)} className="btn btn-warning px-3 py-1 text-xs">
                                            Place Order
                                        </button>
                                    )}
                                    {req.status === 'ORDERED' && (
                                        <button onClick={() => onMarkReceived(req)} className="btn btn-primary px-3 py-1 text-xs">
                                            Mark Received
                                        </button>
                                    )}
                                    {req.status === 'RECEIVED' && (
                                        <button onClick={() => onReorder(req.id)} className="btn btn-secondary px-3 py-1 text-xs">
                                            Reorder
                                        </button>
                                    )}
                                    <button onClick={() => onShowHistory(req.id)} className="p-2 hover:bg-secondary-50 rounded-lg transition-colors group">
                                        <History className="w-4 h-4 text-secondary-400 group-hover:text-secondary-600" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RequestsTable;
