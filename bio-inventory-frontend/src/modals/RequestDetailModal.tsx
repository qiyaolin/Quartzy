import React, { useContext, useEffect, useState } from 'react';
import { AlertCircle, Calendar, Edit3, FileText, Save, User, X } from 'lucide-react';

import { AuthContext } from '../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const buildFormData = (request) => ({
    item_name: request?.item_name || '',
    item_type_id: request?.item_type?.id ? String(request.item_type.id) : '',
    vendor_id: request?.vendor?.id ? String(request.vendor.id) : '',
    fund_id: request?.fund_id ? String(request.fund_id) : '',
    catalog_number: request?.catalog_number || '',
    quantity: request?.quantity || 1,
    unit_size: request?.unit_size || '',
    unit_price: request?.unit_price || '',
    url: request?.url || '',
    notes: request?.notes || '',
});

const RequestDetailModal = ({ isOpen, onClose, request, onSave, token }) => {
    const { user } = useContext(AuthContext);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(buildFormData(request));
    const [dropdownData, setDropdownData] = useState({ vendors: [], itemTypes: [], funds: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const isAdmin = user?.is_staff;
    const canEdit = isAdmin || (request?.requested_by?.id === user?.id && request?.status === 'NEW');

    useEffect(() => {
        if (request && isOpen) {
            setFormData(buildFormData(request));
            setError(null);
            setIsEditing(false);
        }
    }, [request, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchDropdownData = async () => {
            try {
                const headers = { Authorization: `Token ${token}` };
                const [vendorsRes, itemTypesRes, fundsRes] = await Promise.all([
                    fetch(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.ITEM_TYPES), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.FUNDS), { headers }),
                ]);
                const vendors = await vendorsRes.json();
                const itemTypes = await itemTypesRes.json();
                const fundsPayload = fundsRes.ok ? await fundsRes.json() : [];
                const funds = (fundsPayload?.results || fundsPayload || []).filter((fund) => !fund.is_archived);
                setDropdownData({ vendors, itemTypes, funds });
            } catch (fetchError) {
                console.error('Failed to load request detail dropdowns:', fetchError);
            }
        };
        fetchDropdownData();
    }, [isOpen, token]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                item_name: formData.item_name.trim(),
                item_type_id: formData.item_type_id || null,
                vendor_id: formData.vendor_id || null,
                fund_id: formData.fund_id || null,
                catalog_number: formData.catalog_number.trim(),
                quantity: Number(formData.quantity),
                unit_size: formData.unit_size.trim(),
                unit_price: formData.unit_price,
                url: formData.url.trim(),
                notes: formData.notes.trim(),
            };

            const response = await fetch(buildApiUrl(`/api/requests/${request.id}/`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Token ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                throw new Error(JSON.stringify(errorPayload || { error: 'Failed to save changes.' }));
            }

            setIsEditing(false);
            onSave?.();
        } catch (saveError) {
            setError(`Failed to save changes: ${saveError.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !request) return null;

    const totalCost = (parseFloat(request.unit_price) || 0) * (parseFloat(request.quantity) || 0);

    const renderField = (label, value, input) => (
        <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">{label}</label>
            {isEditing ? input : <p className="text-secondary-900">{value || 'N/A'}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-secondary-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary-900">Request Details</h2>
                        <p className="mt-2 text-sm text-secondary-600">Status: <span className="font-semibold">{request.status}</span></p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {canEdit && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="btn btn-secondary flex items-center">
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit
                            </button>
                        )}
                        {isEditing && (
                            <button onClick={handleSave} disabled={loading} className="btn btn-primary flex items-center">
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

                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                    {error && (
                        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                            <div className="flex items-center">
                                <AlertCircle className="w-5 h-5 text-danger-600 mr-2" />
                                <span className="text-danger-700 font-medium">Error</span>
                            </div>
                            <p className="text-danger-600 mt-1 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-secondary-900 border-b pb-2">Procurement</h3>
                            {renderField('Item Name', request.item_name, (
                                <input type="text" name="item_name" value={formData.item_name} onChange={handleChange} className="input" required />
                            ))}
                            {renderField('Item Type', request.item_type?.name, (
                                <select name="item_type_id" value={formData.item_type_id} onChange={handleChange} className="select">
                                    <option value="">Select type...</option>
                                    {dropdownData.itemTypes.map((itemType) => (
                                        <option key={itemType.id} value={itemType.id}>{itemType.name}</option>
                                    ))}
                                </select>
                            ))}
                            {renderField('Vendor', request.vendor?.name, (
                                <select name="vendor_id" value={formData.vendor_id} onChange={handleChange} className="select">
                                    <option value="">Select vendor...</option>
                                    {dropdownData.vendors.map((vendor) => (
                                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                    ))}
                                </select>
                            ))}
                            {renderField('Catalog Number', request.catalog_number, (
                                <input type="text" name="catalog_number" value={formData.catalog_number} onChange={handleChange} className="input" />
                            ))}
                            {renderField('Product URL', request.url, (
                                <input type="url" name="url" value={formData.url} onChange={handleChange} className="input" />
                            ))}
                            {renderField('Funding Source', request.fund_id ? `Fund #${request.fund_id}` : '', (
                                <select name="fund_id" value={formData.fund_id} onChange={handleChange} className="select">
                                    <option value="">Select fund...</option>
                                    {dropdownData.funds.map((fund) => (
                                        <option key={fund.id} value={fund.id}>{fund.name}</option>
                                    ))}
                                </select>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-secondary-900 border-b pb-2">Request State</h3>
                            {renderField('Quantity', request.quantity, (
                                <input type="number" min="1" name="quantity" value={formData.quantity} onChange={handleChange} className="input" />
                            ))}
                            {renderField('Remaining Quantity', request.remaining_quantity, null)}
                            {renderField('Unit Size', request.unit_size, (
                                <input type="text" name="unit_size" value={formData.unit_size} onChange={handleChange} className="input" />
                            ))}
                            {renderField('Unit Price', request.unit_price ? `$${request.unit_price}` : '', (
                                <input type="number" step="0.01" min="0" name="unit_price" value={formData.unit_price} onChange={handleChange} className="input" />
                            ))}
                            {renderField('Barcode', request.barcode, null)}
                            {renderField('Requested By', request.requested_by_name || request.requested_by?.username, null)}
                            {renderField('Approved By', request.approved_by_name, null)}
                            {renderField('Received By', request.received_by_name, null)}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Created
                            </label>
                            <p className="text-secondary-900">{new Date(request.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-1">
                                <User className="w-4 h-4 inline mr-1" />
                                Updated
                            </label>
                            <p className="text-secondary-900">{new Date(request.updated_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                            <FileText className="w-4 h-4 inline mr-1" />
                            Notes
                        </label>
                        {isEditing ? (
                            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="4" className="textarea" />
                        ) : (
                            <p className="text-secondary-900 bg-secondary-50 p-3 rounded-lg">{request.notes || 'No notes provided.'}</p>
                        )}
                    </div>

                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-secondary-700 font-medium">Total Cost</span>
                            <span className="text-2xl font-bold text-primary-700">${totalCost.toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-secondary-600 mt-1">{request.quantity} × ${request.unit_price || 0} each</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestDetailModal;
