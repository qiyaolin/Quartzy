import React, { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, FileText, User, DollarSign, Package, Eye, CheckCircle, Clock, ShoppingCart, RotateCcw, QrCode, Printer, X } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import BarcodeComponent from './BarcodeComponent.tsx';
import { useDevice } from '../hooks/useDevice.ts';

const RequestsTable = ({ requests, onApprove, onPlaceOrder, onMarkReceived, onReorder, onShowHistory, onViewDetails, onBatchAction, currentStatus }) => {
    const { user } = useContext(AuthContext);
    const device = useDevice();
    const [selectedRequests, setSelectedRequests] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(null);
    
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
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200 p-4 md:p-6 animate-slide-down">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
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
                        <div className="flex flex-wrap gap-2 md:space-x-3">
                            {/* Status-specific batch actions */}
                            {currentStatus === 'NEW' && user?.is_staff && (
                                <>
                                    <button 
                                        onClick={() => onBatchAction && onBatchAction('approve', Array.from(selectedRequests))}
                                        className="btn btn-success btn-sm hover:scale-105 transition-transform"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        <span className="hidden sm:inline">Approve </span>Selected
                                    </button>
                                    <button 
                                        onClick={() => onBatchAction && onBatchAction('reject', Array.from(selectedRequests))}
                                        className="btn btn-danger btn-sm hover:scale-105 transition-transform"
                                    >
                                        <span className="hidden sm:inline">Reject </span>Selected
                                    </button>
                                </>
                            )}
                            
                            {currentStatus === 'APPROVED' && (
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('batch_place_order', Array.from(selectedRequests))}
                                    className="btn btn-warning btn-sm hover:scale-105 transition-transform"
                                >
                                    <ShoppingCart className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Batch </span>Order
                                </button>
                            )}
                            
                            {currentStatus === 'ORDERED' && (
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('batch_mark_received', Array.from(selectedRequests))}
                                    className="btn btn-primary btn-sm hover:scale-105 transition-transform"
                                >
                                    <Package className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Batch </span>Received
                                </button>
                            )}
                            
                            {currentStatus === 'RECEIVED' && (
                                <button 
                                    onClick={() => onBatchAction && onBatchAction('batch_reorder', Array.from(selectedRequests))}
                                    className="btn btn-secondary btn-sm hover:scale-105 transition-transform"
                                >
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Batch </span>Reorder
                                </button>
                            )}
                            
                            <button 
                                onClick={() => onBatchAction && onBatchAction('export', Array.from(selectedRequests))}
                                className="btn btn-secondary btn-sm hover:scale-105 transition-transform"
                            >
                                Export<span className="hidden sm:inline"> Selected</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Mobile Cards or Desktop Table */}
            {device.isMobile ? (
                /* Mobile Card Layout */
                <div className="space-y-4 p-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <input 
                                        type="checkbox" 
                                        className="checkbox" 
                                        checked={selectedRequests.has(req.id)}
                                        onChange={(e) => handleSelectRequest(req.id, e.target.checked)}
                                    />
                                    <div className="flex-1">
                                        <div 
                                            className="font-medium text-gray-900 text-sm cursor-pointer"
                                            onClick={() => onViewDetails && onViewDetails(req)}
                                        >
                                            {req.item_name}
                                        </div>
                                        {req.catalog_number && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Cat: {req.catalog_number}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {getStatusBadge(req.status)}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                <div>
                                    <span className="text-gray-500">Vendor:</span>
                                    <div className="font-medium">{req.vendor?.name || 'N/A'}</div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Price:</span>
                                    <div className="font-mono font-bold text-lg">${req.unit_price}</div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Requested by:</span>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                            {req.requested_by?.username ? req.requested_by.username.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <span className="font-medium">{req.requested_by?.username || 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Barcode:</span>
                                    <div>
                                        {req.barcode ? (
                                            <div className="flex items-center space-x-2">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                                    {req.barcode}
                                                </code>
                                                <button
                                                    onClick={() => setShowBarcodeModal(req)}
                                                    className="p-1 hover:bg-primary-50 rounded transition-colors"
                                                    title="Print barcode label"
                                                >
                                                    <Printer className="w-3 h-3 text-gray-500 hover:text-primary-600" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">No barcode</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {req.notes && (
                                <div className="mb-4">
                                    <span className="text-gray-500 text-sm">Notes:</span>
                                    <div className="text-sm text-gray-700 mt-1">{req.notes}</div>
                                </div>
                            )}
                            
                            {/* Mobile Actions */}
                            <div className="flex items-center space-x-2 flex-wrap gap-2">
                                {user?.is_staff && req.status === 'NEW' && (
                                    <button 
                                        onClick={() => onApprove(req.id)} 
                                        className="btn btn-success text-xs"
                                    >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Approve
                                    </button>
                                )}
                                {req.status === 'APPROVED' && user?.is_staff && (
                                    <button 
                                        onClick={() => onPlaceOrder(req.id)} 
                                        className="btn btn-warning text-xs"
                                    >
                                        Place Order
                                    </button>
                                )}
                                {req.status === 'ORDERED' && (
                                    <button 
                                        onClick={() => onMarkReceived(req)} 
                                        className="btn btn-primary text-xs"
                                    >
                                        Mark Received
                                    </button>
                                )}
                                {req.status === 'RECEIVED' && (
                                    <button 
                                        onClick={() => onReorder(req.id)} 
                                        className="btn btn-secondary text-xs"
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Reorder
                                    </button>
                                )}
                                <button 
                                    onClick={() => onShowHistory(req.id)} 
                                    className="btn btn-gray text-xs"
                                >
                                    <History className="w-3 h-3 mr-1" />
                                    History
                                </button>
                                <button 
                                    onClick={() => onViewDetails && onViewDetails(req)} 
                                    className="btn btn-gray text-xs"
                                >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Desktop Table Layout */
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
                                <th className="table-header-cell">
                                    <div className="flex items-center space-x-2">
                                        <FileText className="w-4 h-4 text-gray-500" />
                                        <span>Item Details</span>
                                    </div>
                                </th>
                                <th className="table-header-cell">
                                    <div className="flex items-center space-x-2">
                                        <Package className="w-4 h-4 text-gray-500" />
                                        <span>Vendor</span>
                                    </div>
                                </th>
                                <th className="table-header-cell">
                                    <div className="flex items-center space-x-2">
                                        <DollarSign className="w-4 h-4 text-gray-500" />
                                        <span>Price</span>
                                    </div>
                                </th>
                                <th className="table-header-cell">
                                    <div className="flex items-center space-x-2">
                                        <User className="w-4 h-4 text-gray-500" />
                                        <span>Requested By</span>
                                    </div>
                                </th>
                                <th className="table-header-cell">
                                    <div className="flex items-center space-x-2">
                                        <Clock className="w-4 h-4 text-gray-500" />
                                        <span>Status</span>
                                    </div>
                                </th>
                                <th className="table-header-cell">
                                    <div className="flex items-center space-x-2">
                                        <QrCode className="w-4 h-4 text-gray-500" />
                                        <span>Barcode</span>
                                    </div>
                                </th>
                                <th className="table-header-cell">Actions</th>
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
                                        {req.barcode ? (
                                            <div className="flex items-center space-x-2">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                                    {req.barcode}
                                                </code>
                                                <button
                                                    onClick={() => setShowBarcodeModal(req)}
                                                    className="p-1 hover:bg-primary-50 rounded transition-colors"
                                                    title="Print barcode label"
                                                >
                                                    <Printer className="w-3 h-3 text-gray-500 hover:text-primary-600" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">No barcode</span>
                                        )}
                                    </td>
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
                                            {req.status === 'APPROVED' && user?.is_staff && (
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
            )}
            
            {/* Barcode Modal */}
            {showBarcodeModal && createPortal(
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex justify-center items-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-lg font-semibold">Barcode Label</h3>
                            <button
                                onClick={() => setShowBarcodeModal(null)}
                                className="p-2 hover:bg-gray-100 rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4">
                            <BarcodeComponent
                                barcodeData={showBarcodeModal.barcode}
                                itemName={showBarcodeModal.item_name}
                                onPrint={() => {
                                    console.log('Barcode printed for:', showBarcodeModal.barcode);
                                    setShowBarcodeModal(null);
                                }}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default RequestsTable;
