import React, { useState, useEffect } from 'react';
import { X, Package, MapPin } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const BatchReceivedModal = ({ isOpen, onClose, onSave, token, selectedRequests }) => {
    const notification = useNotification();
    const [locations, setLocations] = useState([]);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && token) {
            fetchLocations();
        }
    }, [isOpen, token]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedLocationId) {
            notification.warning('Please select a location');
            return;
        }

        setLoading(true);
        try {
            await onSave(selectedRequests, { location_id: selectedLocationId });
            onClose();
            setSelectedLocationId('');
        } catch (error) {
            console.error('Failed to mark requests as received:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
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
                        All items will be added to inventory at the selected location.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Storage Location *
                        </label>
                        <select
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        >
                            <option value="">Select a location...</option>
                            {locations.map(location => (
                                <option key={location.id} value={location.id}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
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