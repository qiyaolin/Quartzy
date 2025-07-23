import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertTriangle, Package } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext.tsx';

const BatchFundSelectionModal = ({ isOpen, onClose, onPlaceOrder, token, selectedRequests }) => {
    const notification = useNotification();
    const [funds, setFunds] = useState([]);
    const [selectedFundId, setSelectedFundId] = useState('');
    const [loading, setLoading] = useState(false);
    const [fundValidation, setFundValidation] = useState(null);

    useEffect(() => {
        if (isOpen && token) {
            fetchFunds();
        }
    }, [isOpen, token]);

    const fetchFunds = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/funds/', {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFunds(data);
            }
        } catch (error) {
            console.error('Failed to fetch funds:', error);
        }
    };

    const handleFundChange = async (fundId) => {
        setSelectedFundId(fundId);
        setFundValidation(null);

        if (fundId && selectedRequests.length > 0) {
            // Calculate total cost for validation
            const totalCost = selectedRequests.reduce((sum, req) => {
                return sum + (parseFloat(req.unit_price) * req.quantity);
            }, 0);

            try {
                const response = await fetch(`http://127.0.0.1:8000/api/funds/${fundId}/validate_budget/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: totalCost })
                });
                
                if (response.ok) {
                    const validation = await response.json();
                    setFundValidation(validation);
                }
            } catch (error) {
                console.error('Failed to validate fund budget:', error);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFundId) {
            notification.warning('Please select a fund');
            return;
        }

        if (fundValidation && !fundValidation.valid) {
            if (!window.confirm('This fund has insufficient budget. Do you want to proceed anyway?')) {
                return;
            }
        }

        setLoading(true);
        try {
            await onPlaceOrder(selectedRequests, selectedFundId);
            onClose();
            setSelectedFundId('');
            setFundValidation(null);
        } catch (error) {
            console.error('Failed to place orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceOrderWithoutFund = async () => {
        setLoading(true);
        try {
            await onPlaceOrder(selectedRequests, null);
            onClose();
            setSelectedFundId('');
            setFundValidation(null);
        } catch (error) {
            console.error('Failed to place orders without fund:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalCost = selectedRequests.reduce((sum, req) => {
        return sum + (parseFloat(req.unit_price) * req.quantity);
    }, 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Batch Place Order
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
                        You are placing orders for <strong>{selectedRequests.length}</strong> request(s).
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                        Total cost: <strong>${totalCost.toFixed(2)}</strong>
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Fund (Optional)
                        </label>
                        <select
                            value={selectedFundId}
                            onChange={(e) => handleFundChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Select a fund...</option>
                            {funds.map(fund => (
                                <option key={fund.id} value={fund.id}>
                                    {fund.name} - ${fund.available_budget?.toFixed(2) || '0.00'} available
                                </option>
                            ))}
                        </select>
                    </div>

                    {fundValidation && (
                        <div className={`mb-4 p-3 rounded-lg ${fundValidation.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div className="flex items-center space-x-2">
                                {!fundValidation.valid && <AlertTriangle className="w-4 h-4 text-red-600" />}
                                <span className={`text-sm font-medium ${fundValidation.valid ? 'text-green-800' : 'text-red-800'}`}>
                                    {fundValidation.valid ? 'Budget validation passed' : 'Insufficient budget'}
                                </span>
                            </div>
                            {!fundValidation.valid && (
                                <p className="text-sm text-red-600 mt-1">
                                    Available: ${fundValidation.available_budget?.toFixed(2) || '0.00'}, 
                                    Required: ${totalCost.toFixed(2)}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col space-y-3">
                        {funds.length > 0 && (
                            <button
                                type="button"
                                onClick={handlePlaceOrderWithoutFund}
                                className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                                disabled={loading}
                            >
                                <Package className="w-4 h-4" />
                                <span>{loading ? 'Processing...' : 'Place Orders Without Fund'}</span>
                            </button>
                        )}
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
                                disabled={loading || !selectedFundId}
                            >
                                {loading ? 'Processing...' : 'Place Orders with Fund'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BatchFundSelectionModal;