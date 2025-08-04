import React, { useState, useEffect } from 'react';
import { Printer, X, CheckCircle } from 'lucide-react';
import PrintBarcodeModal from '../components/PrintBarcodeModal';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const MobileMarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const [locationId, setLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(request?.quantity || 1);
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showBarcodeSection, setShowBarcodeSection] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    
    useEffect(() => {
        if (isOpen && request) {
            // If request status is ORDERED and has barcode, show barcode section directly
            if (request.status === 'ORDERED' && request.barcode) {
                setShowBarcodeSection(true);
            } else {
                const fetchLocations = async () => {
                    try {
                        const response = await fetch(buildApiUrl(API_ENDPOINTS.LOCATIONS), { 
                            headers: { 'Authorization': `Token ${token}` } 
                        });
                        if (response.ok) {
                            const data = await response.json();
                            setLocations(data);
                        }
                    } catch (error) {
                        console.error('Failed to fetch locations:', error);
                    }
                };
                fetchLocations();
                setQuantityReceived(request?.quantity || 1);
                setShowBarcodeSection(false);
                setLocationId('');
            }
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

    const handleClose = () => {
        setShowBarcodeSection(false);
        setLocationId('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-lg shadow-xl max-h-[100dvh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))' }}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-white sticky top-0 z-10" style={{ 
                    paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 16px))' 
                }}>
                    <div className="flex-1">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                            {showBarcodeSection ? 'Print Barcode Label' : 'Mark as Received'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            {showBarcodeSection 
                                ? (request?.status === 'ORDERED' ? 'Item is ready for printing' : 'Item successfully received')
                                : `Receiving: ${request?.item_name || request?.product_name}`}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg ml-2 flex-shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto mobile-scroll pb-8" style={{ 
                    maxHeight: 'calc(100dvh - 180px)', 
                    minHeight: '200px',
                    paddingBottom: 'max(100px, calc(env(safe-area-inset-bottom, 0px) + 80px))'
                }}>
                    {!showBarcodeSection ? (
                        /* Form Section */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="quantityReceived" className="block text-sm font-medium text-gray-700 mb-2">
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
                                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors" 
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: {request?.quantity}
                                </p>
                            </div>

                            <div>
                                <label htmlFor="locationId" className="block text-sm font-medium text-gray-700 mb-2">
                                    Storage Location *
                                </label>
                                <select 
                                    id="locationId" 
                                    value={locationId} 
                                    onChange={(e) => setLocationId(e.target.value)} 
                                    required 
                                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                                >
                                    <option value="">Select a location...</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Item Details */}
                            <div className="bg-gray-50 rounded-lg p-4 mt-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Item Details</h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">Name:</span> {request?.item_name || request?.product_name}</p>
                                    {request?.specifications && (
                                        <p><span className="font-medium">Specs:</span> {request.specifications}</p>
                                    )}
                                    <p><span className="font-medium">Requested Qty:</span> {request?.quantity}</p>
                                    {request?.unit_price && (
                                        <p><span className="font-medium">Unit Price:</span> ${request.unit_price}</p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4" style={{ 
                                paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' 
                            }}>
                                <button 
                                    type="button" 
                                    onClick={handleClose} 
                                    className="w-full sm:w-auto px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting || !locationId} 
                                    className="w-full sm:flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Confirm & Update Inventory
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Barcode Section */
                        <div className="space-y-6">
                            {/* Success Message */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-base font-semibold text-green-800 mb-1">
                                            {request?.status === 'ORDERED' ? 'Ready to Print Label' : 'Item Successfully Received'}
                                        </h3>
                                        <p className="text-sm text-green-700">
                                            <strong>{request?.item_name || request?.product_name}</strong> {request?.status === 'ORDERED' ? 'is ready for barcode label printing.' : 'has been marked as received and added to inventory.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Barcode Printing Section */}
                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-semibold text-gray-900">
                                        Print Barcode Label
                                    </h3>
                                    <Printer className="w-5 h-5 text-gray-500" />
                                </div>
                                
                                {request?.barcode ? (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <div className="text-center mb-4">
                                            <div className="text-sm text-gray-600 mb-2">
                                                <p><strong>Item:</strong> {request.item_name || request.product_name}</p>
                                                <p><strong>Barcode:</strong> {request.barcode}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <button
                                                onClick={() => setShowPrintModal(true)}
                                                className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                                            >
                                                <Printer className="w-4 h-4 mr-2" />
                                                Print Label
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <p className="text-sm text-yellow-800">
                                            No barcode available for this item. The item has been successfully received and added to inventory.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Done Button */}
                            <div className="flex justify-end pt-4" style={{ 
                                paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' 
                            }}>
                                <button 
                                    onClick={handleClose} 
                                    className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
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
                    itemName={request.item_name || request.product_name}
                    barcode={request.barcode}
                    itemId={request.id}
                    allowTextEdit={true}
                    priority="normal"
                />
            )}
        </div>
    );
};

export default MobileMarkReceivedModal;