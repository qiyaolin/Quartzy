import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import PrintBarcodeModal from '../components/PrintBarcodeModal';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const MarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const [locationId, setLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(request?.quantity || 1);
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showBarcodeSection, setShowBarcodeSection] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    useEffect(() => {
        if (isOpen) {
            const fetchLocations = async () => {
                const response = await fetch(buildApiUrl(API_ENDPOINTS.LOCATIONS), { 
                    headers: { 'Authorization': `Token ${token}` } 
                });
                const data = await response.json();
                setLocations(data);
            };
            fetchLocations();
            setQuantityReceived(request?.quantity || 1);
            setShowBarcodeSection(false);
        }
    }, [isOpen, request, token]);

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        setIsSubmitting(true);
        try {
            await onSave(request.id, { 
                location_id: parseInt(locationId), 
                quantity_received: parseInt(quantityReceived) 
            });
            // Show barcode section after successful save
            setShowBarcodeSection(true);
        } catch (error) {
            // Error is already handled by parent component
            console.error('Form submission failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Mark as Received</h2>
                        <p className="mt-2 text-gray-600">
                            Receiving: <strong>{request?.item_name}</strong>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {!showBarcodeSection ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="quantityReceived" className="block text-sm font-medium text-gray-700">
                                    Quantity Received *
                                </label>
                                <input 
                                    type="number" 
                                    id="quantityReceived" 
                                    value={quantityReceived} 
                                    onChange={(e) => setQuantityReceived(e.target.value)} 
                                    required 
                                    max={request?.quantity} 
                                    min="1" 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" 
                                />
                            </div>

                            <div>
                                <label htmlFor="locationId" className="block text-sm font-medium text-gray-700">
                                    Storage Location *
                                </label>
                                <select 
                                    id="locationId" 
                                    value={locationId} 
                                    onChange={(e) => setLocationId(e.target.value)} 
                                    required 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                >
                                    <option value="">Select a location...</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end space-x-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="btn btn-secondary"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting} 
                                    className="btn btn-primary"
                                >
                                    {isSubmitting ? 'Saving...' : 'Confirm & Update Inventory'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-green-800 mb-2">
                                    ✓ Item Successfully Received
                                </h3>
                                <p className="text-green-700">
                                    <strong>{request?.item_name}</strong> has been marked as received and added to inventory.
                                </p>
                            </div>

                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Print Barcode Label
                                    </h3>
                                    <Printer className="w-5 h-5 text-gray-500" />
                                </div>
                                
                                {request?.barcode ? (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <div className="text-center mb-4">
                                            <div className="text-sm text-gray-600 mb-2">
                                                <p><strong>Item:</strong> {request.item_name}</p>
                                                <p><strong>Barcode:</strong> {request.barcode}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <button
                                                onClick={() => setShowPrintModal(true)}
                                                className="btn btn-primary btn-sm flex items-center space-x-2"
                                            >
                                                <Printer className="w-4 h-4" />
                                                <span>Print Label</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <p className="text-gray-500">No barcode available for this item</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <button 
                                    onClick={onClose} 
                                    className="btn btn-primary"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Centralized Print Modal */}
            {request?.barcode && (
                <PrintBarcodeModal
                    isOpen={showPrintModal}
                    onClose={() => setShowPrintModal(false)}
                    itemName={request.item_name}
                    barcode={request.barcode}
                    itemId={request.id}
                    allowTextEdit={true}
                    priority="normal"
                />
            )}
        </div>
    );
};

export default MarkReceivedModal;
