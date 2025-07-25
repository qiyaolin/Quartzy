import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, User, Tag, Save, AlertCircle, ShoppingCart } from 'lucide-react';

const RequestFormModal = ({ isOpen, onClose, onSave, token }) => {
    const [formData, setFormData] = useState({ item_name: '', item_type_id: '', financial_type: 'Supplies', vendor_id: '', catalog_number: '', quantity: 1, unit_size: '', unit_price: '', url: '', notes: '' });
    const [dropdownData, setDropdownData] = useState({ vendors: [], itemTypes: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [customVendor, setCustomVendor] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchDropdownData = async () => {
                try {
                    const headers = { 'Authorization': `Token ${token}` };
                    const [vendorsRes, itemTypesRes] = await Promise.all([
                        fetch('http://127.0.0.1:8000/api/vendors/', { headers }),
                        fetch('http://127.0.0.1:8000/api/item-types/', { headers })
                    ]);
                    const vendors = await vendorsRes.json();
                    const itemTypes = await itemTypesRes.json();
                    setDropdownData({ vendors, itemTypes });
                } catch (e) { setError('Could not load form data.'); }
            };
            fetchDropdownData();
        }
    }, [isOpen, token]);

    const handleChange = (e) => { 
        const { name, value } = e.target; 
        setFormData(prev => ({ ...prev, [name]: value })); 
        if (name === 'vendor_id' && value !== 'other') {
            setCustomVendor('');
        }
    };
    
    const createVendor = async (vendorName) => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/vendors/', {
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
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        
        let finalFormData = { ...formData };
        
        // Handle custom vendor creation
        if (formData.vendor_id === 'other' && customVendor.trim()) {
            try {
                const newVendorId = await createVendor(customVendor.trim());
                finalFormData.vendor_id = newVendorId;
            } catch (error) {
                setError('Failed to create new vendor');
                setIsSubmitting(false);
                return;
            }
        }
        
        try {
            const response = await fetch('http://127.0.0.1:8000/api/requests/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify(finalFormData)
            });
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(JSON.stringify(errorData)); 
            }
            onSave(); onClose();
        } catch (e) { setError(`Submission failed: ${e.message}`); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="modal-backdrop animate-fade-in">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="modal-panel modal-panel-large animate-scale-in">
                    {/* Enhanced Header */}
                    <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-5 border-b border-primary-200 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center">
                                    <ShoppingCart className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">Add New Request</h2>
                                    <p className="text-sm text-primary-700">Submit a new item request for approval</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="p-2.5 rounded-xl hover:bg-primary-200 transition-all duration-200 group hover:scale-105"
                            >
                                <X className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                            </button>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Form Content */}
                        <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
                            {/* Basic Information Section */}
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2 mb-4">
                                    <Package className="w-5 h-5 text-primary-600" />
                                    <h3 className="text-lg font-semibold text-gray-900">Request Details</h3>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="item_name" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Item Name *
                                        </label>
                                        <input 
                                            type="text" 
                                            name="item_name" 
                                            id="item_name" 
                                            value={formData.item_name} 
                                            onChange={handleChange} 
                                            required 
                                            className="input focus:ring-primary-500 focus:border-primary-500" 
                                            placeholder="Enter requested item name" 
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label htmlFor="item_type_id" className="block text-sm font-semibold text-gray-700 mb-2">
                                                <div className="flex items-center space-x-1">
                                                    <Tag className="w-4 h-4" />
                                                    <span>Item Type</span>
                                                </div>
                                            </label>
                                            <select 
                                                name="item_type_id" 
                                                id="item_type_id" 
                                                value={formData.item_type_id} 
                                                onChange={handleChange} 
                                                className="select focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="">Select type...</option>
                                                {dropdownData.itemTypes.map(type => (
                                                    <option key={type.id} value={type.id}>{type.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label htmlFor="financial_type" className="block text-sm font-semibold text-gray-700 mb-2">
                                                <div className="flex items-center space-x-1">
                                                    <DollarSign className="w-4 h-4" />
                                                    <span>Financial Type *</span>
                                                </div>
                                            </label>
                                            <select 
                                                name="financial_type" 
                                                id="financial_type" 
                                                value={formData.financial_type} 
                                                onChange={handleChange} 
                                                required 
                                                className="select focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="Equipment">Equipment</option>
                                                <option value="Supplies">Supplies</option>
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
                                                value={formData.vendor_id} 
                                                onChange={handleChange} 
                                                className="select focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="">Select vendor...</option>
                                                {dropdownData.vendors.map(vendor => (
                                                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                                ))}
                                                <option value="other" className="text-primary-600 font-medium">+ Other (Manual Entry)</option>
                                            </select>
                                            {formData.vendor_id === 'other' && (
                                                <div className="mt-3 animate-fade-in">
                                                    <input 
                                                        type="text" 
                                                        value={customVendor} 
                                                        onChange={(e) => setCustomVendor(e.target.value)}
                                                        placeholder="Enter vendor name"
                                                        className="input focus:ring-primary-500 focus:border-primary-500"
                                                        required
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Details Section */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center space-x-2 mb-4">
                                    <DollarSign className="w-5 h-5 text-primary-600" />
                                    <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-2">
                                                Quantity *
                                            </label>
                                            <input 
                                                type="number" 
                                                name="quantity" 
                                                id="quantity" 
                                                value={formData.quantity} 
                                                onChange={handleChange} 
                                                required 
                                                min="1" 
                                                className="input focus:ring-primary-500 focus:border-primary-500" 
                                                placeholder="1" 
                                            />
                                        </div>
                                        
                                        <div>
                                            <label htmlFor="unit_size" className="block text-sm font-semibold text-gray-700 mb-2">
                                                Unit Size
                                            </label>
                                            <input 
                                                type="text" 
                                                name="unit_size" 
                                                id="unit_size" 
                                                value={formData.unit_size} 
                                                onChange={handleChange} 
                                                placeholder="e.g., 100 μL, 500 g" 
                                                className="input focus:ring-primary-500 focus:border-primary-500" 
                                            />
                                        </div>
                                        
                                        <div>
                                            <label htmlFor="unit_price" className="block text-sm font-semibold text-gray-700 mb-2">
                                                Unit Price *
                                            </label>
                                            <input 
                                                type="number" 
                                                name="unit_price" 
                                                id="unit_price" 
                                                value={formData.unit_price} 
                                                onChange={handleChange} 
                                                required 
                                                step="0.01" 
                                                placeholder="0.00" 
                                                className="input focus:ring-primary-500 focus:border-primary-500" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="catalog_number" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Catalog Number
                                        </label>
                                        <input 
                                            type="text" 
                                            name="catalog_number" 
                                            id="catalog_number" 
                                            value={formData.catalog_number} 
                                            onChange={handleChange} 
                                            placeholder="e.g., C1234" 
                                            className="input focus:ring-primary-500 focus:border-primary-500" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="url" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Product URL
                                        </label>
                                        <input 
                                            type="url" 
                                            name="url" 
                                            id="url" 
                                            value={formData.url} 
                                            onChange={handleChange} 
                                            placeholder="https://..." 
                                            className="input focus:ring-primary-500 focus:border-primary-500" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Additional Notes
                                        </label>
                                        <textarea 
                                            name="notes" 
                                            id="notes" 
                                            value={formData.notes} 
                                            onChange={handleChange} 
                                            rows={3} 
                                            placeholder="Any additional requirements or specifications..." 
                                            className="input resize-none focus:ring-primary-500 focus:border-primary-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Error Display */}
                        {error && (
                            <div className="mx-6 mb-4 animate-fade-in">
                                <div className="bg-danger-50 border border-danger-200 rounded-xl p-4">
                                    <div className="flex items-start space-x-3">
                                        <AlertCircle className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="text-danger-900 font-semibold">Error</h4>
                                            <p className="text-danger-700 text-sm mt-1">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Enhanced Footer */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200 rounded-b-2xl">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    * Required fields
                                </p>
                                <div className="flex space-x-3">
                                    <button 
                                        type="button" 
                                        onClick={onClose} 
                                        className="btn btn-secondary hover:scale-105 transition-transform"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting} 
                                        className="btn btn-primary hover:scale-105 transition-transform disabled:hover:scale-100"
                                    >
                                        {isSubmitting && <div className="loading-spinner w-4 h-4 mr-2"></div>}
                                        <Save className="w-4 h-4 mr-2" />
                                        Submit Request
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

export default RequestFormModal;
