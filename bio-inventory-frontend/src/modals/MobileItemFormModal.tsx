import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, MapPin, Package, Plus, Save, Trash2, X } from 'lucide-react';

import { API_ENDPOINTS, buildApiUrl } from '../config/api.ts';

interface MobileItemFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    token: string;
    initialData?: any;
}

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

const toErrorMessage = (payload: any): string => {
    if (!payload) return 'Submission failed.';
    if (typeof payload === 'string') return payload;
    if (Array.isArray(payload)) return payload.map((entry) => toErrorMessage(entry)).join(' ');
    if (typeof payload === 'object') {
        return Object.entries(payload)
            .map(([key, value]) => `${key}: ${toErrorMessage(value)}`)
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

const MobileItemFormModal = ({ isOpen, onClose, onSave, token, initialData = null }: MobileItemFormModalProps) => {
    const [formData, setFormData] = useState<any>(buildEmptyForm());
    const [allocations, setAllocations] = useState<any[]>([buildEmptyAllocation()]);
    const [dropdownData, setDropdownData] = useState<any>({ vendors: [], locations: [], itemTypes: [], funds: [] });
    const [customVendor, setCustomVendor] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        if (!isOpen) return;

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

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
        if (name === 'vendor_id' && value !== 'custom') {
            setCustomVendor('');
        }
    };

    const handleAllocationChange = (index: number, field: string, value: string) => {
        setAllocations((prev) => prev.map((allocation, currentIndex) => (
            currentIndex === index ? { ...allocation, [field]: value } : allocation
        )));
    };

    const addAllocationRow = () => setAllocations((prev) => [...prev, buildEmptyAllocation()]);
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
            throw new Error('Each allocation needs a location and quantity.');
        }

        const seenLocations = new Set<string>();
        for (const allocation of trimmedAllocations) {
            if (seenLocations.has(allocation.location_id)) {
                throw new Error('Duplicate locations are not allowed.');
            }
            seenLocations.add(allocation.location_id);
        }

        if (Number((targetQuantity - totalAllocated).toFixed(2)) !== 0) {
            throw new Error('Allocated quantity must match total quantity.');
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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = await buildPayload();
            const isGroupEdit = Array.isArray(initialData?.group_item_ids) && initialData.group_item_ids.length > 1;
            const url = isGroupEdit
                ? buildApiUrl('/api/items/merge_group/')
                : isEditMode
                    ? buildApiUrl(`/api/items/${initialData?.id}/`)
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
                throw new Error(toErrorMessage(errorPayload));
            }

            onSave();
            onClose();
        } catch (submitError: any) {
            setError(submitError.message || 'Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl shadow-xl max-h-[100dvh] sm:max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl">
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-4 py-5 border-b border-green-200 sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
                                <p className="text-sm text-green-700">Use exact slots for every quantity split.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-green-200 transition-colors">
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="px-4 py-4 space-y-5 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100dvh - 160px)' }}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name *</label>
                                <input name="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
                                <select name="item_type_id" value={formData.item_type_id} onChange={handleChange} required className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg">
                                    <option value="">Select type...</option>
                                    {dropdownData.itemTypes.map((type: any) => (
                                        <option key={type.id} value={type.id}>{type.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor</label>
                                <select name="vendor_id" value={formData.vendor_id} onChange={handleChange} className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg">
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
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg mt-3"
                                        placeholder="Enter new vendor name"
                                        required
                                    />
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Total Qty *</label>
                                    <input name="quantity" type="number" step="0.01" min="0.01" value={formData.quantity} onChange={handleChange} required className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Unit *</label>
                                    <input name="unit" value={formData.unit} onChange={handleChange} required className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900 flex items-center"><MapPin className="w-4 h-4 mr-2 text-green-600" />Location Allocations</h3>
                                    <p className="text-sm text-gray-600">Each row must be a final slot.</p>
                                </div>
                                <button type="button" onClick={addAllocationRow} className="px-3 py-2 rounded-lg bg-white border border-green-200 text-green-700 text-sm font-medium flex items-center">
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add
                                </button>
                            </div>

                            {allocations.map((allocation, index) => (
                                <div key={index} className="space-y-3 rounded-xl bg-white p-3 border border-green-100">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Location</label>
                                        <select
                                            value={allocation.location_id}
                                            onChange={(event) => handleAllocationChange(index, 'location_id', event.target.value)}
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg"
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Quantity</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={allocation.quantity}
                                                onChange={(event) => handleAllocationChange(index, 'quantity', event.target.value)}
                                                className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Note</label>
                                            <input
                                                type="text"
                                                value={allocation.note}
                                                onChange={(event) => handleAllocationChange(index, 'note', event.target.value)}
                                                className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeAllocationRow(index)} className="text-red-600 text-sm font-medium flex items-center">
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Remove row
                                    </button>
                                </div>
                            ))}

                            <div className="rounded-xl bg-white px-4 py-3 text-sm">
                                <div className="flex justify-between">
                                    <span>Allocated</span>
                                    <strong>{totalAllocated.toFixed(2)} / {targetQuantity.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span>Remaining</span>
                                    <strong className={remainingQuantity === 0 ? 'text-green-700' : 'text-amber-700'}>
                                        {remainingQuantity.toFixed(2)}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Catalog #</label>
                                    <input name="catalog_number" value={formData.catalog_number} onChange={handleChange} className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lot #</label>
                                    <input name="lot_number" value={formData.lot_number} onChange={handleChange} className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Expiration</label>
                                    <input name="expiration_date" type="date" value={formData.expiration_date} onChange={handleChange} className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Received</label>
                                    <input name="received_date" type="date" value={formData.received_date} onChange={handleChange} className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg" />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-medium">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium flex items-center">
                            <Save className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Item' : 'Save Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MobileItemFormModal;
