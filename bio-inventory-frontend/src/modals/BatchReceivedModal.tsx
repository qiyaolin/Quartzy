import React, { useState, useEffect } from 'react';
import { X, Package, MapPin } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const getRemainingQty = (request) => Number(request?.remaining_quantity ?? request?.quantity ?? 0);

const BatchReceivedModal = ({ isOpen, onClose, onSave, token, selectedRequests }) => {
    const notification = useNotification();
    const [locations, setLocations] = useState([]);
    const [defaultLocationId, setDefaultLocationId] = useState('');
    const [locationAssignments, setLocationAssignments] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !token) return;
        fetchLocations();
        const initialAssignments = {};
        selectedRequests.forEach((req) => {
            const qty = getRemainingQty(req);
            initialAssignments[req.id] = Array(qty).fill('');
        });
        setLocationAssignments(initialAssignments);
        setDefaultLocationId('');
    }, [isOpen, token, selectedRequests]);

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

    const applyDefaultToAll = () => {
        if (!defaultLocationId) return;
        const nextAssignments = {};
        selectedRequests.forEach((req) => {
            const qty = getRemainingQty(req);
            nextAssignments[req.id] = Array(qty).fill(defaultLocationId);
        });
        setLocationAssignments(nextAssignments);
    };

    const updatePieceLocation = (requestId, index, locationId) => {
        setLocationAssignments((prev) => {
            const next = { ...prev };
            const list = [...(next[requestId] || [])];
            list[index] = locationId;
            next[requestId] = list;
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const receiptsByRequest = selectedRequests.map((req) => {
                const assignments = locationAssignments[req.id] || [];
                return {
                    request_id: req.id,
                    receipts: assignments.map((locationId) => ({
                        location_id: parseInt(locationId, 10),
                    })),
                };
            });

            const invalidEntry = receiptsByRequest.find((entry) =>
                !entry.receipts.length || entry.receipts.some((receipt) => Number.isNaN(receipt.location_id))
            );
            if (invalidEntry) {
                notification.warning('Please select storage location for every piece in all requests.');
                return;
            }

            await onSave(selectedRequests, { receipts_by_request: receiptsByRequest });
            onClose();
            setDefaultLocationId('');
        } catch (error) {
            console.error('Failed to mark requests as received:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <Package className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Batch Mark Received
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                        You are marking <strong>{selectedRequests.length}</strong> request(s) as received.
                        Default location can be applied in one click, then override by piece if needed.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Default Storage Location
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={defaultLocationId}
                                onChange={(e) => setDefaultLocationId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="">Select a default location...</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={String(location.id)}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={applyDefaultToAll}
                                disabled={!defaultLocationId}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                            >
                                Apply to All
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                        {selectedRequests.map((req) => {
                            const remainingQty = getRemainingQty(req);
                            const assignments = locationAssignments[req.id] || [];
                            return (
                                <div key={req.id} className="bg-white border border-gray-200 rounded-md p-3">
                                    <div className="mb-2">
                                        <p className="font-semibold text-gray-900">{req.item_name}</p>
                                        <p className="text-xs text-gray-600">Request #{req.id} | Remaining: {remainingQty}</p>
                                    </div>
                                    <div className="space-y-2">
                                        {Array.from({ length: remainingQty }).map((_, index) => (
                                            <div key={`${req.id}-piece-${index}`} className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-600 w-14">Piece {index + 1}</span>
                                                <select
                                                    value={assignments[index] || ''}
                                                    onChange={(e) => updatePieceLocation(req.id, index, e.target.value)}
                                                    className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                    required
                                                >
                                                    <option value="">Select location...</option>
                                                    {locations.map((location) => (
                                                        <option key={location.id} value={String(location.id)}>
                                                            {location.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Mark as Received'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BatchReceivedModal;
