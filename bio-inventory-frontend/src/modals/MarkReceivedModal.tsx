import React, { useState, useEffect } from 'react';

const MarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const [locationId, setLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(request?.quantity || 1);
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        if (isOpen) {
            const fetchLocations = async () => {
                const response = await fetch('http://127.0.0.1:8000/api/locations/', { headers: { 'Authorization': `Token ${token}` } });
                const data = await response.json();
                setLocations(data);
            };
            fetchLocations();
            setQuantityReceived(request?.quantity || 1);
        }
    }, [isOpen, request, token]);
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true);
        await onSave(request.id, { location_id: locationId, quantity_received: quantityReceived });
        setIsSubmitting(false);
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <form onSubmit={handleSubmit}>
                <div className="p-6"><h2 className="text-xl font-bold text-gray-800">Mark as Received</h2><p className="mt-2 text-gray-600">Receiving: <strong>{request.item_name}</strong></p></div>
                <div className="p-6 space-y-4">
                    <div><label htmlFor="quantityReceived" className="block text-sm font-medium text-gray-700">Quantity Received *</label><input type="number" id="quantityReceived" value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} required max={request.quantity} min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                    <div><label htmlFor="locationId" className="block text-sm font-medium text-gray-700">Storage Location *</label><select id="locationId" value={locationId} onChange={(e) => setLocationId(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="">Select a location...</option>{locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></div>
                </div>
                <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">{isSubmitting ? 'Saving...' : 'Confirm & Update Inventory'}</button></div>
            </form>
        </div></div>
    );
};

export default MarkReceivedModal;
