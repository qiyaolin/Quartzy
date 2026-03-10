import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Plus, Printer, X } from 'lucide-react';

import PrintBarcodeModal from '../components/PrintBarcodeModal.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';
import { printingService } from '../services/printingService.ts';

const TRACKING_MODE = {
    INSTANCE_TRACKED: 'instance_tracked',
    PACK_MANAGED: 'pack_managed',
};

const buildDefaultMetadata = () => ({
    lot_number: '',
    received_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    storage_temperature: '',
    storage_conditions: '',
    low_stock_threshold: '',
    open_unit_count: '0',
});

const buildAllocationRow = (quantity = '') => ({
    location_id: '',
    quantity,
    note: '',
});

const formatLocationLabel = (location) => location?.full_path || location?.name || `Location #${location?.id}`;

const MarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const notification = useNotification();
    const [defaultLocationId, setDefaultLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(1);
    const [pieceLocations, setPieceLocations] = useState([]);
    const [allocationRows, setAllocationRows] = useState([buildAllocationRow()]);
    const [receiveMetadata, setReceiveMetadata] = useState(buildDefaultMetadata());
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showResultSection, setShowResultSection] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedPrintItem, setSelectedPrintItem] = useState(null);
    const [createdItems, setCreatedItems] = useState([]);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);
    const bulkPrintLockRef = useRef(false);

    const remainingQty = Number(request?.remaining_quantity ?? request?.quantity ?? 1);
    const trackingMode = request?.item_type?.tracking_mode || TRACKING_MODE.INSTANCE_TRACKED;
    const isPackManaged = trackingMode === TRACKING_MODE.PACK_MANAGED;
    const labelEligibleItems = createdItems.filter((item) => item?.can_scan_consume && item?.barcode);

    useEffect(() => {
        if (!isOpen) return;
        const fetchLocations = async () => {
            try {
                const response = await fetch(buildApiUrl(`${API_ENDPOINTS.LOCATIONS}?leaf_only=true`), {
                    headers: { Authorization: `Token ${token}` },
                });
                if (!response.ok) throw new Error('Failed to load locations');
                const data = await response.json();
                setLocations(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to fetch locations:', error);
                notification.error('Failed to load storage locations.');
            }
        };

        fetchLocations();
        setQuantityReceived(remainingQty);
        setPieceLocations(Array(remainingQty).fill(''));
        setDefaultLocationId('');
        setAllocationRows([buildAllocationRow(String(remainingQty || 1))]);
        setReceiveMetadata(buildDefaultMetadata());
        setShowResultSection(false);
        setCreatedItems([]);
        setSelectedPrintItem(null);
        bulkPrintLockRef.current = false;
    }, [isOpen, token, remainingQty, notification]);

    const totalPackQuantity = useMemo(
        () => allocationRows.reduce((sum, row) => sum + (parseInt(row.quantity, 10) || 0), 0),
        [allocationRows],
    );

    const applyDefaultLocationToAll = () => {
        if (!defaultLocationId) return;
        setPieceLocations(Array(Number(quantityReceived) || 0).fill(defaultLocationId));
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
            while (next.length < bounded) next.push(defaultLocationId || '');
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

    const updateMetadata = (field, value) => setReceiveMetadata((prev) => ({ ...prev, [field]: value }));
    const updateAllocationRow = (index, field, value) => {
        setAllocationRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
    };
    const addAllocationRow = () => setAllocationRows((prev) => [...prev, buildAllocationRow()]);
    const removeAllocationRow = (index) => setAllocationRows((prev) => (prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)));

    const buildReceivePayload = () => {
        const metadata = {
            lot_number: receiveMetadata.lot_number.trim(),
            received_date: receiveMetadata.received_date || null,
            expiration_date: receiveMetadata.expiration_date || null,
            storage_temperature: receiveMetadata.storage_temperature.trim(),
            storage_conditions: receiveMetadata.storage_conditions.trim(),
            low_stock_threshold: receiveMetadata.low_stock_threshold === '' ? null : parseInt(receiveMetadata.low_stock_threshold, 10),
            open_unit_count: receiveMetadata.open_unit_count === '' ? null : parseInt(receiveMetadata.open_unit_count, 10),
        };

        if (Number.isNaN(metadata.low_stock_threshold)) throw new Error('Low stock threshold must be a whole number.');
        if (Number.isNaN(metadata.open_unit_count)) throw new Error('Open unit count must be a whole number.');

        if (!isPackManaged) {
            const qty = Number(quantityReceived);
            const receipts = pieceLocations.slice(0, qty).map((locationId) => ({
                location_id: parseInt(locationId, 10),
                quantity: 1,
                note: '',
            }));
            if (!receipts.length || receipts.some((entry) => Number.isNaN(entry.location_id))) {
                throw new Error('Please select a storage location for each piece.');
            }
            return { receipts, receive_metadata: metadata };
        }

        const receipts = allocationRows
            .map((row) => ({
                location_id: parseInt(row.location_id, 10),
                quantity: parseInt(row.quantity, 10),
                note: row.note.trim(),
            }))
            .filter((row) => row.location_id || row.quantity || row.note);
        if (!receipts.length) throw new Error('Add at least one allocation row for pack-managed inventory.');
        if (receipts.some((entry) => Number.isNaN(entry.location_id) || Number.isNaN(entry.quantity) || entry.quantity <= 0)) {
            throw new Error('Each allocation row requires a valid leaf location and quantity.');
        }
        const totalQuantity = receipts.reduce((sum, entry) => sum + entry.quantity, 0);
        if (totalQuantity > remainingQty) {
            throw new Error(`Received quantity cannot exceed remaining ordered quantity (${remainingQty}).`);
        }
        return { receipts, receive_metadata: metadata };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        try {
            const result = await onSave(request.id, buildReceivePayload());
            const resultItems = result?.created_items || [];
            if (!resultItems.length && result?.barcode) {
                resultItems.push({ id: result?.item_id, barcode: result?.barcode, location_name: '' });
            }
            setCreatedItems(resultItems);
            setShowResultSection(true);
        } catch (error) {
            console.error('Form submission failed:', error);
            if (error?.message) notification.error(error.message);
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
            const seenItemIds = new Set();
            for (const item of labelEligibleItems) {
                const itemKey = item?.id != null ? String(item.id) : item.barcode;
                if (seenItemIds.has(itemKey)) continue;
                seenItemIds.add(itemKey);
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
            if (successCount > 0) notification.success(`Queued ${successCount} print job(s)`);
            else notification.error('Failed to queue print jobs');
        } finally {
            setIsBulkPrinting(false);
            bulkPrintLockRef.current = false;
        }
    };

    if (!isOpen) return null;

    const qty = Number(quantityReceived) || 0;
    const isInstanceFormValid = qty > 0 && qty <= remainingQty && pieceLocations.length === qty && pieceLocations.every(Boolean);
    const isPackFormValid = totalPackQuantity > 0 && totalPackQuantity <= remainingQty;
    const isFormValid = isPackManaged ? isPackFormValid : isInstanceFormValid;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Mark as Received</h2>
                        <p className="mt-2 text-gray-600">Receiving: <strong>{request?.item_name}</strong></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {!showResultSection ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Receive Metadata</h3>
                                        <p className="text-sm text-gray-500">Physical handling details from this receive action will be saved onto inventory records.</p>
                                    </div>
                                    <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                        {isPackManaged ? 'Pack-managed' : 'Instance-tracked'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="lot_number" className="block text-sm font-medium text-gray-700">Lot Number</label>
                                        <input id="lot_number" type="text" value={receiveMetadata.lot_number} onChange={(event) => updateMetadata('lot_number', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                    </div>
                                    <div>
                                        <label htmlFor="received_date" className="block text-sm font-medium text-gray-700">Received Date</label>
                                        <input id="received_date" type="date" value={receiveMetadata.received_date} onChange={(event) => updateMetadata('received_date', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                    </div>
                                    <div>
                                        <label htmlFor="expiration_date" className="block text-sm font-medium text-gray-700">Expiration Date</label>
                                        <input id="expiration_date" type="date" value={receiveMetadata.expiration_date} onChange={(event) => updateMetadata('expiration_date', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                    </div>
                                    <div>
                                        <label htmlFor="low_stock_threshold" className="block text-sm font-medium text-gray-700">Low Stock Threshold</label>
                                        <input id="low_stock_threshold" type="number" min="0" value={receiveMetadata.low_stock_threshold} onChange={(event) => updateMetadata('low_stock_threshold', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                    </div>
                                    <div>
                                        <label htmlFor="storage_temperature" className="block text-sm font-medium text-gray-700">Storage Temperature</label>
                                        <input id="storage_temperature" type="text" value={receiveMetadata.storage_temperature} onChange={(event) => updateMetadata('storage_temperature', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="e.g. -20C, 4C, RT" />
                                    </div>
                                    {isPackManaged && (
                                        <div>
                                            <label htmlFor="open_unit_count" className="block text-sm font-medium text-gray-700">Open Unit Count</label>
                                            <input id="open_unit_count" type="number" min="0" value={receiveMetadata.open_unit_count} onChange={(event) => updateMetadata('open_unit_count', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                        </div>
                                    )}
                                    <div className="md:col-span-2">
                                        <label htmlFor="storage_conditions" className="block text-sm font-medium text-gray-700">Storage Conditions</label>
                                        <textarea id="storage_conditions" rows={3} value={receiveMetadata.storage_conditions} onChange={(event) => updateMetadata('storage_conditions', event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                    </div>
                                </div>
                            </section>

                            {!isPackManaged ? (
                                <section className="space-y-4 border-t pt-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Piece-by-Piece Locations</h3>
                                    <div>
                                        <label htmlFor="quantityReceived" className="block text-sm font-medium text-gray-700">Quantity Received *</label>
                                        <input type="number" id="quantityReceived" value={quantityReceived} onChange={(event) => handleQuantityChange(event.target.value)} required max={remainingQty} min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                                        <p className="text-xs text-gray-500 mt-1">Remaining to receive: {remainingQty}</p>
                                    </div>
                                    <div>
                                        <label htmlFor="defaultLocationId" className="block text-sm font-medium text-gray-700">Default Storage Location</label>
                                        <div className="mt-1 flex gap-2">
                                            <select id="defaultLocationId" value={defaultLocationId} onChange={(event) => setDefaultLocationId(event.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                                                <option value="">Select a default location...</option>
                                                {locations.map((location) => (
                                                    <option key={location.id} value={String(location.id)}>{formatLocationLabel(location)}</option>
                                                ))}
                                            </select>
                                            <button type="button" onClick={applyDefaultLocationToAll} disabled={!defaultLocationId} className="btn btn-secondary whitespace-nowrap">Apply to All</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Piece-by-piece Locations *</label>
                                        <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                                            {Array.from({ length: qty }).map((_, index) => (
                                                <div key={`piece-${index}`} className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-gray-600 w-14">Piece {index + 1}</span>
                                                    <select value={pieceLocations[index] || ''} onChange={(event) => updatePieceLocation(index, event.target.value)} required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                                                        <option value="">Select location...</option>
                                                        {locations.map((location) => (
                                                            <option key={location.id} value={String(location.id)}>{formatLocationLabel(location)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            ) : (
                                <section className="space-y-4 border-t pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">Location Allocations</h3>
                                            <p className="text-sm text-gray-500">Distribute received packs across exact leaf slots.</p>
                                        </div>
                                        <button type="button" onClick={addAllocationRow} className="btn btn-secondary btn-sm">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Row
                                        </button>
                                    </div>
                                    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                                        {allocationRows.map((row, index) => (
                                            <div key={`allocation-${index}`} className="grid grid-cols-12 gap-3 items-start">
                                                <div className="col-span-5">
                                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Location</label>
                                                    <select value={row.location_id} onChange={(event) => updateAllocationRow(index, 'location_id', event.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" required>
                                                        <option value="">Select location...</option>
                                                        {locations.map((location) => (
                                                            <option key={location.id} value={String(location.id)}>{formatLocationLabel(location)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Qty</label>
                                                    <input type="number" min="1" value={row.quantity} onChange={(event) => updateAllocationRow(index, 'quantity', event.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" required />
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Note</label>
                                                    <input type="text" value={row.note} onChange={(event) => updateAllocationRow(index, 'note', event.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="Optional note" />
                                                </div>
                                                <div className="col-span-1 flex justify-end pt-6">
                                                    <button type="button" onClick={() => removeAllocationRow(index)} className="rounded-md px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-200">×</button>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm">
                                            <span className="text-gray-600">Receiving this batch: <strong>{totalPackQuantity}</strong></span>
                                            <span className={totalPackQuantity > remainingQty ? 'text-red-600 font-semibold' : 'text-gray-600'}>Remaining ordered: {remainingQty}</span>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <div className="flex justify-end space-x-4 pt-4">
                                <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" disabled={isSubmitting || !isFormValid} className="btn btn-primary">{isSubmitting ? 'Saving...' : 'Confirm & Update Inventory'}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-green-800 mb-2">Items Successfully Received</h3>
                                <p className="text-green-700"><strong>{request?.item_name}</strong> has been received and added to active inventory as {createdItems.length} inventory record(s).</p>
                            </div>
                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Label Handling</h3>
                                    <Printer className="w-5 h-5 text-gray-500" />
                                </div>
                                {labelEligibleItems.length > 0 ? (
                                    <div className="space-y-3">
                                        <button type="button" onClick={handleBulkPrint} disabled={isBulkPrinting} className="btn btn-primary w-full">{isBulkPrinting ? 'Queueing Print Jobs...' : `Print Labels Now (${labelEligibleItems.length})`}</button>
                                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                                            {createdItems.map((item, index) => (
                                                <div key={item.id || item.barcode || index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                                    <div className="text-sm">
                                                        <p className="font-medium text-gray-900 flex items-center"><Package className="w-4 h-4 mr-2 text-gray-500" />Record {index + 1}</p>
                                                        <p className="text-xs text-gray-600">{item.tracking_summary || 'Tracked inventory record'}</p>
                                                        <p className="text-xs text-gray-600">Qty: {item.quantity || 1}</p>
                                                        <p className="font-mono text-xs text-gray-600">{item.barcode || 'No physical barcode label'}</p>
                                                        {item.location_name && <p className="text-xs text-gray-500">Location: {item.location_name}</p>}
                                                    </div>
                                                    {item.can_scan_consume && item.barcode ? (
                                                        <button type="button" onClick={() => { setSelectedPrintItem(item); setShowPrintModal(true); }} className="btn btn-secondary btn-sm flex items-center space-x-1">
                                                            <Printer className="w-3 h-3" />
                                                            <span>Print</span>
                                                        </button>
                                                    ) : <span className="text-xs font-medium text-gray-400">Inventory only</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-gray-500">This receive action created inventory records without physical barcode labels.</p></div>}
                            </div>
                            <div className="flex flex-wrap justify-end gap-3">
                                <button onClick={() => { onClose(); window.history.pushState(null, '', '/inventory'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="btn btn-secondary">Go to Inventory</button>
                                <button onClick={onClose} className="btn btn-primary">Done</button>
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
