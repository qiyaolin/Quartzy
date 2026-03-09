import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, MapPin, Package, Plus, Save, Trash2, X } from 'lucide-react';

import { API_ENDPOINTS, buildApiUrl } from '../config/api.ts';

const buildEmptyForm = () => ({
    name: '',
    item_type_id: '',
    vendor_id: '',
    owner_id: '1',
    catalog_number: '',
    quantity: '1.00',
    unit: '',
    price: '',
    fund_id: '',
    expiration_date: '',
    lot_number: '',
    received_date: '',
    expiration_alert_days: '30',
    storage_temperature: '',
    storage_conditions: '',
});

const buildEmptyAllocation = () => ({
    location_id: '',
    quantity: '',
    note: '',
});

const formatApiError = (payload: any) => {
    if (!payload) {
        return 'Submission failed.';
    }
    if (typeof payload === 'string') {
        return payload;
    }
    if (Array.isArray(payload)) {
        return payload.map((entry) => formatApiError(entry)).join(' ');
    }
    if (typeof payload === 'object') {
        return Object.entries(payload)
            .map(([key, value]) => `${key}: ${formatApiError(value)}`)
            .join(' ');
    }
    return String(payload);
};

const buildInitialAllocations = (initialData: any) => {
    const source = initialData?.location_allocations?.length
        ? initialData.location_allocations
        : initialData?.location_summary || [];

    if (!source.length && initialData?.location?.id) {
        return [{
            location_id: String(initialData.location.id),
            quantity: String(initialData.quantity || '1.00'),
            note: '',
        }];
    }

    return source.map((allocation: any) => ({
        location_id: String(allocation.location?.id || allocation.location_id || ''),
        quantity: String(allocation.quantity || ''),
        note: allocation.note || '',
    }));
};

const ItemFormModal = ({ isOpen, onClose, onSave, token, initialData = null }) => {
    const [formData, setFormData] = useState<any>(buildEmptyForm());
    const [allocations, setAllocations] = useState<any[]>([buildEmptyAllocation()]);
    const [dropdownData, setDropdownData] = useState<any>({ vendors: [], locations: [], itemTypes: [], funds: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customVendor, setCustomVendor] = useState('');
    const isEditMode = initialData !== null;

    const totalAllocated = useMemo(
        () => allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.quantity) || 0), 0),
        [allocations],
    );
    const targetQuantity = parseFloat(formData.quantity || '0') || 0;
    const remainingQuantity = Number((targetQuantity - totalAllocated).toFixed(2));

    useEffect(() => {
        if (isEditMode && initialData) {
            setFormData({
                name: initialData.name || '',
                item_type_id: initialData.item_type?.id ? String(initialData.item_type.id) : '',
                vendor_id: initialData.vendor?.id ? String(initialData.vendor.id) : '',
                owner_id: initialData.owner?.id ? String(initialData.owner.id) : '1',
                catalog_number: initialData.catalog_number || '',
                quantity: String(initialData.quantity || '1.00'),
                unit: initialData.unit || '',
                price: initialData.price ? String(initialData.price) : '',
                fund_id: initialData.fund_id ? String(initialData.fund_id) : '',
                expiration_date: initialData.expiration_date || '',
                lot_number: initialData.lot_number || '',
                received_date: initialData.received_date || '',
                expiration_alert_days: String(initialData.expiration_alert_days || '30'),
                storage_temperature: initialData.storage_temperature || '',
                storage_conditions: initialData.storage_conditions || '',
            });
            const nextAllocations = buildInitialAllocations(initialData);
            setAllocations(nextAllocations.length ? nextAllocations : [buildEmptyAllocation()]);
        } else {
            setFormData(buildEmptyForm());
            setAllocations([buildEmptyAllocation()]);
        }
        setCustomVendor('');
        setError(null);
    }, [initialData, isEditMode]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const fetchDropdownData = async () => {
            try {
                const headers = { Authorization: `Token ${token}` };
                const [vendorsRes, locationsRes, itemTypesRes, fundsRes] = await Promise.all([
                    fetch(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
                    fetch(buildApiUrl(`${API_ENDPOINTS.LOCATIONS}?leaf_only=true`), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.ITEM_TYPES), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.FUNDS), { headers }),
                ]);

                const vendors = await vendorsRes.json();
                const locations = await locationsRes.json();
                const itemTypes = await itemTypesRes.json();

                let funds = [];
                if (fundsRes.ok) {
                    const fundsData = await fundsRes.json();
                    funds = (fundsData.results || fundsData).filter((fund: any) => !fund.is_archived);
                }

                setDropdownData({
                    vendors,
                    locations: Array.isArray(locations) ? locations : [],
                    itemTypes,
                    funds,
                });
            } catch (fetchError) {
                setError('Could not load form data.');
            }
        };

        fetchDropdownData();
    }, [isOpen, token]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (name === 'vendor_id' && value !== 'custom') {
            setCustomVendor('');
        }
    };

    const handleAllocationChange = (index: number, field: string, value: string) => {
        setAllocations((prev) => prev.map((allocation, currentIndex) => (
            currentIndex === index ? { ...allocation, [field]: value } : allocation
        )));
    };

    const addAllocationRow = () => {
        setAllocations((prev) => [...prev, buildEmptyAllocation()]);
    };

    const removeAllocationRow = (index: number) => {
        setAllocations((prev) => (prev.length === 1 ? prev : prev.filter((_, currentIndex) => currentIndex !== index)));
    };

    const createVendor = async (vendorName: string) => {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.VENDORS), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Token ${token}`,
            },
            body: JSON.stringify({ name: vendorName }),
        });
        if (!response.ok) {
            throw new Error('Failed to create vendor');
        }
        const newVendor = await response.json();
        return newVendor.id;
    };

    const buildPayload = async () => {
        const trimmedAllocations = allocations
            .map((allocation, index) => ({
                location_id: allocation.location_id,
                quantity: allocation.quantity,
                note: allocation.note?.trim?.() || '',
                sort_order: index,
            }))
            .filter((allocation) => allocation.location_id || allocation.quantity || allocation.note);

        if (!trimmedAllocations.length) {
            throw new Error('At least one location allocation is required.');
        }

        if (trimmedAllocations.some((allocation) => !allocation.location_id || !allocation.quantity)) {
            throw new Error('Each allocation row needs both a location and a quantity.');
        }

        const duplicateLocationIds = new Set<string>();
        for (const allocation of trimmedAllocations) {
            if (duplicateLocationIds.has(allocation.location_id)) {
                throw new Error('Duplicate locations are not allowed in allocations.');
            }
            duplicateLocationIds.add(allocation.location_id);
        }

        const roundedRemaining = Number((targetQuantity - totalAllocated).toFixed(2));
        if (roundedRemaining !== 0) {
            throw new Error('Allocated quantity must match total quantity exactly.');
        }

        let vendorId = formData.vendor_id;
        if (formData.vendor_id === 'custom' && customVendor.trim()) {
            vendorId = String(await createVendor(customVendor.trim()));
        }

        return {
            ...formData,
            vendor_id: vendorId || null,
            fund_id: formData.fund_id || null,
            price: formData.price || null,
            expiration_date: formData.expiration_date || null,
            received_date: formData.received_date || null,
            location_id: trimmedAllocations[0].location_id,
            location_allocations: trimmedAllocations.map((allocation) => ({
                ...allocation,
                location_id: Number(allocation.location_id),
            })),
        };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = await buildPayload();
            const isGroupEdit = Array.isArray(initialData?.group_item_ids) && initialData.group_item_ids.length > 1;
            const url = isGroupEdit
                ? buildApiUrl('/api/items/merge_group/')
                : isEditMode
                    ? buildApiUrl(`/api/items/${initialData.id}/`)
                    : buildApiUrl(API_ENDPOINTS.ITEMS);
            const method = isGroupEdit ? 'POST' : isEditMode ? 'PUT' : 'POST';
            const requestBody = isGroupEdit
                ? { ...payload, item_ids: initialData.group_item_ids }
                : payload;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Token ${token}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                throw new Error(formatApiError(errorPayload));
            }

            if (!isEditMode && payload.fund_id && payload.price && payload.quantity) {
                const totalCost = (parseFloat(payload.price) || 0) * (parseFloat(payload.quantity) || 0);
                if (totalCost > 0) {
                    await fetch(buildApiUrl(API_ENDPOINTS.TRANSACTIONS), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Token ${token}`,
                        },
                        body: JSON.stringify({
                            fund_id: payload.fund_id,
                            amount: totalCost,
                            transaction_type: 'purchase',
                            item_name: payload.name,
                            description: `Purchase of ${payload.name} - ${payload.quantity} ${payload.unit || 'units'}`,
                            transaction_date: new Date().toISOString().split('T')[0],
                        }),
                    });
                }
            }

            onSave();
            onClose();
        } catch (submitError: any) {
            setError(submitError.message || 'Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-backdrop animate-fade-in">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="modal-panel modal-panel-large animate-scale-in">
                    <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-5 border-b border-primary-200 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
                                    <p className="text-sm text-primary-700">Manage item details and exact slot allocations.</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-primary-200 transition-all duration-200">
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
                            <section className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">Item Name *</label>
                                        <input id="name" name="name" value={formData.name} onChange={handleChange} required className="input" />
                                    </div>
                                    <div>
                                        <label htmlFor="item_type_id" className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
                                        <select id="item_type_id" name="item_type_id" value={formData.item_type_id} onChange={handleChange} required className="select">
                                            <option value="">Select type...</option>
                                            {dropdownData.itemTypes.map((type: any) => (
                                                <option key={type.id} value={type.id}>{type.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="vendor_id" className="block text-sm font-semibold text-gray-700 mb-2">Vendor</label>
                                        <select id="vendor_id" name="vendor_id" value={formData.vendor_id} onChange={handleChange} className="select">
                                            <option value="">Select vendor...</option>
                                            {dropdownData.vendors.map((vendor: any) => (
                                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                            ))}
                                            <option value="custom">+ Add New Vendor</option>
                                        </select>
                                        {formData.vendor_id === 'custom' && (
                                            <input
                                                type="text"
                                                value={customVendor}
                                                onChange={(event) => setCustomVendor(event.target.value)}
                                                className="input mt-3"
                                                placeholder="Enter new vendor name"
                                                required
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label htmlFor="catalog_number" className="block text-sm font-semibold text-gray-700 mb-2">Catalog Number</label>
                                        <input id="catalog_number" name="catalog_number" value={formData.catalog_number} onChange={handleChange} className="input" />
                                    </div>
                                    <div>
                                        <label htmlFor="lot_number" className="block text-sm font-semibold text-gray-700 mb-2">Lot Number</label>
                                        <input id="lot_number" name="lot_number" value={formData.lot_number} onChange={handleChange} className="input" />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">Stock and Locations</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-2">Total Quantity *</label>
                                        <input id="quantity" name="quantity" type="number" step="0.01" min="0.01" value={formData.quantity} onChange={handleChange} required className="input" />
                                    </div>
                                    <div>
                                        <label htmlFor="unit" className="block text-sm font-semibold text-gray-700 mb-2">Unit *</label>
                                        <input id="unit" name="unit" value={formData.unit} onChange={handleChange} required className="input" placeholder="e.g. box, bottle, mL" />
                                    </div>
                                    <div>
                                        <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-2">Unit Price</label>
                                        <input id="price" name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} className="input" />
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-gray-900 flex items-center"><MapPin className="w-4 h-4 mr-2 text-primary-600" />Location Allocations</h4>
                                            <p className="text-sm text-gray-600">Choose exact leaf slots and assign quantities.</p>
                                        </div>
                                        <button type="button" onClick={addAllocationRow} className="btn btn-secondary btn-sm">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Slot
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <div className="col-span-5">Location</div>
                                        <div className="col-span-2">Qty</div>
                                        <div className="col-span-4">Note</div>
                                        <div className="col-span-1"> </div>
                                    </div>

                                    {allocations.map((allocation, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-3 items-start">
                                            <div className="col-span-5">
                                                <select
                                                    value={allocation.location_id}
                                                    onChange={(event) => handleAllocationChange(index, 'location_id', event.target.value)}
                                                    className="select"
                                                    required
                                                >
                                                    <option value="">Select slot...</option>
                                                    {dropdownData.locations.map((location: any) => (
                                                        <option key={location.id} value={location.id}>
                                                            {location.full_path || location.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={allocation.quantity}
                                                    onChange={(event) => handleAllocationChange(index, 'quantity', event.target.value)}
                                                    className="input"
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-4">
                                                <input
                                                    type="text"
                                                    value={allocation.note}
                                                    onChange={(event) => handleAllocationChange(index, 'note', event.target.value)}
                                                    className="input"
                                                    placeholder="Optional note"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <button type="button" onClick={() => removeAllocationRow(index)} className="p-2 text-danger-600 hover:bg-danger-50 rounded-lg">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3 text-sm">
                                        <span className="text-gray-600">Allocated: <strong>{totalAllocated.toFixed(2)}</strong> / {targetQuantity.toFixed(2)}</span>
                                        <span className={remainingQuantity === 0 ? 'text-success-700 font-semibold' : 'text-warning-700 font-semibold'}>
                                            Remaining: {remainingQuantity.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">Storage and Dates</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="storage_temperature" className="block text-sm font-semibold text-gray-700 mb-2">Storage Temperature</label>
                                        <input id="storage_temperature" name="storage_temperature" value={formData.storage_temperature} onChange={handleChange} className="input" />
                                    </div>
                                    <div>
                                        <label htmlFor="expiration_alert_days" className="block text-sm font-semibold text-gray-700 mb-2">Alert Days</label>
                                        <input id="expiration_alert_days" name="expiration_alert_days" type="number" min="1" max="365" value={formData.expiration_alert_days} onChange={handleChange} className="input" />
                                    </div>
                                    <div>
                                        <label htmlFor="expiration_date" className="block text-sm font-semibold text-gray-700 mb-2">Expiration Date</label>
                                        <input id="expiration_date" name="expiration_date" type="date" value={formData.expiration_date} onChange={handleChange} className="input" />
                                    </div>
                                    <div>
                                        <label htmlFor="received_date" className="block text-sm font-semibold text-gray-700 mb-2">Received Date</label>
                                        <input id="received_date" name="received_date" type="date" value={formData.received_date} onChange={handleChange} className="input" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label htmlFor="storage_conditions" className="block text-sm font-semibold text-gray-700 mb-2">Storage Conditions</label>
                                        <textarea id="storage_conditions" name="storage_conditions" value={formData.storage_conditions} onChange={handleChange} rows={3} className="input resize-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="fund_id" className="block text-sm font-semibold text-gray-700 mb-2">Funding Source</label>
                                        <select id="fund_id" name="fund_id" value={formData.fund_id} onChange={handleChange} className="select">
                                            <option value="">No funding source</option>
                                            {dropdownData.funds.map((fund: any) => (
                                                <option key={fund.id} value={fund.id}>
                                                    {fund.name} - ${((parseFloat(fund.total_budget) || 0) - (parseFloat(fund.spent_amount) || 0)).toLocaleString()} remaining
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {error && (
                            <div className="mx-6">
                                <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 flex items-start space-x-3">
                                    <AlertCircle className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-danger-700 text-sm">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200 rounded-b-2xl">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">Primary location will be the first allocation row.</p>
                                <div className="flex space-x-3">
                                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                                        <Save className="w-4 h-4 mr-2" />
                                        {isSubmitting ? 'Saving...' : isEditMode ? 'Update Item' : 'Save Item'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ItemFormModal;
