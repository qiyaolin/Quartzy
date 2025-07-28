import React, { useState, useEffect } from 'react';
import { X, Send, Package, DollarSign, Link, FileText, AlertCircle } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

interface MobileRequestFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    token: string;
}

const MobileRequestFormModal = ({ isOpen, onClose, onSave, token }: MobileRequestFormModalProps) => {
    const [formData, setFormData] = useState({ 
        item_name: '', 
        item_type_id: '', 
        vendor_id: '', 
        catalog_number: '', 
        quantity: 1, 
        unit_size: '', 
        unit_price: '', 
        url: '', 
        notes: '' 
    });
    const [dropdownData, setDropdownData] = useState<any>({ vendors: [], itemTypes: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const fetchDropdownData = async () => {
                try {
                    const headers = { 'Authorization': `Token ${token}` };
                    const [vendorsRes, itemTypesRes] = await Promise.all([
                        fetch(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
                        fetch(buildApiUrl(API_ENDPOINTS.ITEM_TYPES), { headers }),
                    ]);
                    const vendors = await vendorsRes.json();
                    const itemTypes = await itemTypesRes.json();
                    setDropdownData({ vendors, itemTypes });
                } catch (e) {
                    setError('Could not load form data.');
                }
            };
            fetchDropdownData();
        }
    }, [isOpen, token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS), {
                method: 'POST',
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

            onSave();
            onClose();
            // Reset form
            setFormData({ 
                item_name: '', 
                item_type_id: '', 
                vendor_id: '', 
                catalog_number: '', 
                quantity: 1, 
                unit_size: '', 
                unit_price: '', 
                url: '', 
                notes: '' 
            });
        } catch (e: any) {
            setError(`Submission failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-lg shadow-xl max-h-[100dvh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))' }}>
                {/* Enhanced Header */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-100 px-4 sm:px-6 py-5 border-b border-blue-200 rounded-t-2xl sticky top-0 z-10" style={{ 
                    paddingTop: 'max(20px, calc(env(safe-area-inset-top, 0px) + 20px))' 
                }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center">
                                <Send className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                                    New Request
                                </h2>
                                <p className="text-sm text-blue-700">
                                    Submit a request for new inventory items
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-2.5 rounded-xl hover:bg-blue-200 transition-all duration-200 group hover:scale-105"
                        >
                            <X className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    {/* Form Content - Scrollable */}
                    <div className="px-4 sm:px-6 py-4 space-y-6 overflow-y-auto flex-1 mobile-scroll" style={{ 
                        maxHeight: 'calc(100dvh - 180px)', 
                        minHeight: '300px',
                        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))'
                    }}>
                        {/* Basic Information Section */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2 mb-4">
                                <Package className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Item Information</h3>
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
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
                                        placeholder="Enter item name" 
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="item_type_id" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Item Type
                                        </label>
                                        <select 
                                            name="item_type_id" 
                                            id="item_type_id" 
                                            value={formData.item_type_id} 
                                            onChange={handleChange} 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                                        >
                                            <option value="">Select type...</option>
                                            {dropdownData.itemTypes.map((type: any) => (
                                                <option key={type.id} value={type.id}>{type.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="vendor_id" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Preferred Vendor
                                        </label>
                                        <select 
                                            name="vendor_id" 
                                            id="vendor_id" 
                                            value={formData.vendor_id} 
                                            onChange={handleChange} 
                                            className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                                        >
                                            <option value="">Select vendor...</option>
                                            {dropdownData.vendors.map((vendor: any) => (
                                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                            ))}
                                        </select>
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
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
                                        placeholder="e.g., C1234" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quantity and Pricing Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center space-x-2 mb-4">
                                <DollarSign className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Quantity & Pricing</h3>
                            </div>
                            
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
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
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
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
                                        placeholder="e.g., 500mL, 1kg" 
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="unit_price" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Unit Price
                                    </label>
                                    <input 
                                        type="number" 
                                        name="unit_price" 
                                        id="unit_price" 
                                        value={formData.unit_price} 
                                        onChange={handleChange} 
                                        step="0.01" 
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Information Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center space-x-2 mb-4">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                            </div>
                            
                            <div>
                                <label htmlFor="url" className="block text-sm font-semibold text-gray-700 mb-2">
                                    <div className="flex items-center space-x-1">
                                        <Link className="w-4 h-4" />
                                        <span>Product URL</span>
                                    </div>
                                </label>
                                <input 
                                    type="url" 
                                    name="url" 
                                    id="url" 
                                    value={formData.url} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
                                    placeholder="https://..." 
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Notes
                                </label>
                                <textarea 
                                    name="notes" 
                                    id="notes" 
                                    rows={4} 
                                    value={formData.notes} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors resize-none" 
                                    placeholder="Additional notes or specifications..." 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Error Display */}
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

                    {/* Enhanced Footer - Sticky Position */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 border-t border-gray-200 sticky bottom-0 z-10" style={{ 
                        paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' 
                    }}>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                * Required fields
                            </p>
                            <div className="flex space-x-3">
                                    <button 
                                        type="button" 
                                        onClick={onClose} 
                                        className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors min-h-[40px] flex items-center justify-center touch-manipulation text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting} 
                                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center min-h-[40px] min-w-[120px] touch-manipulation text-sm"
                                    >
                                        {isSubmitting && <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2"></div>}
                                        <Send className="w-3 h-3 mr-2" />
                                        Submit Request
                                    </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MobileRequestFormModal;