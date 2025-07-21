import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ItemFormModal = ({ isOpen, onClose, onSave, token, initialData = null }) => {
    const [formData, setFormData] = useState<any>({});
    const [dropdownData, setDropdownData] = useState<any>({ vendors: [], locations: [], itemTypes: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditMode = initialData !== null;

    useEffect(() => {
        const emptyForm = { name: '', item_type_id: '', vendor_id: '', owner_id: '1', catalog_number: '', quantity: '1.00', unit: '', location_id: '', price: '', expiration_date: '', lot_number: '', received_date: '', expiration_alert_days: '30', storage_temperature: '', storage_conditions: '' };
        if (isEditMode) {
            setFormData({
                name: initialData.name || '', item_type_id: initialData.item_type?.id || '', vendor_id: initialData.vendor?.id || '',
                owner_id: initialData.owner?.id || '1', catalog_number: initialData.catalog_number || '', quantity: initialData.quantity || '1.00',
                unit: initialData.unit || '', location_id: initialData.location?.id || '', price: initialData.price || '',
                expiration_date: initialData.expiration_date || '', lot_number: initialData.lot_number || '', received_date: initialData.received_date || '',
                expiration_alert_days: initialData.expiration_alert_days || '30', storage_temperature: initialData.storage_temperature || '', storage_conditions: initialData.storage_conditions || ''
            });
        } else { setFormData(emptyForm); }
    }, [initialData, isEditMode]);

    useEffect(() => {
        if (isOpen) {
            const fetchDropdownData = async () => {
                try {
                    const headers = { 'Authorization': `Token ${token}` };
                    const [vendorsRes, locationsRes, itemTypesRes] = await Promise.all([
                        fetch('http://127.0.0.1:8000/api/vendors/', { headers }),
                        fetch('http://127.0.0.1:8000/api/locations/', { headers }),
                        fetch('http://127.0.0.1:8000/api/item-types/', { headers }),
                    ]);
                    const vendors = await vendorsRes.json(); const locations = await locationsRes.json(); const itemTypes = await itemTypesRes.json();
                    setDropdownData({ vendors, locations, itemTypes });
                } catch (e) { setError('Could not load form data.'); }
            };
            fetchDropdownData();
        }
    }, [isOpen, token]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        const url = isEditMode ? `http://127.0.0.1:8000/api/items/${initialData.id}/` : 'http://127.0.0.1:8000/api/items/';
        const method = isEditMode ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` }, body: JSON.stringify(formData) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(JSON.stringify(errorData)); }
            onSave(); onClose();
        } catch (e) { setError(`Submission failed: ${e.message}`); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button></div>
                <form onSubmit={handleSubmit}>
                    <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-h-[60vh] overflow-y-auto">
                        <div className="col-span-2">
                            <label htmlFor="name" className="block text-sm font-medium text-secondary-700 mb-2">Item Name *</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="input" placeholder="Enter item name" />
                        </div>
                        <div>
                            <label htmlFor="item_type_id" className="block text-sm font-medium text-secondary-700 mb-2">Type *</label>
                            <select name="item_type_id" id="item_type_id" value={formData.item_type_id} onChange={handleChange} required className="select">
                                <option value="">Select type...</option>
                                {dropdownData.itemTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="vendor_id" className="block text-sm font-medium text-secondary-700 mb-2">Vendor</label>
                            <select name="vendor_id" id="vendor_id" value={formData.vendor_id} onChange={handleChange} className="select">
                                <option value="">Select vendor...</option>
                                {dropdownData.vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="location_id" className="block text-sm font-medium text-secondary-700 mb-2">Location</label>
                            <select name="location_id" id="location_id" value={formData.location_id} onChange={handleChange} className="select">
                                <option value="">Select location...</option>
                                {dropdownData.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-secondary-700 mb-2">Quantity</label>
                            <input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} step="0.01" className="input" placeholder="1.00" />
                        </div>
                        <div>
                            <label htmlFor="unit" className="block text-sm font-medium text-secondary-700 mb-2">Unit</label>
                            <input type="text" name="unit" id="unit" placeholder="e.g., box, kg, mL" value={formData.unit} onChange={handleChange} className="input" />
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-secondary-700 mb-2">Unit Price</label>
                            <input type="number" name="price" id="price" placeholder="0.00" value={formData.price} onChange={handleChange} step="0.01" className="input" />
                        </div>
                        <div>
                            <label htmlFor="catalog_number" className="block text-sm font-medium text-secondary-700 mb-2">Catalog Number</label>
                            <input type="text" name="catalog_number" id="catalog_number" placeholder="e.g., C1234" value={formData.catalog_number} onChange={handleChange} className="input" />
                        </div>
                        <div>
                            <label htmlFor="lot_number" className="block text-sm font-medium text-secondary-700 mb-2">Lot/Batch Number</label>
                            <input type="text" name="lot_number" id="lot_number" placeholder="e.g., LOT123456" value={formData.lot_number} onChange={handleChange} className="input" />
                        </div>
                        <div>
                            <label htmlFor="expiration_date" className="block text-sm font-medium text-secondary-700 mb-2">Expiration Date</label>
                            <input type="date" name="expiration_date" id="expiration_date" value={formData.expiration_date} onChange={handleChange} className="input" />
                        </div>
                        <div>
                            <label htmlFor="received_date" className="block text-sm font-medium text-secondary-700 mb-2">Received Date</label>
                            <input type="date" name="received_date" id="received_date" value={formData.received_date} onChange={handleChange} className="input" />
                        </div>
                        <div>
                            <label htmlFor="expiration_alert_days" className="block text-sm font-medium text-secondary-700 mb-2">Alert Days Before Expiration</label>
                            <input type="number" name="expiration_alert_days" id="expiration_alert_days" value={formData.expiration_alert_days} onChange={handleChange} min="1" max="365" className="input" placeholder="30" />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="storage_temperature" className="block text-sm font-medium text-secondary-700 mb-2">Storage Temperature</label>
                            <input type="text" name="storage_temperature" id="storage_temperature" placeholder="e.g., -80°C, 4°C, RT" value={formData.storage_temperature} onChange={handleChange} className="input" />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="storage_conditions" className="block text-sm font-medium text-secondary-700 mb-2">Storage Conditions</label>
                            <textarea name="storage_conditions" id="storage_conditions" rows="2" placeholder="Additional storage requirements..." value={formData.storage_conditions} onChange={handleChange} className="input resize-none"></textarea>
                        </div>
                    </div>
                    {error && <div className="px-6 pb-4 text-danger-600 text-sm bg-danger-50 rounded-lg mx-6 mb-4 p-3">{error}</div>}
                    <div className="p-6 bg-secondary-50 border-t border-secondary-200 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            {isSubmitting && <div className="loading-spinner w-4 h-4 mr-2"></div>}
                            {isEditMode ? 'Update Item' : 'Save Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ItemFormModal;
