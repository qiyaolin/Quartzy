import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertTriangle, CheckCircle, Calculator, TrendingUp } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const BudgetApprovalModal = ({ isOpen, onClose, request, onApprove, token }) => {
    const [funds, setFunds] = useState([]);
    const [selectedFund, setSelectedFund] = useState('');
    const [budgetImpact, setBudgetImpact] = useState(null);
    const [loading, setLoading] = useState(false);
    const [approving, setApproving] = useState(false);

    useEffect(() => {
        if (isOpen && request) {
            fetchFunds();
        }
    }, [isOpen, request]);

    useEffect(() => {
        if (selectedFund && request) {
            calculateBudgetImpact();
        }
    }, [selectedFund, request]);

    const fetchFunds = async () => {
        setLoading(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.FUNDS), {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const activeFunds = (data.results || data).filter(fund => !fund.is_archived);
                setFunds(activeFunds);
                
                // Auto-select the first fund if there's only one
                if (activeFunds.length === 1) {
                    setSelectedFund(activeFunds[0].id.toString());
                }
            } else if (response.status === 404) {
                // API not implemented yet, set empty funds
                setFunds([]);
            }
        } catch (error) {
            console.error('Error fetching funds:', error);
            setFunds([]);
        } finally {
            setLoading(false);
        }
    };

    const calculateBudgetImpact = () => {
        const fund = funds.find(f => f.id.toString() === selectedFund);
        if (!fund || !request) return;

        const totalCost = request.unit_price * request.quantity;
        const currentUtilization = fund.total_budget > 0 ? (fund.spent_amount / fund.total_budget) * 100 : 0;
        const afterUtilization = fund.total_budget > 0 ? ((fund.spent_amount + totalCost) / fund.total_budget) * 100 : 0;
        const remainingAfter = fund.total_budget - fund.spent_amount - totalCost;

        setBudgetImpact({
            fund: fund,
            totalCost: totalCost,
            currentUtilization: currentUtilization,
            afterUtilization: Math.min(afterUtilization, 100),
            remainingAfter: remainingAfter,
            isOverBudget: remainingAfter < 0,
            isNearLimit: afterUtilization >= 90 && afterUtilization < 100
        });
    };

    const handleApprove = async () => {
        if (!selectedFund) {
            alert('Please select a fund for this request.');
            return;
        }

        if (budgetImpact?.isOverBudget) {
            const confirmed = window.confirm(
                'This approval will exceed the selected fund\'s budget. Are you sure you want to proceed?'
            );
            if (!confirmed) return;
        }

        setApproving(true);
        try {
            await onApprove(request.id, selectedFund);
            onClose();
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Failed to approve request. Please try again.');
        } finally {
            setApproving(false);
        }
    };

    const getBudgetStatusColor = () => {
        if (!budgetImpact) return 'text-secondary-600';
        if (budgetImpact.isOverBudget) return 'text-danger-600';
        if (budgetImpact.isNearLimit) return 'text-warning-600';
        return 'text-success-600';
    };

    const getBudgetStatusIcon = () => {
        if (!budgetImpact) return <Calculator className="w-5 h-5 text-secondary-600" />;
        if (budgetImpact.isOverBudget) return <AlertTriangle className="w-5 h-5 text-danger-600" />;
        if (budgetImpact.isNearLimit) return <AlertTriangle className="w-5 h-5 text-warning-600" />;
        return <CheckCircle className="w-5 h-5 text-success-600" />;
    };

    const getBudgetStatusMessage = () => {
        if (!budgetImpact) return '';
        if (budgetImpact.isOverBudget) {
            return `This approval will exceed the budget by $${Math.abs(budgetImpact.remainingAfter).toLocaleString()}`;
        }
        if (budgetImpact.isNearLimit) {
            return 'This approval will bring the fund close to its limit';
        }
        return 'Budget impact is within acceptable limits';
    };

    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-secondary-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary-900">Approve Request with Budget Control</h2>
                        <p className="text-secondary-600 mt-1">Review budget impact before approving this request</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                        disabled={approving}
                    >
                        <X className="w-6 h-6 text-secondary-600" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Request Details */}
                    <div className="bg-secondary-50 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold text-secondary-900 mb-3">Request Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-secondary-700">Item</p>
                                <p className="text-secondary-900">{request.item_name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-secondary-700">Requested By</p>
                                <p className="text-secondary-900">{request.requested_by?.username}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-secondary-700">Quantity</p>
                                <p className="text-secondary-900">{request.quantity} {request.unit_size}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-secondary-700">Unit Price</p>
                                <p className="text-secondary-900">${request.unit_price}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-sm font-medium text-secondary-700">Total Cost</p>
                                <p className="text-xl font-bold text-primary-600">
                                    ${(request.unit_price * request.quantity).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Fund Selection */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-secondary-900 mb-3">Select Fund</h3>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="loading-spinner w-6 h-6 mr-3"></div>
                                <span>Loading available funds...</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {funds.map(fund => (
                                    <label
                                        key={fund.id}
                                        className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                                            selectedFund === fund.id.toString()
                                                ? 'border-primary-300 bg-primary-50'
                                                : 'border-secondary-200 hover:border-secondary-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="fund"
                                            value={fund.id}
                                            checked={selectedFund === fund.id.toString()}
                                            onChange={(e) => setSelectedFund(e.target.value)}
                                            className="mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-medium text-secondary-900">{fund.name}</h4>
                                                <span className="text-sm text-secondary-600">
                                                    ${fund.spent_amount.toLocaleString()} / ${fund.total_budget.toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-secondary-600 mt-1">{fund.description}</p>
                                            
                                            {/* Fund utilization bar */}
                                            <div className="mt-2">
                                                <div className="w-full bg-secondary-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-300 ${
                                                            fund.total_budget > 0 && (fund.spent_amount / fund.total_budget) >= 0.9
                                                                ? 'bg-danger-500'
                                                                : fund.total_budget > 0 && (fund.spent_amount / fund.total_budget) >= 0.75
                                                                ? 'bg-warning-500'
                                                                : 'bg-success-500'
                                                        }`}
                                                        style={{
                                                            width: `${fund.total_budget > 0 ? Math.min((fund.spent_amount / fund.total_budget) * 100, 100) : 0}%`
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="flex justify-between text-xs text-secondary-500 mt-1">
                                                    <span>
                                                        {fund.total_budget > 0 ? ((fund.spent_amount / fund.total_budget) * 100).toFixed(1) : 0}% used
                                                    </span>
                                                    <span>
                                                        ${(fund.total_budget - fund.spent_amount).toLocaleString()} remaining
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                ))}

                                {funds.length === 0 && (
                                    <div className="text-center py-8 text-secondary-500">
                                        <DollarSign className="w-12 h-12 mx-auto mb-3 text-secondary-300" />
                                        <p>No active funds available</p>
                                        <p className="text-sm mt-1">
                                            {loading ? 'Loading funds...' : 'Please create a fund first to approve requests, or the funding API may not be implemented yet.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Budget Impact Analysis */}
                    {budgetImpact && (
                        <div className={`border rounded-lg p-4 mb-6 ${
                            budgetImpact.isOverBudget
                                ? 'border-danger-200 bg-danger-50'
                                : budgetImpact.isNearLimit
                                ? 'border-warning-200 bg-warning-50'
                                : 'border-success-200 bg-success-50'
                        }`}>
                            <div className="flex items-start">
                                {getBudgetStatusIcon()}
                                <div className="ml-3 flex-1">
                                    <h3 className={`text-lg font-semibold ${getBudgetStatusColor()}`}>
                                        Budget Impact Analysis
                                    </h3>
                                    <p className={`text-sm mt-1 ${getBudgetStatusColor()}`}>
                                        {getBudgetStatusMessage()}
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                        <div>
                                            <p className="text-xs font-medium text-secondary-600 uppercase">Current Utilization</p>
                                            <p className="text-lg font-bold text-secondary-900">
                                                {budgetImpact.currentUtilization.toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-secondary-600 uppercase">After Approval</p>
                                            <p className={`text-lg font-bold ${getBudgetStatusColor()}`}>
                                                {budgetImpact.afterUtilization.toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-secondary-600 uppercase">Remaining Budget</p>
                                            <p className={`text-lg font-bold ${budgetImpact.remainingAfter < 0 ? 'text-danger-600' : 'text-success-600'}`}>
                                                ${budgetImpact.remainingAfter.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Utilization visualization */}
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs text-secondary-600 mb-1">
                                            <span>Budget Utilization Preview</span>
                                            <span>{budgetImpact.afterUtilization.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-secondary-200 rounded-full h-3">
                                            <div
                                                className={`h-3 rounded-full transition-all duration-300 ${
                                                    budgetImpact.isOverBudget
                                                        ? 'bg-danger-500'
                                                        : budgetImpact.isNearLimit
                                                        ? 'bg-warning-500'
                                                        : 'bg-success-500'
                                                }`}
                                                style={{ width: `${Math.min(budgetImpact.afterUtilization, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3 p-6 border-t border-secondary-200 bg-secondary-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={approving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApprove}
                        className={`btn ${
                            budgetImpact?.isOverBudget
                                ? 'btn-danger'
                                : budgetImpact?.isNearLimit
                                ? 'btn-warning'
                                : 'btn-success'
                        }`}
                        disabled={approving || !selectedFund || funds.length === 0}
                    >
                        {approving ? (
                            <div className="flex items-center">
                                <div className="loading-spinner w-4 h-4 mr-2"></div>
                                Approving...
                            </div>
                        ) : (
                            <>
                                {budgetImpact?.isOverBudget && (
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                )}
                                Approve Request
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BudgetApprovalModal;