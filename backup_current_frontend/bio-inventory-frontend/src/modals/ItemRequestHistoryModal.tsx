import React, { useState, useEffect } from 'react';
import { X, Clock, User, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const ItemRequestHistoryModal = ({ isOpen, onClose, itemName, token }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && itemName) {
            fetchRequestHistory();
        }
    }, [isOpen, itemName]);

    const fetchRequestHistory = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${buildApiUrl(API_ENDPOINTS.REQUESTS)}?search=${encodeURIComponent(itemName)}`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch request history');
            }
            
            const data = await response.json();
            setRequests(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'NEW': { class: 'badge-warning', label: 'New', icon: Clock },
            'APPROVED': { class: 'badge-success', label: 'Approved', icon: CheckCircle },
            'ORDERED': { class: 'badge-primary', label: 'Ordered', icon: Package },
            'RECEIVED': { class: 'badge-secondary', label: 'Received', icon: CheckCircle }
        };
        const config = statusConfig[status] || { class: 'badge-secondary', label: status, icon: AlertTriangle };
        const IconComponent = config.icon;
        
        return (
            <span className={`badge ${config.class} flex items-center`}>
                <IconComponent className="w-3 h-3 mr-1" />
                {config.label}
            </span>
        );
    };

    const getUrgencyColor = (urgency) => {
        const colors = {
            'LOW': 'text-secondary-600',
            'NORMAL': 'text-primary-600',
            'HIGH': 'text-warning-600',
            'URGENT': 'text-danger-600'
        };
        return colors[urgency] || 'text-secondary-600';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-secondary-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary-900">Request History</h2>
                        <p className="text-secondary-600 mt-1">All requests related to this item</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                    >
                        <X className="w-6 h-6 text-secondary-600" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {loading && (
                        <div className="flex justify-center items-center h-32">
                            <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                            <p className="text-secondary-600">Loading request history...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col justify-center items-center h-32 text-danger-600 bg-danger-50 p-6 rounded-lg">
                            <AlertTriangle className="w-12 h-12 mb-4 text-danger-500" />
                            <h3 className="text-lg font-semibold text-danger-800">Failed to load request history</h3>
                            <p className="text-sm text-danger-600 mt-2">{error}</p>
                        </div>
                    )}

                    {!loading && !error && requests.length === 0 && (
                        <div className="flex flex-col justify-center items-center h-32 text-secondary-500">
                            <Package className="w-12 h-12 mb-4 text-secondary-400" />
                            <h3 className="text-lg font-medium text-secondary-600">No Request History</h3>
                            <p className="text-sm text-secondary-500 mt-2">This item has not been requested yet.</p>
                        </div>
                    )}

                    {!loading && !error && requests.length > 0 && (
                        <div className="space-y-4">
                            {requests.map((request, index) => (
                                <div key={request.id} className="bg-white border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-start space-x-4">
                                            <div className="flex-shrink-0">
                                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                    <span className="text-primary-600 font-medium text-sm">
                                                        {index + 1}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium text-secondary-900 text-lg">
                                                    {request.item_name}
                                                </h4>
                                                <div className="flex items-center space-x-4 mt-2">
                                                    <div className="flex items-center text-sm text-secondary-600">
                                                        <User className="w-4 h-4 mr-1" />
                                                        {request.requested_by?.username || 'Unknown'}
                                                    </div>
                                                    <div className="flex items-center text-sm text-secondary-600">
                                                        <Clock className="w-4 h-4 mr-1" />
                                                        {new Date(request.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-sm font-medium ${getUrgencyColor(request.urgency)}`}>
                                                {request.urgency}
                                            </span>
                                            {getStatusBadge(request.status)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                        <div>
                                            <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Vendor</p>
                                            <p className="text-sm text-secondary-900">{request.vendor?.name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Quantity</p>
                                            <p className="text-sm text-secondary-900">{request.quantity}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Unit Price</p>
                                            <p className="text-sm font-mono text-secondary-900">${request.unit_price}</p>
                                        </div>
                                    </div>

                                    {request.catalog_number && (
                                        <div className="mb-3">
                                            <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Catalog Number</p>
                                            <p className="text-sm text-secondary-900">{request.catalog_number}</p>
                                        </div>
                                    )}

                                    {(request.notes || request.justification) && (
                                        <div className="space-y-2">
                                            {request.notes && (
                                                <div>
                                                    <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Notes</p>
                                                    <p className="text-sm text-secondary-700 bg-secondary-50 p-2 rounded">
                                                        {request.notes}
                                                    </p>
                                                </div>
                                            )}
                                            {request.justification && (
                                                <div>
                                                    <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Justification</p>
                                                    <p className="text-sm text-secondary-700 bg-secondary-50 p-2 rounded">
                                                        {request.justification}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-secondary-100">
                                        <div className="flex items-center text-sm text-secondary-500">
                                            <Clock className="w-4 h-4 mr-1" />
                                            Created: {new Date(request.created_at).toLocaleString()}
                                        </div>
                                        <div className="text-lg font-bold text-primary-700">
                                            Total: ${(request.unit_price * request.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {!loading && !error && requests.length > 0 && (
                    <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-200">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-secondary-600">
                                Total requests: {requests.length}
                            </span>
                            <span className="text-lg font-bold text-primary-700">
                                Total value: ${requests.reduce((sum, req) => sum + (req.unit_price * req.quantity), 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ItemRequestHistoryModal;