import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';

const RequestFormModal = ({ isOpen, onClose, onSave, token }) => {
    const [formData, setFormData] = useState({ item_name: '', vendor_id: '', catalog_number: '', quantity: 1, unit_size: '', unit_price: '', url: '', notes: '' });
    const [vendors, setVendors] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const fetchVendors = async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/vendors/', { headers: { 'Authorization': `Token ${token}` } });
                    const data = await response.json();
                    setVendors(data);
                } catch (e) { setError('Could not load vendors.'); }
            };
            fetchVendors();
        }
    }, [isOpen, token]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/requests/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ ...formData, requested_by_id: 1 }) // Use requested_by_id and a default user
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Add New Request</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button></div>
            <form onSubmit={handleSubmit}><div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                <div className="col-span-2"><label htmlFor="item_name" className="block text-sm font-medium text-gray-700">Item Name *</label><input type="text" name="item_name" id="item_name" value={formData.item_name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">Vendor</label><select name="vendor_id" id="vendor_id" value={formData.vendor_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="">Select...</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                <div><label htmlFor="catalog_number" className="block text-sm font-medium text-gray-700">Catalog #</label><input type="text" name="catalog_number" id="catalog_number" value={formData.catalog_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity *</label><input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label htmlFor="unit_size" className="block text-sm font-medium text-gray-700">Unit Size</label><input type="text" name="unit_size" id="unit_size" value={formData.unit_size} onChange={handleChange} placeholder="e.g., 100 uL, 500 g" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div className="col-span-2"><label htmlFor="unit_price" className="block text-sm font-medium text-gray-700">Unit Price *</label><input type="number" name="unit_price" id="unit_price" value={formData.unit_price} onChange={handleChange} required step="0.01" placeholder="0.00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div className="col-span-2"><label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label><input type="url" name="url" id="url" value={formData.url} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div className="col-span-2"><label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
            </div>{error && <div className="px-6 pb-4 text-red-600 text-sm">{error}</div>}<div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center">{isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}Save Request</button></div></form>
        </div></div>
    );
};

export default RequestFormModal;
