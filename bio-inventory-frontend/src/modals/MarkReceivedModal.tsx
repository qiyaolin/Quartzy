import React, { useState, useEffect } from 'react';
import { Package, MapPin, CheckCircle, Printer } from 'lucide-react';
import BarcodeComponent from '../components/BarcodeComponent.tsx';

const MarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const [locationId, setLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(request?.quantity || 1);
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    useEffect(() => {
        if (isOpen) {
            const fetchLocations = async () => {
                const response = await fetch('http://127.0.0.1:8000/api/locations/', { headers: { 'Authorization': `Token ${token}` } });
                const data = await response.json();
                setLocations(data);
            };
            fetchLocations();
            setQuantityReceived(request?.quantity || 1);
            setShowSuccess(false);
        }
    }, [isOpen, request, token]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/requests/${request.id}/mark_received/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    location_id: locationId, 
                    quantity_received: quantityReceived 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to mark as received.');
            }
            
            setShowSuccess(true);
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setShowSuccess(false);
        setLocationId('');
        setQuantityReceived(request?.quantity || 1);
        onClose();
    };

    if (!isOpen) return null;

    // Show success screen with barcode printing option
    if (showSuccess) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-5 border-b border-green-200 rounded-t-xl">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Item Received Successfully!</h2>
                                <p className="text-sm text-green-700">Your item has been added to inventory</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-6 py-8">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Item Details</h3>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600"><strong>Item:</strong> {request.item_name}</p>
                                <p className="text-sm text-gray-600"><strong>Quantity Received:</strong> {quantityReceived}</p>
                                <p className="text-sm text-gray-600"><strong>Barcode:</strong> {request.barcode}</p>
                            </div>
                        </div>
                        
                        {request.barcode && (
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Print Barcode Label</h3>
                                <BarcodeComponent 
                                    barcodeData={request.barcode}
                                    itemName={request.item_name}
                                    onPrint={() => {
                                        console.log('Barcode printed for request:', request.barcode);
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200 rounded-b-xl">
                        <div className="flex justify-end">
                            <button 
                                onClick={handleClose}
                                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-5 border-b border-primary-200 rounded-t-xl">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Mark as Received</h2>
                                <p className="text-sm text-primary-700">Update inventory with received item</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-6 py-6 space-y-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1"><strong>Item:</strong></p>
                            <p className="font-medium text-gray-900">{request?.item_name}</p>
                            {request?.barcode && (
                                <p className="text-xs text-gray-500 mt-1">Barcode: {request.barcode}</p>
                            )}
                        </div>
                        
                        <div>
                            <label htmlFor="quantityReceived" className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                                <Package className="w-4 h-4" />
                                <span>Quantity Received *</span>
                            </label>
                            <input 
                                type="number" 
                                id="quantityReceived" 
                                value={quantityReceived} 
                                onChange={(e) => setQuantityReceived(e.target.value)} 
                                required 
                                max={request?.quantity} 
                                min="1" 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Maximum: {request?.quantity} (as requested)
                            </p>
                        </div>
                        
                        <div>
                            <label htmlFor="locationId" className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                                <MapPin className="w-4 h-4" />
                                <span>Storage Location *</span>
                            </label>
                            <select 
                                id="locationId" 
                                value={locationId} 
                                onChange={(e) => setLocationId(e.target.value)} 
                                required 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="">Select a location...</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200 rounded-b-xl">
                        <div className="flex justify-end space-x-3">
                            <button 
                                type="button" 
                                onClick={handleClose} 
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting ? 'Processing...' : 'Mark as Received'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MarkReceivedModal;
