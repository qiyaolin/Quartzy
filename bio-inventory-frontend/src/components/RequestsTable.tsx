import React, { useContext } from 'react';
import { History } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

const RequestsTable = ({ requests, onApprove, onPlaceOrder, onMarkReceived, onReorder, onShowHistory }) => {
    const { user } = useContext(AuthContext);
    
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
            <table className="table">
                <thead className="table-header"><tr>
                    <th className="table-header-cell w-12"><input type="checkbox" className="checkbox" /></th>
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
                            <td className="table-cell"><input type="checkbox" className="checkbox" /></td>
                            <td className="table-cell">
                                <div>
                                    <div className="font-medium text-secondary-900">{req.item_name}</div>
                                    {req.notes && <p className="text-xs text-secondary-500 mt-1 line-clamp-2">{req.notes}</p>}
                                    {req.catalog_number && <p className="text-xs text-secondary-400 mt-1">Cat: {req.catalog_number}</p>}
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
