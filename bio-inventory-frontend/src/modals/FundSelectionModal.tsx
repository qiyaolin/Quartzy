import React, { useState, useEffect } from 'react';
import { X, DollarSign, Package, TrendingUp, AlertTriangle } from 'lucide-react';

const FundSelectionModal = ({ isOpen, onClose, request, onPlaceOrder, token }) => {
    const [funds, setFunds] = useState([]);
    const [selectedFund, setSelectedFund] = useState('');
    const [loading, setLoading] = useState(false);
    const [placing, setPlacing] = useState(false);

    useEffect(() => {
        if (isOpen && request) {
            fetchFunds();
        }
    }, [isOpen, request]);

    const fetchFunds = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/funds/', {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const activeFunds = (data.results || data).filter(fund => !fund.is_archived);
                setFunds(activeFunds);
                
                // Try to find the fund that was used for approval
                const approvedFund = activeFunds.find(fund => fund.id === request.fund_id);
                if (approvedFund) {
                    setSelectedFund(approvedFund.id.toString());
                } else if (activeFunds.length === 1) {
                    setSelectedFund(activeFunds[0].id.toString());
                }
            } else if (response.status === 404) {
                // API endpoint not available, set empty funds
                setFunds([]);
            }
        } catch (error) {
            console.error('Error fetching funds:', error);
            setFunds([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceOrder = async () => {
        setPlacing(true);
        try {
            await onPlaceOrder(request.id, selectedFund || null);
            onClose();
        } catch (error) {
            console.error('Error placing order:', error);
            alert('Failed to place order. Please try again.');
        } finally {
            setPlacing(false);
        }
    };

    const getFundUtilization = (fund) => {
        const unitPrice = parseFloat(request.unit_price) || 0;
        const quantity = parseFloat(request.quantity) || 0;
        const totalCost = unitPrice * quantity;
        const totalBudget = parseFloat(fund.total_budget) || 0;
        const spentAmount = parseFloat(fund.spent_amount) || 0;
        const currentUtilization = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0;
        const afterUtilization = totalBudget > 0 ? ((spentAmount + totalCost) / totalBudget) * 100 : 0;
        const remainingAfter = totalBudget - spentAmount - totalCost;

        return {
            current: currentUtilization,
            after: Math.min(afterUtilization, 100),
            remaining: remainingAfter,
            isOverBudget: remainingAfter < 0,
            isNearLimit: afterUtilization >= 90 && afterUtilization < 100
        };
    };

    const getBudgetRecommendation = (fund) => {
        const utilization = getFundUtilization(fund);
        
        if (utilization.isOverBudget) {
            return {
                type: 'danger',
                message: 'This will exceed the fund budget',
                icon: <AlertTriangle className="w-4 h-4" />
            };
        }
        
        if (utilization.isNearLimit) {
            return {
                type: 'warning',
                message: 'This will bring the fund close to its limit',
                icon: <AlertTriangle className="w-4 h-4" />
            };
        }
        
        return {
            type: 'success',
            message: 'Budget impact is within acceptable limits',
            icon: <TrendingUp className="w-4 h-4" />
        };
    };

    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-secondary-200 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary-900">Select Fund for Order</h2>
                        <p className="text-secondary-600 mt-1">Choose which fund to use for this order (optional)</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                        disabled={placing}
                    >
                        <X className="w-6 h-6 text-secondary-600" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow">
                    {/* Order Summary */}
                    <div className="bg-primary-50 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold text-primary-900 mb-3 flex items-center">
                            <Package className="w-5 h-5 mr-2" />
                            Order Summary
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm font-medium text-primary-700">Item</p>
                                <p className="text-primary-900 font-medium">{request.item_name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary-700">Quantity</p>
                                <p className="text-primary-900">{request.quantity} {request.unit_size}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary-700">Total Cost</p>
                                <p className="text-xl font-bold text-primary-900">
                                    ${((parseFloat(request.unit_price) || 0) * (parseFloat(request.quantity) || 0)).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        {request.vendor && (
                            <div className="mt-3 pt-3 border-t border-primary-200">
                                <p className="text-sm font-medium text-primary-700">Vendor</p>
                                <p className="text-primary-900">{request.vendor.name}</p>
                            </div>
                        )}
                    </div>

                    {/* Fund Selection */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Available Funds</h3>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="loading-spinner w-6 h-6 mr-3"></div>
                                <span>Loading available funds...</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {funds.map(fund => {
                                    const utilization = getFundUtilization(fund);
                                    const recommendation = getBudgetRecommendation(fund);
                                    
                                    return (
                                        <label
                                            key={fund.id}
                                            className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                                                selectedFund === fund.id.toString()
                                                    ? 'border-primary-300 bg-primary-50'
                                                    : 'border-secondary-200 hover:border-secondary-300'
                                            }`}
                                        >
                                            <div className="flex items-start">
                                                <input
                                                    type="radio"
                                                    name="fund"
                                                    value={fund.id}
                                                    checked={selectedFund === fund.id.toString()}
                                                    onChange={(e) => setSelectedFund(e.target.value)}
                                                    className="mt-1 mr-3"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="font-medium text-secondary-900">{fund.name}</h4>
                                                        <span className="text-sm text-secondary-600">
                                                            ${(parseFloat(fund.spent_amount) || 0).toLocaleString()} / ${(parseFloat(fund.total_budget) || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    
                                                    {fund.description && (
                                                        <p className="text-sm text-secondary-600 mb-3">{fund.description}</p>
                                                    )}
                                                    
                                                    {/* Current utilization */}
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-xs text-secondary-600 mb-1">
                                                            <span>Current Utilization</span>
                                                            <span>{utilization.current.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full bg-secondary-200 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                                    utilization.current >= 90
                                                                        ? 'bg-danger-500'
                                                                        : utilization.current >= 75
                                                                        ? 'bg-warning-500'
                                                                        : 'bg-success-500'
                                                                }`}
                                                                style={{ width: `${Math.min(utilization.current, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>

                                                    {/* After order preview */}
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-xs text-secondary-600 mb-1">
                                                            <span>After This Order</span>
                                                            <span>{utilization.after.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full bg-secondary-200 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                                    utilization.isOverBudget
                                                                        ? 'bg-danger-500'
                                                                        : utilization.isNearLimit
                                                                        ? 'bg-warning-500'
                                                                        : 'bg-success-500'
                                                                }`}
                                                                style={{ width: `${Math.min(utilization.after, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between text-xs mt-1">
                                                            <span className="text-secondary-500">
                                                                Remaining: ${utilization.remaining.toLocaleString()}
                                                            </span>
                                                            <span className={`font-medium ${
                                                                utilization.isOverBudget ? 'text-danger-600' :
                                                                utilization.isNearLimit ? 'text-warning-600' : 'text-success-600'
                                                            }`}>
                                                                {utilization.isOverBudget ? 'Over Budget' :
                                                                 utilization.isNearLimit ? 'Near Limit' : 'Within Budget'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Recommendation */}
                                                    <div className={`flex items-center text-sm p-2 rounded ${
                                                        recommendation.type === 'danger' ? 'bg-danger-50 text-danger-700' :
                                                        recommendation.type === 'warning' ? 'bg-warning-50 text-warning-700' :
                                                        'bg-success-50 text-success-700'
                                                    }`}>
                                                        {recommendation.icon}
                                                        <span className="ml-2">{recommendation.message}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}

                                {funds.length === 0 && (
                                    <div className="text-center py-8 text-secondary-500">
                                        <DollarSign className="w-12 h-12 mx-auto mb-3 text-secondary-300" />
                                        <p>No active funds available</p>
                                        <p className="text-sm mt-1">
                                            {loading ? 'Loading funds...' : 'Please create a fund first to place orders.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center p-6 border-t border-secondary-200 bg-secondary-50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={placing}
                    >
                        Cancel
                    </button>
                    <div className="flex space-x-3">
                        {funds.length > 0 && (
                            <button
                                onClick={() => {
                                    setSelectedFund('');
                                    handlePlaceOrder();
                                }}
                                className="btn btn-secondary"
                                disabled={placing}
                            >
                                {placing ? (
                                    <div className="flex items-center">
                                        <div className="loading-spinner w-4 h-4 mr-2"></div>
                                        Placing Order...
                                    </div>
                                ) : (
                                    <>
                                        <Package className="w-4 h-4 mr-2" />
                                        Place Order Without Fund
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            onClick={handlePlaceOrder}
                            className="btn btn-primary"
                            disabled={placing || (funds.length > 0 && !selectedFund)}
                        >
                            {placing ? (
                                <div className="flex items-center">
                                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                                    Placing Order...
                                </div>
                            ) : (
                                <>
                                    <Package className="w-4 h-4 mr-2" />
                                    {selectedFund ? 'Place Order with Fund' : 'Place Order'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FundSelectionModal;