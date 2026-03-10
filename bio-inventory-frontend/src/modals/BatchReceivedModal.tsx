import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Package, Plus, X } from 'lucide-react';

import { useNotification } from '../contexts/NotificationContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const TRACKING_MODE = {
    INSTANCE_TRACKED: 'instance_tracked',
    PACK_MANAGED: 'pack_managed',
};

const buildMetadata = () => ({
    lot_number: '',
    received_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    storage_temperature: '',
    storage_conditions: '',
    low_stock_threshold: '',
    open_unit_count: '0',
});

const buildAllocationRow = (quantity = '') => ({ location_id: '', quantity, note: '' });
const formatLocationLabel = (location) => location?.full_path || location?.name || `Location #${location?.id}`;
const getRemainingQty = (request) => Number(request?.remaining_quantity ?? request?.quantity ?? 0);
const isPackManaged = (request) => (request?.item_type?.tracking_mode || TRACKING_MODE.INSTANCE_TRACKED) === TRACKING_MODE.PACK_MANAGED;

const BatchReceivedModal = ({ isOpen, onClose, onSave, token, selectedRequests }) => {
    const notification = useNotification();
    const [locations, setLocations] = useState([]);
    const [defaultLocationId, setDefaultLocationId] = useState('');
    const [pieceAssignments, setPieceAssignments] = useState({});
    const [allocationAssignments, setAllocationAssignments] = useState({});
    const [metadataByRequest, setMetadataByRequest] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !token) return;

        const fetchLocations = async () => {
            try {
                const response = await fetch(buildApiUrl(`${API_ENDPOINTS.LOCATIONS}?leaf_only=true`), {
                    headers: { Authorization: `Token ${token}` },
                });
                if (!response.ok) throw new Error('Failed to fetch locations');
                const data = await response.json();
                setLocations(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to fetch locations:', error);
                notification.error('Failed to load storage locations.');
            }
        };

        fetchLocations();
        const nextPieceAssignments = {};
        const nextAllocationAssignments = {};
        const nextMetadata = {};
        selectedRequests.forEach((request) => {
            const remainingQty = getRemainingQty(request);
            nextPieceAssignments[request.id] = Array(remainingQty).fill('');
            nextAllocationAssignments[request.id] = [buildAllocationRow(String(remainingQty || 1))];
            nextMetadata[request.id] = buildMetadata();
        });
        setPieceAssignments(nextPieceAssignments);
        setAllocationAssignments(nextAllocationAssignments);
        setMetadataByRequest(nextMetadata);
        setDefaultLocationId('');
    }, [isOpen, token, selectedRequests, notification]);

    const packTotals = useMemo(() => Object.fromEntries(
        selectedRequests.map((request) => [
            request.id,
            (allocationAssignments[request.id] || []).reduce((sum, row) => sum + (parseInt(row.quantity, 10) || 0), 0),
        ]),
    ), [allocationAssignments, selectedRequests]);

    const applyDefaultToAll = () => {
        if (!defaultLocationId) return;
        const nextAssignments = {};
        selectedRequests.forEach((request) => {
            if (!isPackManaged(request)) {
                nextAssignments[request.id] = Array(getRemainingQty(request)).fill(defaultLocationId);
            }
        });
        setPieceAssignments((prev) => ({ ...prev, ...nextAssignments }));
    };

    const updatePieceLocation = (requestId, index, locationId) => {
        setPieceAssignments((prev) => {
            const next = { ...prev };
            const values = [...(next[requestId] || [])];
            values[index] = locationId;
            next[requestId] = values;
            return next;
        });
    };

    const updateAllocationRow = (requestId, index, field, value) => {
        setAllocationAssignments((prev) => ({
            ...prev,
            [requestId]: (prev[requestId] || []).map((row, rowIndex) => (
                rowIndex === index ? { ...row, [field]: value } : row
            )),
        }));
    };

    const addAllocationRow = (requestId) => {
        setAllocationAssignments((prev) => ({
            ...prev,
            [requestId]: [...(prev[requestId] || []), buildAllocationRow()],
        }));
    };

    const removeAllocationRow = (requestId, index) => {
        setAllocationAssignments((prev) => {
            const rows = prev[requestId] || [];
            return {
                ...prev,
                [requestId]: rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index),
            };
        });
    };

    const updateMetadata = (requestId, field, value) => {
        setMetadataByRequest((prev) => ({
            ...prev,
            [requestId]: { ...(prev[requestId] || buildMetadata()), [field]: value },
        }));
    };

    const buildPayload = () => {
        const receiptsByRequest = selectedRequests.map((request) => {
            const requestMetadata = metadataByRequest[request.id] || buildMetadata();
            const receive_metadata = {
                lot_number: requestMetadata.lot_number.trim(),
                received_date: requestMetadata.received_date || null,
                expiration_date: requestMetadata.expiration_date || null,
                storage_temperature: requestMetadata.storage_temperature.trim(),
                storage_conditions: requestMetadata.storage_conditions.trim(),
                low_stock_threshold: requestMetadata.low_stock_threshold === '' ? null : parseInt(requestMetadata.low_stock_threshold, 10),
                open_unit_count: requestMetadata.open_unit_count === '' ? null : parseInt(requestMetadata.open_unit_count, 10),
            };

            if (Number.isNaN(receive_metadata.low_stock_threshold) || Number.isNaN(receive_metadata.open_unit_count)) {
                throw new Error(`Request #${request.id} has invalid receive metadata.`);
            }

            if (!isPackManaged(request)) {
                const receipts = (pieceAssignments[request.id] || []).map((locationId) => ({
                    location_id: parseInt(locationId, 10),
                    quantity: 1,
                    note: '',
                }));
                if (!receipts.length || receipts.some((receipt) => Number.isNaN(receipt.location_id))) {
                    throw new Error(`Please select storage locations for every piece in request #${request.id}.`);
                }
                return { request_id: request.id, receipts, receive_metadata };
            }

            const receipts = (allocationAssignments[request.id] || [])
                .map((row) => ({
                    location_id: parseInt(row.location_id, 10),
                    quantity: parseInt(row.quantity, 10),
                    note: row.note.trim(),
                }))
                .filter((row) => row.location_id || row.quantity || row.note);
            if (!receipts.length) {
                throw new Error(`Add at least one allocation row for request #${request.id}.`);
            }
            if (receipts.some((receipt) => Number.isNaN(receipt.location_id) || Number.isNaN(receipt.quantity) || receipt.quantity <= 0)) {
                throw new Error(`Each allocation row in request #${request.id} needs a valid location and quantity.`);
            }
            if (receipts.reduce((sum, receipt) => sum + receipt.quantity, 0) > getRemainingQty(request)) {
                throw new Error(`Request #${request.id} exceeds the remaining ordered quantity.`);
            }
            return { request_id: request.id, receipts, receive_metadata };
        });

        return { receipts_by_request: receiptsByRequest };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            await onSave(selectedRequests, buildPayload());
            onClose();
            setDefaultLocationId('');
        } catch (error) {
            console.error('Failed to mark requests as received:', error);
            if (error?.message) notification.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <Package className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Batch Mark Received</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                        You are marking <strong>{selectedRequests.length}</strong> request(s) as received. Instance-tracked requests use piece locations; pack-managed requests use quantity allocations.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Default Storage Location for Instance-Tracked Requests
                        </label>
                        <div className="flex gap-2">
                            <select value={defaultLocationId} onChange={(event) => setDefaultLocationId(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                                <option value="">Select a default location...</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={String(location.id)}>{formatLocationLabel(location)}</option>
                                ))}
                            </select>
                            <button type="button" onClick={applyDefaultToAll} disabled={!defaultLocationId} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50">
                                Apply to All
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                        {selectedRequests.map((request) => {
                            const remainingQty = getRemainingQty(request);
                            const metadata = metadataByRequest[request.id] || buildMetadata();
                            const requestIsPackManaged = isPackManaged(request);
                            const assignments = pieceAssignments[request.id] || [];
                            const allocationRows = allocationAssignments[request.id] || [buildAllocationRow(String(remainingQty || 1))];

                            return (
                                <div key={request.id} className="bg-white border border-gray-200 rounded-md p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-gray-900">{request.item_name}</p>
                                            <p className="text-xs text-gray-600">Request #{request.id} | Remaining: {remainingQty}</p>
                                        </div>
                                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                            {requestIsPackManaged ? 'Pack-managed' : 'Instance-tracked'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input type="text" value={metadata.lot_number} onChange={(event) => updateMetadata(request.id, 'lot_number', event.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" placeholder="Lot number" />
                                        <input type="date" value={metadata.received_date} onChange={(event) => updateMetadata(request.id, 'received_date', event.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" />
                                        <input type="date" value={metadata.expiration_date} onChange={(event) => updateMetadata(request.id, 'expiration_date', event.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" />
                                        <input type="text" value={metadata.storage_temperature} onChange={(event) => updateMetadata(request.id, 'storage_temperature', event.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" placeholder="Storage temperature" />
                                        <input type="number" min="0" value={metadata.low_stock_threshold} onChange={(event) => updateMetadata(request.id, 'low_stock_threshold', event.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" placeholder="Low stock threshold" />
                                        {requestIsPackManaged && (
                                            <input type="number" min="0" value={metadata.open_unit_count} onChange={(event) => updateMetadata(request.id, 'open_unit_count', event.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" placeholder="Open unit count" />
                                        )}
                                        <textarea value={metadata.storage_conditions} onChange={(event) => updateMetadata(request.id, 'storage_conditions', event.target.value)} className="md:col-span-3 px-3 py-2 border border-gray-300 rounded-md" rows={2} placeholder="Storage conditions" />
                                    </div>

                                    {!requestIsPackManaged ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: remainingQty }).map((_, index) => (
                                                <div key={`${request.id}-piece-${index}`} className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-gray-600 w-14">Piece {index + 1}</span>
                                                    <select value={assignments[index] || ''} onChange={(event) => updatePieceLocation(request.id, index, event.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" required>
                                                        <option value="">Select location...</option>
                                                        {locations.map((location) => (
                                                            <option key={location.id} value={String(location.id)}>{formatLocationLabel(location)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-gray-700">Location allocations</p>
                                                <button type="button" onClick={() => addAllocationRow(request.id)} className="inline-flex items-center rounded-md bg-white px-3 py-1 text-sm font-medium text-gray-700 border border-gray-200">
                                                    <Plus className="w-4 h-4 mr-1" />
                                                    Add Row
                                                </button>
                                            </div>
                                            {allocationRows.map((row, index) => (
                                                <div key={`${request.id}-allocation-${index}`} className="grid grid-cols-12 gap-2 items-center">
                                                    <select value={row.location_id} onChange={(event) => updateAllocationRow(request.id, index, 'location_id', event.target.value)} className="col-span-5 px-2 py-2 border border-gray-300 rounded-md" required>
                                                        <option value="">Select location...</option>
                                                        {locations.map((location) => (
                                                            <option key={location.id} value={String(location.id)}>{formatLocationLabel(location)}</option>
                                                        ))}
                                                    </select>
                                                    <input type="number" min="1" value={row.quantity} onChange={(event) => updateAllocationRow(request.id, index, 'quantity', event.target.value)} className="col-span-2 px-2 py-2 border border-gray-300 rounded-md" required />
                                                    <input type="text" value={row.note} onChange={(event) => updateAllocationRow(request.id, index, 'note', event.target.value)} className="col-span-4 px-2 py-2 border border-gray-300 rounded-md" placeholder="Optional note" />
                                                    <button type="button" onClick={() => removeAllocationRow(request.id, index)} className="col-span-1 text-sm font-semibold text-gray-500 hover:text-gray-700">×</button>
                                                </div>
                                            ))}
                                            <p className={`text-sm ${packTotals[request.id] > remainingQty ? 'text-red-600' : 'text-gray-600'}`}>
                                                Allocated quantity: {packTotals[request.id] || 0} / {remainingQty}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex space-x-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors" disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50" disabled={loading}>
                            {loading ? 'Processing...' : 'Mark as Received'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BatchReceivedModal;
