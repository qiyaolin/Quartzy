import React, { useState } from 'react';
import { Archive, Calendar, User, Building, DollarSign, RotateCcw, X } from 'lucide-react';

const ArchivedFunds = ({ funds, onRefresh, token }) => {
    const [loading, setLoading] = useState(false);
    const [selectedFund, setSelectedFund] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const archivedFunds = funds.filter(fund => fund.is_archived);

    const handleRestoreFund = async (fundId) => {
        if (window.confirm('Are you sure you want to restore this fund? It will become active again.')) {
            setLoading(true);
            try {
                const response = await fetch(`http://127.0.0.1:8000/api/funds/${fundId}/restore/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    onRefresh();
                } else {
                    alert('Failed to restore fund');
                }
            } catch (error) {
                console.error('Error restoring fund:', error);
                alert('Failed to restore fund. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    };

    const viewFundDetails = (fund) => {
        setSelectedFund(fund);
        setShowDetailsModal(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-secondary-900">Archived Funds</h3>
                    <p className="text-sm text-secondary-600">View and manage archived funding sources</p>
                </div>
                <div className="text-sm text-secondary-500">
                    {archivedFunds.length} archived fund{archivedFunds.length !== 1 ? 's' : ''}
                </div>
            </div>

            {archivedFunds.length === 0 ? (
                <div className="text-center py-12">
                    <Archive className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-secondary-900 mb-2">No Archived Funds</h3>
                    <p className="text-secondary-600">
                        Archived funds will appear here for reference and restoration.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {archivedFunds.map((fund) => {
                        const totalBudget = parseFloat(fund.total_budget) || 0;
                        const spentAmount = parseFloat(fund.spent_amount) || 0;
                        const remaining = totalBudget - spentAmount;
                        const percentUsed = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0;
                        
                        return (
                            <div key={fund.id} className="bg-white border border-secondary-200 rounded-lg shadow-soft overflow-hidden opacity-75">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h4 className="text-lg font-semibold text-secondary-900 mb-1 flex items-center">
                                                {fund.name}
                                                <Archive className="w-4 h-4 text-secondary-400 ml-2" />
                                            </h4>
                                            <p className="text-sm text-secondary-600 mb-2">
                                                {fund.description}
                                            </p>
                                            <span className="badge badge-secondary">Archived</span>
                                        </div>
                                        <div className="flex space-x-1 ml-4">
                                            <button
                                                onClick={() => viewFundDetails(fund)}
                                                className="p-2 hover:bg-primary-50 rounded-lg transition-colors group"
                                                title="View Details"
                                            >
                                                <DollarSign className="w-4 h-4 text-secondary-400 group-hover:text-primary-600" />
                                            </button>
                                            <button
                                                onClick={() => handleRestoreFund(fund.id)}
                                                className="p-2 hover:bg-success-50 rounded-lg transition-colors group"
                                                disabled={loading}
                                                title="Restore Fund"
                                            >
                                                <RotateCcw className="w-4 h-4 text-secondary-400 group-hover:text-success-600" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Budget Information */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-secondary-700">Total Budget</span>
                                            <span className="text-lg font-bold text-secondary-900">
                                                ${totalBudget.toLocaleString()}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-secondary-600">Spent</span>
                                            <span className="text-sm font-medium text-secondary-600">
                                                ${spentAmount.toLocaleString()}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-secondary-600">Final Balance</span>
                                            <span className={`text-sm font-medium ${remaining > 0 ? 'text-secondary-600' : 'text-danger-600'}`}>
                                                ${remaining.toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-1">
                                            <div className="w-full bg-secondary-200 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full bg-secondary-400 transition-all duration-300"
                                                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-xs text-secondary-500">
                                                <span>{percentUsed.toFixed(1)}% utilized</span>
                                                <span>Final status</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fund Details */}
                                    <div className="mt-4 pt-4 border-t border-secondary-200 space-y-2">
                                        {fund.funding_source && (
                                            <div className="flex items-center text-xs text-secondary-600">
                                                <Building className="w-3 h-3 mr-2" />
                                                Source: {fund.funding_source}
                                            </div>
                                        )}
                                        {fund.start_date && (
                                            <div className="flex items-center text-xs text-secondary-600">
                                                <Calendar className="w-3 h-3 mr-2" />
                                                {new Date(fund.start_date).toLocaleDateString()} - {fund.end_date ? new Date(fund.end_date).toLocaleDateString() : 'Ongoing'}
                                            </div>
                                        )}
                                        {fund.principal_investigator && (
                                            <div className="flex items-center text-xs text-secondary-600">
                                                <User className="w-3 h-3 mr-2" />
                                                PI: {fund.principal_investigator}
                                            </div>
                                        )}
                                        {fund.grant_duration_years > 1 && (
                                            <div className="flex items-center justify-between text-xs text-secondary-600 bg-secondary-50 rounded px-2 py-1">
                                                <div className="flex items-center">
                                                    <Calendar className="w-3 h-3 mr-1" />
                                                    Multi-year Grant
                                                </div>
                                                <span className="font-medium">
                                                    {fund.grant_duration_years} years total
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fund Details Modal */}
            {showDetailsModal && selectedFund && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-secondary-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-semibold text-secondary-900 flex items-center">
                                        {selectedFund.name}
                                        <Archive className="w-5 h-5 text-secondary-400 ml-2" />
                                    </h3>
                                    <p className="text-sm text-secondary-600 mt-1">Archived Fund Details</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                                >
                                    <X className="w-6 h-6 text-secondary-600" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-medium text-secondary-900 mb-2">Description</h4>
                                    <p className="text-secondary-700">{selectedFund.description || 'No description provided'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-medium text-secondary-900 mb-2">Total Budget</h4>
                                        <p className="text-2xl font-bold text-secondary-900">
                                            ${(parseFloat(selectedFund.total_budget) || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-secondary-900 mb-2">Final Spent Amount</h4>
                                        <p className="text-2xl font-bold text-warning-600">
                                            ${(parseFloat(selectedFund.spent_amount) || 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-secondary-900 mb-2">Fund Information</h4>
                                    <div className="space-y-2">
                                        {selectedFund.funding_source && (
                                            <div className="flex justify-between">
                                                <span className="text-secondary-600">Funding Source:</span>
                                                <span className="font-medium">{selectedFund.funding_source}</span>
                                            </div>
                                        )}
                                        {selectedFund.principal_investigator && (
                                            <div className="flex justify-between">
                                                <span className="text-secondary-600">Principal Investigator:</span>
                                                <span className="font-medium">{selectedFund.principal_investigator}</span>
                                            </div>
                                        )}
                                        {selectedFund.start_date && (
                                            <div className="flex justify-between">
                                                <span className="text-secondary-600">Duration:</span>
                                                <span className="font-medium">
                                                    {new Date(selectedFund.start_date).toLocaleDateString()} - {selectedFund.end_date ? new Date(selectedFund.end_date).toLocaleDateString() : 'Ongoing'}
                                                </span>
                                            </div>
                                        )}
                                        {selectedFund.grant_duration_years > 1 && (
                                            <div className="flex justify-between">
                                                <span className="text-secondary-600">Grant Duration:</span>
                                                <span className="font-medium">{selectedFund.grant_duration_years} years</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-secondary-200 flex justify-between">
                            <button
                                onClick={() => handleRestoreFund(selectedFund.id)}
                                className="btn btn-success flex items-center"
                                disabled={loading}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restore Fund
                            </button>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="btn btn-secondary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArchivedFunds;