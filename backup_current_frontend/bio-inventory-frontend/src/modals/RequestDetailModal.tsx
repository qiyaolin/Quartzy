import React, { useState, useEffect, useContext } from 'react';
import { X, Edit3, Calendar, User, Package, FileText, DollarSign, Save, AlertCircle, CheckCircle, CheckCircle2 } from 'lucide-react';
import { AuthContext } from '../components/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const RequestDetailModal = ({ isOpen, onClose, request, onSave, token }) => {
    const { user } = useContext(AuthContext);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [vendors, setVendors] = useState([]);

    const isAdmin = user?.is_staff;
    const canEdit = isAdmin || (request?.requested_by?.id === user?.id && request?.status === 'NEW');

    useEffect(() => {
        if (request && isOpen) {
            setFormData({
                item_name: request.item_name || '',
                vendor_id: request.vendor?.id || '',
                catalog_number: request.catalog_number || '',
                quantity: request.quantity || 1,
                unit_price: request.unit_price || '',
                notes: request.notes || '',
                justification: request.justification || '',
                urgency: request.urgency || 'NORMAL',
                budget_code: request.budget_code || ''
            });
        }
    }, [request, isOpen]);

    useEffect(() => {
        if (isOpen && isEditing) {
            const fetchVendors = async () => {
                try {
                    const response = await fetch(buildApiUrl(API_ENDPOINTS.VENDORS), {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    const data = await response.json();
                    setVendors(data);
                } catch (error) {
                    console.error('Failed to load vendors:', error);
                }
            };
            fetchVendors();
        }
    }, [isOpen, isEditing, token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(buildApiUrl(`/api/requests/${request.id}/`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }

            setIsEditing(false);
            onSave && onSave();
        } catch (error) {
            setError(`Failed to save changes: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'NEW': { class: 'badge-warning', label: 'New', icon: AlertCircle },
            'APPROVED': { class: 'badge-success', label: 'Approved', icon: CheckCircle },
            'ORDERED': { class: 'badge-primary', label: 'Ordered', icon: Package },
            'RECEIVED': { class: 'badge-secondary', label: 'Received', icon: CheckCircle2 }
        };
        const config = statusConfig[status] || { class: 'badge-secondary', label: status, icon: AlertCircle };
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

    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-secondary-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary-900">Request Details</h2>
                        <div className="flex items-center space-x-2 mt-2">
                            {getStatusBadge(request.status)}
                            <span className={`text-sm font-medium ${getUrgencyColor(request.urgency)}`}>
                                {request.urgency} Priority
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {canEdit && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="btn btn-secondary flex items-center"
                            >
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit
                            </button>
                        )}
                        {isEditing && (
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn btn-primary flex items-center"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {loading ? 'Saving...' : 'Save'}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setError(null);
                                onClose();
                            }}
                            className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                        >
                            <X className="w-6 h-6 text-secondary-600" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {error && (
                        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <AlertCircle className="w-5 h-5 text-danger-600 mr-2" />
                                <span className="text-danger-700 font-medium">Error</span>
                            </div>
                            <p className="text-danger-600 mt-1 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Item Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-secondary-900 border-b pb-2">Item Information</h3>
                            
                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">Item Name</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="item_name"
                                        value={formData.item_name}
                                        onChange={handleChange}
                                        className="input"
                                        required
                                    />
                                ) : (
                                    <p className="text-secondary-900 font-medium">{request.item_name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">Vendor</label>
                                {isEditing ? (
                                    <select
                                        name="vendor_id"
                                        value={formData.vendor_id}
                                        onChange={handleChange}
                                        className="select"
                                    >
                                        <option value="">Select vendor...</option>
                                        {vendors.map(vendor => (
                                            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-secondary-900">{request.vendor?.name || 'N/A'}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">Catalog Number</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="catalog_number"
                                        value={formData.catalog_number}
                                        onChange={handleChange}
                                        className="input"
                                    />
                                ) : (
                                    <p className="text-secondary-900">{request.catalog_number || 'N/A'}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary-700 mb-1">Quantity</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            name="quantity"
                                            value={formData.quantity}
                                            onChange={handleChange}
                                            min="1"
                                            className="input"
                                        />
                                    ) : (
                                        <p className="text-secondary-900">{request.quantity}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary-700 mb-1">Unit Price</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            name="unit_price"
                                            value={formData.unit_price}
                                            onChange={handleChange}
                                            step="0.01"
                                            className="input"
                                        />
                                    ) : (
                                        <p className="text-secondary-900 font-mono">${request.unit_price}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Request Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-secondary-900 border-b pb-2">Request Details</h3>
                            
                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">Urgency</label>
                                {isEditing ? (
                                    <select
                                        name="urgency"
                                        value={formData.urgency}
                                        onChange={handleChange}
                                        className="select"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                ) : (
                                    <p className={`font-medium ${getUrgencyColor(request.urgency)}`}>
                                        {request.urgency}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">Budget Code</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="budget_code"
                                        value={formData.budget_code}
                                        onChange={handleChange}
                                        className="input"
                                    />
                                ) : (
                                    <p className="text-secondary-900">{request.budget_code || 'N/A'}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">
                                    <User className="w-4 h-4 inline mr-1" />
                                    Requested By
                                </label>
                                <p className="text-secondary-900">{request.requested_by?.username || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    Created
                                </label>
                                <p className="text-secondary-900">
                                    {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notes and Justification */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-1">
                                <FileText className="w-4 h-4 inline mr-1" />
                                Notes
                            </label>
                            {isEditing ? (
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows="3"
                                    className="textarea"
                                    placeholder="Additional notes or specifications..."
                                />
                            ) : (
                                <p className="text-secondary-900 bg-secondary-50 p-3 rounded-lg">
                                    {request.notes || 'No notes provided.'}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-1">Justification</label>
                            {isEditing ? (
                                <textarea
                                    name="justification"
                                    value={formData.justification}
                                    onChange={handleChange}
                                    rows="3"
                                    className="textarea"
                                    placeholder="Business justification for this request..."
                                />
                            ) : (
                                <p className="text-secondary-900 bg-secondary-50 p-3 rounded-lg">
                                    {request.justification || 'No justification provided.'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Total Cost */}
                    <div className="mt-6 bg-primary-50 border border-primary-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-secondary-700 font-medium flex items-center">
                                <DollarSign className="w-4 h-4 mr-1" />
                                Total Cost
                            </span>
                            <span className="text-2xl font-bold text-primary-700">
                                ${(request.unit_price * request.quantity).toFixed(2)}
                            </span>
                        </div>
                        <p className="text-sm text-secondary-600 mt-1">
                            {request.quantity} × ${request.unit_price} each
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestDetailModal;