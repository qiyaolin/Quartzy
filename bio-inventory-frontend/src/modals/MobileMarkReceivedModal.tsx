import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, CheckCircle } from 'lucide-react';
import PrintBarcodeModal from '../components/PrintBarcodeModal.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { printingService } from '../services/printingService.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const MobileMarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const notification = useNotification();
    const [defaultLocationId, setDefaultLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(1);
    const [pieceLocations, setPieceLocations] = useState([]);
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showBarcodeSection, setShowBarcodeSection] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedPrintItem, setSelectedPrintItem] = useState(null);
    const [createdItems, setCreatedItems] = useState([]);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);
    const bulkPrintLockRef = useRef(false);

    const remainingQty = Number(request?.remaining_quantity ?? request?.quantity ?? 1);

    useEffect(() => {
        if (!isOpen) return;
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
        setQuantityReceived(remainingQty);
        setPieceLocations(Array(remainingQty).fill(''));
        setDefaultLocationId('');
        setShowBarcodeSection(false);
        setCreatedItems([]);
        setSelectedPrintItem(null);
        bulkPrintLockRef.current = false;
    }, [isOpen, token, remainingQty]);

    const applyDefaultLocationToAll = () => {
        if (!defaultLocationId) return;
        setPieceLocations(Array(quantityReceived).fill(defaultLocationId));
    };

    const handleQuantityChange = (value) => {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed)) {
            setQuantityReceived('');
            setPieceLocations([]);
            return;
        }
        const bounded = Math.max(1, Math.min(parsed, remainingQty));
        setQuantityReceived(bounded);
        setPieceLocations((prev) => {
            const next = [...prev];
            if (next.length > bounded) return next.slice(0, bounded);
            while (next.length < bounded) {
                next.push(defaultLocationId || '');
            }
            return next;
        });
    };

    const updatePieceLocation = (index, locationId) => {
        setPieceLocations((prev) => {
            const next = [...prev];
            next[index] = locationId;
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const qty = Number(quantityReceived);
            const receipts = pieceLocations.slice(0, qty).map((locationId) => ({
                location_id: parseInt(locationId, 10),
            }));

            if (!receipts.length || receipts.some((entry) => Number.isNaN(entry.location_id))) {
                throw new Error('Please select a storage location for each piece.');
            }

            const result = await onSave(request.id, { receipts });
            const resultItems = result?.created_items || [];
            if (!resultItems.length && result?.barcode) {
                resultItems.push({
                    id: result?.item_id,
                    barcode: result?.barcode,
                    location_name: '',
                });
            }
            setCreatedItems(resultItems);
            setShowBarcodeSection(true);
        } catch (error) {
            console.error('Form submission failed:', error);
            if (error?.message) {
                notification.error(error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkPrint = async () => {
        if (bulkPrintLockRef.current || isBulkPrinting || !createdItems.length) return;
        bulkPrintLockRef.current = true;
        setIsBulkPrinting(true);
        let successCount = 0;

        try {
            const dedupedItems = [];
            const seenItemIds = new Set();
            for (const item of createdItems) {
                const itemId = item?.id;
                if (itemId !== null && itemId !== undefined) {
                    const itemKey = String(itemId);
                    if (seenItemIds.has(itemKey)) continue;
                    seenItemIds.add(itemKey);
                }
                dedupedItems.push(item);
            }

            for (const item of dedupedItems) {
                if (!item.barcode) continue;
                try {
                    await printingService.printItemLabel(request?.item_name || 'Item', item.barcode, {
                        itemId: item?.id?.toString(),
                        priority: 'normal',
                        customText: request?.item_name || 'Item',
                        printMode: 'tape',
                    });
                    successCount += 1;
                } catch (error) {
                    console.error('Failed to queue print job for barcode:', item.barcode, error);
                }
            }

            if (successCount > 0) {
                notification.success(`Queued ${successCount} print job(s)`);
            } else {
                notification.error('Failed to queue print jobs');
            }
        } finally {
            setIsBulkPrinting(false);
            bulkPrintLockRef.current = false;
        }
    };

    const handleClose = () => {
        setShowBarcodeSection(false);
        setDefaultLocationId('');
        onClose();
    };

    if (!isOpen) return null;
    const qty = Number(quantityReceived) || 0;
    const isFormValid = qty > 0 && qty <= remainingQty && pieceLocations.length === qty && pieceLocations.every(Boolean);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-lg shadow-xl max-h-[100dvh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))' }}>
                <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-white sticky top-0 z-10" style={{ paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 16px))' }}>
                    <div className="flex-1">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                            {showBarcodeSection ? 'Print Barcode Labels' : 'Mark as Received'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            {showBarcodeSection ? 'Items are ready for printing' : `Receiving: ${request?.item_name || request?.product_name}`}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg ml-2 flex-shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto mobile-scroll pb-8" style={{ maxHeight: 'calc(100dvh - 180px)', minHeight: '200px', paddingBottom: 'max(100px, calc(env(safe-area-inset-bottom, 0px) + 80px))' }}>
                    {!showBarcodeSection ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="quantityReceived" className="block text-sm font-medium text-gray-700 mb-2">
                                    Quantity Received *
                                </label>
                                <input
                                    type="number"
                                    id="quantityReceived"
                                    value={quantityReceived}
                                    onChange={(e) => handleQuantityChange(e.target.value)}
                                    required
                                    max={remainingQty}
                                    min="1"
                                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                                />
                                <p className="text-xs text-gray-500 mt-1">Remaining to receive: {remainingQty}</p>
                            </div>

                            <div>
                                <label htmlFor="defaultLocationId" className="block text-sm font-medium text-gray-700 mb-2">
                                    Default Location
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        id="defaultLocationId"
                                        value={defaultLocationId}
                                        onChange={(e) => setDefaultLocationId(e.target.value)}
                                        className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                                    >
                                        <option value="">Select a default location...</option>
                                        {locations.map((loc) => (
                                            <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={applyDefaultLocationToAll}
                                        disabled={!defaultLocationId}
                                        className="px-3 py-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Piece-by-piece Locations *
                                </label>
                                <div className="space-y-2 max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                                    {Array.from({ length: qty }).map((_, index) => (
                                        <div key={`mobile-piece-${index}`} className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-600 w-14">#{index + 1}</span>
                                            <select
                                                value={pieceLocations[index] || ''}
                                                onChange={(e) => updatePieceLocation(index, e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                required
                                            >
                                                <option value="">Select location...</option>
                                                {locations.map((loc) => (
                                                    <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-4" style={{ paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' }}>
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
                                    disabled={isSubmitting || !isFormValid}
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
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-base font-semibold text-green-800 mb-1">
                                            Items Successfully Received
                                        </h3>
                                        <p className="text-sm text-green-700">
                                            <strong>{request?.item_name || request?.product_name}</strong> has been split into {createdItems.length} inventory items.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-semibold text-gray-900">
                                        Print Barcode Labels
                                    </h3>
                                    <Printer className="w-5 h-5 text-gray-500" />
                                </div>

                                {createdItems.length > 0 ? (
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleBulkPrint}
                                            disabled={isBulkPrinting}
                                            className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                                        >
                                            {isBulkPrinting ? 'Queueing Print Jobs...' : `Print All (${createdItems.length})`}
                                        </button>

                                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                                            {createdItems.map((item, index) => (
                                                <div key={item.id || item.barcode || index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                                    <div className="text-sm">
                                                        <p className="font-medium text-gray-900">Piece {index + 1}</p>
                                                        <p className="font-mono text-xs text-gray-600">{item.barcode}</p>
                                                        {item.location_name && (
                                                            <p className="text-xs text-gray-500">Location: {item.location_name}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPrintItem(item);
                                                            setShowPrintModal(true);
                                                        }}
                                                        className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg"
                                                    >
                                                        Print
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <p className="text-sm text-yellow-800">
                                            No barcode labels available for this receive action.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-4" style={{ paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' }}>
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

            {selectedPrintItem?.barcode && (
                <PrintBarcodeModal
                    isOpen={showPrintModal}
                    onClose={() => {
                        setShowPrintModal(false);
                        setSelectedPrintItem(null);
                    }}
                    itemName={request?.item_name || request?.product_name || 'Item'}
                    barcode={selectedPrintItem.barcode}
                    itemId={selectedPrintItem.id}
                    allowTextEdit={true}
                    priority="normal"
                />
            )}
        </div>
    );
};

export default MobileMarkReceivedModal;
