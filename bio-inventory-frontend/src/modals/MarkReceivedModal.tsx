import React, { useState, useEffect, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import PrintBarcodeModal from '../components/PrintBarcodeModal.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { printingService } from '../services/printingService.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const MarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
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
    const labelEligibleItems = createdItems.filter((item) => item?.can_scan_consume && item?.barcode);

    useEffect(() => {
        if (!isOpen) return;
        const fetchLocations = async () => {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.LOCATIONS), {
                headers: { 'Authorization': `Token ${token}` }
            });
            const data = await response.json();
            setLocations(data);
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
            if (next.length > bounded) {
                return next.slice(0, bounded);
            }
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
        if (bulkPrintLockRef.current || isBulkPrinting || !labelEligibleItems.length) return;
        bulkPrintLockRef.current = true;
        setIsBulkPrinting(true);
        let successCount = 0;

        try {
            const dedupedItems = [];
            const seenItemIds = new Set();
            for (const item of labelEligibleItems) {
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

    if (!isOpen) return null;
    const qty = Number(quantityReceived) || 0;
    const isFormValid = qty > 0 && qty <= remainingQty && pieceLocations.length === qty && pieceLocations.every(Boolean);

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
                                    onChange={(e) => handleQuantityChange(e.target.value)}
                                    required
                                    max={remainingQty}
                                    min="1"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Remaining to receive: {remainingQty}</p>
                            </div>

                            <div>
                                <label htmlFor="defaultLocationId" className="block text-sm font-medium text-gray-700">
                                    Default Storage Location
                                </label>
                                <div className="mt-1 flex gap-2">
                                    <select
                                        id="defaultLocationId"
                                        value={defaultLocationId}
                                        onChange={(e) => setDefaultLocationId(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
                                        className="btn btn-secondary whitespace-nowrap"
                                    >
                                        Apply to All
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Piece-by-piece Locations *
                                </label>
                                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                                    {Array.from({ length: qty }).map((_, index) => (
                                        <div key={`piece-${index}`} className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-600 w-14">Piece {index + 1}</span>
                                            <select
                                                value={pieceLocations[index] || ''}
                                                onChange={(e) => updatePieceLocation(index, e.target.value)}
                                                required
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
                                    disabled={isSubmitting || !isFormValid}
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
                                    Items Successfully Received
                                </h3>
                                <p className="text-green-700">
                                    <strong>{request?.item_name}</strong> has been received and added to active inventory as {createdItems.length} tracked record(s).
                                </p>
                            </div>

                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Label Handling
                                    </h3>
                                    <Printer className="w-5 h-5 text-gray-500" />
                                </div>

                                {labelEligibleItems.length > 0 ? (
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleBulkPrint}
                                            disabled={isBulkPrinting}
                                            className="btn btn-primary w-full"
                                        >
                                            {isBulkPrinting ? 'Queueing Print Jobs...' : `Print Labels Now (${labelEligibleItems.length})`}
                                        </button>

                                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                                            {createdItems.map((item, index) => (
                                                <div key={item.id || item.barcode || index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                                    <div className="text-sm">
                                                        <p className="font-medium text-gray-900">Piece {index + 1}</p>
                                                        <p className="text-xs text-gray-600">{item.tracking_summary || 'Tracked inventory record'}</p>
                                                        <p className="font-mono text-xs text-gray-600">{item.barcode || 'No physical barcode label'}</p>
                                                        {item.location_name && (
                                                            <p className="text-xs text-gray-500">Location: {item.location_name}</p>
                                                        )}
                                                    </div>
                                                    {item.can_scan_consume && item.barcode ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedPrintItem(item);
                                                                setShowPrintModal(true);
                                                            }}
                                                            className="btn btn-secondary btn-sm flex items-center space-x-1"
                                                        >
                                                            <Printer className="w-3 h-3" />
                                                            <span>Print</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-medium text-gray-400">Inventory only</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <p className="text-gray-500">This receive action created inventory records without physical barcode labels.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap justify-end gap-3">
                                <button
                                    onClick={() => {
                                        onClose();
                                        window.history.pushState(null, '', '/inventory');
                                        window.dispatchEvent(new PopStateEvent('popstate'));
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Go to Inventory
                                </button>
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

            {selectedPrintItem?.barcode && (
                <PrintBarcodeModal
                    isOpen={showPrintModal}
                    onClose={() => {
                        setShowPrintModal(false);
                        setSelectedPrintItem(null);
                    }}
                    itemName={request?.item_name || 'Item'}
                    barcode={selectedPrintItem.barcode}
                    itemId={selectedPrintItem.id}
                    allowTextEdit={true}
                    priority="normal"
                />
            )}
        </div>
    );
};

export default MarkReceivedModal;
