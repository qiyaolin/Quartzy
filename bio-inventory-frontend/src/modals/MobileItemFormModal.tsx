import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, Calendar, MapPin, Tag, Beaker, Save, AlertCircle } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

interface MobileItemFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    token: string;
    initialData?: any;
}

const MobileItemFormModal = ({ isOpen, onClose, onSave, token, initialData = null }: MobileItemFormModalProps) => {
    const [formData, setFormData] = useState<any>({});
    const [dropdownData, setDropdownData] = useState<any>({ vendors: [], locations: [], itemTypes: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customVendor, setCustomVendor] = useState('');
    const isEditMode = initialData !== null;

    useEffect(() => {
        const emptyForm = { 
            name: '', 
            item_type_id: '', 
            vendor_id: '', 
            owner_id: '1', 
            catalog_number: '', 
            quantity: '1.00', 
            unit: '', 
            location_id: '', 
            price: '', 
            expiration_date: '', 
            lot_number: '', 
            received_date: '', 
            expiration_alert_days: '30', 
            storage_temperature: '', 
            storage_conditions: '' 
        };
        
        if (isEditMode && initialData) {
            setFormData({
                name: initialData.name || '', 
                item_type_id: initialData.item_type?.id || '', 
                vendor_id: initialData.vendor?.id || '',
                owner_id: initialData.owner?.id || '1', 
                catalog_number: initialData.catalog_number || '', 
                quantity: initialData.quantity || '1.00',
                unit: initialData.unit || '', 
                location_id: initialData.location?.id || '', 
                price: initialData.price || '',
                expiration_date: initialData.expiration_date || '', 
                lot_number: initialData.lot_number || '', 
                received_date: initialData.received_date || '',
                expiration_alert_days: initialData.expiration_alert_days || '30', 
                storage_temperature: initialData.storage_temperature || '', 
                storage_conditions: initialData.storage_conditions || ''
            });
        } else { 
            setFormData(emptyForm); 
        }
    }, [initialData, isEditMode]);

    useEffect(() => {
        if (isOpen) {
            const fetchDropdownData = async () => {
                try {
                    const headers = { 'Authorization': `Token ${token}` };
                    const [vendorsRes, locationsRes, itemTypesRes] = await Promise.all([
                        fetch(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
                        fetch(buildApiUrl(API_ENDPOINTS.LOCATIONS), { headers }),
                        fetch(buildApiUrl(API_ENDPOINTS.ITEM_TYPES), { headers }),
                    ]);
                    const vendors = await vendorsRes.json(); 
                    const locations = await locationsRes.json(); 
                    const itemTypes = await itemTypesRes.json();
                    setDropdownData({ vendors, locations, itemTypes });
                } catch (e) { 
                    setError('Could not load form data.'); 
                }
            };
            fetchDropdownData();
        }
    }, [isOpen, token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { 
        const { name, value } = e.target; 
        setFormData((prev: any) => ({ ...prev, [name]: value })); 
        if (name === 'vendor_id' && value !== 'custom') {
            setCustomVendor('');
        }
    };

    const createVendor = async (vendorName: string) => {
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.VENDORS), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({ name: vendorName })
            });
            if (response.ok) {
                const newVendor = await response.json();
                return newVendor.id;
            }
            throw new Error('Failed to create vendor');
        } catch (error) {
            throw error;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        setIsSubmitting(true); 
        setError(null);
        
        let finalFormData = { ...formData };
        
        // Handle custom vendor creation
        if (formData.vendor_id === 'custom' && customVendor.trim()) {
            try {
                const newVendorId = await createVendor(customVendor.trim());
                finalFormData.vendor_id = newVendorId;
            } catch (error) {
                setError('Failed to create new vendor');
                setIsSubmitting(false);
                return;
            }
        }
        
        const url = isEditMode ? buildApiUrl(`/api/items/${initialData?.id}/`) : buildApiUrl(API_ENDPOINTS.ITEMS);
        const method = isEditMode ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { 
                method: method, 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` }, 
                body: JSON.stringify(finalFormData) 
            });
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(JSON.stringify(errorData)); 
            }
            onSave(); 
            onClose();
        } catch (e: any) { 
            setError(`Submission failed: ${e.message}`); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-lg shadow-xl max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-4 sm:px-6 py-5 border-b border-green-200 rounded-t-2xl sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                                    {isEditMode ? 'Edit Item' : 'Add New Item'}
                                </h2>
                                <p className="text-sm text-green-700">
                                    {isEditMode ? 'Update the item details below' : 'Fill in the details for your new inventory item'}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-2.5 rounded-xl hover:bg-green-200 transition-all duration-200 group hover:scale-105"
                        >
                            <X className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    {/* Form Content - Scrollable */}
                    <div className="px-4 sm:px-6 py-4 space-y-6 overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 200px)' }}>
                        {/* Basic Information Section */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2 mb-4">
                                <Package className="w-5 h-5 text-green-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Item Name *
                                    </label>
                                    <input 
                                        type="text" 
                                        name="name" 
                                        id="name" 
                                        value={formData.name || ''} 
                                        onChange={handleChange} 
                                        required 
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                        placeholder="Enter item name" 
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label htmlFor="item_type_id" className="block text-sm font-semibold text-gray-700 mb-2">
                                            <div className="flex items-center space-x-1">
                                                <Tag className="w-4 h-4" />
                                                <span>Type *</span>
                                            </div>
                                        </label>
                                        <select 
                                            name="item_type_id" 
                                            id="item_type_id" 
                                            value={formData.item_type_id || ''} 
                                            onChange={handleChange} 
                                            required 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                                        >
                                            <option value="">Select type...</option>
                                            {dropdownData.itemTypes.map((type: any) => (
                                                <option key={type.id} value={type.id}>{type.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="vendor_id" className="block text-sm font-semibold text-gray-700 mb-2">
                                            <div className="flex items-center space-x-1">
                                                <Package className="w-4 h-4" />
                                                <span>Vendor</span>
                                            </div>
                                        </label>
                                        <select 
                                            name="vendor_id" 
                                            id="vendor_id" 
                                            value={formData.vendor_id || ''} 
                                            onChange={handleChange} 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                                        >
                                            <option value="">Select vendor...</option>
                                            {dropdownData.vendors.map((vendor: any) => (
                                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                            ))}
                                            <option value="custom" className="text-green-600 font-medium">+ Add New Vendor</option>
                                        </select>
                                        {formData.vendor_id === 'custom' && (
                                            <div className="mt-3 animate-fade-in">
                                                <input 
                                                    type="text" 
                                                    value={customVendor} 
                                                    onChange={(e) => setCustomVendor(e.target.value)}
                                                    placeholder="Enter new vendor name"
                                                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inventory Details Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center space-x-2 mb-4">
                                <Beaker className="w-5 h-5 text-green-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Inventory Details</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="location_id" className="block text-sm font-semibold text-gray-700 mb-2">
                                        <div className="flex items-center space-x-1">
                                            <MapPin className="w-4 h-4" />
                                            <span>Location</span>
                                        </div>
                                    </label>
                                    <select 
                                        name="location_id" 
                                        id="location_id" 
                                        value={formData.location_id || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                                    >
                                        <option value="">Select location...</option>
                                        {dropdownData.locations.map((loc: any) => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Quantity
                                        </label>
                                        <input 
                                            type="number" 
                                            name="quantity" 
                                            id="quantity" 
                                            value={formData.quantity || ''} 
                                            onChange={handleChange} 
                                            step="0.01" 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                            placeholder="1.00" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="unit" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Unit
                                        </label>
                                        <input 
                                            type="text" 
                                            name="unit" 
                                            id="unit" 
                                            placeholder="e.g., box, kg, mL" 
                                            value={formData.unit || ''} 
                                            onChange={handleChange} 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-2">
                                            <div className="flex items-center space-x-1">
                                                <DollarSign className="w-4 h-4" />
                                                <span>Unit Price</span>
                                            </div>
                                        </label>
                                        <input 
                                            type="number" 
                                            name="price" 
                                            id="price" 
                                            placeholder="0.00" 
                                            value={formData.price || ''} 
                                            onChange={handleChange} 
                                            step="0.01" 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="catalog_number" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Catalog Number
                                        </label>
                                        <input 
                                            type="text" 
                                            name="catalog_number" 
                                            id="catalog_number" 
                                            placeholder="e.g., C1234" 
                                            value={formData.catalog_number || ''} 
                                            onChange={handleChange} 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dates Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center space-x-2 mb-4">
                                <Calendar className="w-5 h-5 text-green-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Dates & Storage</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label htmlFor="expiration_date" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Expiration Date
                                    </label>
                                    <input 
                                        type="date" 
                                        name="expiration_date" 
                                        id="expiration_date" 
                                        value={formData.expiration_date || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="received_date" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Received Date
                                    </label>
                                    <input 
                                        type="date" 
                                        name="received_date" 
                                        id="received_date" 
                                        value={formData.received_date || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mx-4 sm:mx-6 mb-4 animate-fade-in">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="text-red-900 font-semibold">Error</h4>
                                        <p className="text-red-700 text-sm mt-1">{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer - Sticky */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 pb-20 sm:pb-4 border-t border-gray-200 rounded-b-2xl sticky bottom-0 z-10">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                * Required fields
                            </p>
                            <div className="flex space-x-3">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting} 
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center"
                                >
                                    {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>}
                                    <Save className="w-4 h-4 mr-2" />
                                    {isEditMode ? 'Update Item' : 'Save Item'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MobileItemFormModal;