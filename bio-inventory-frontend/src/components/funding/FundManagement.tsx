import React, { useState } from 'react';
import { Plus, Edit, Archive, AlertTriangle, DollarSign, Calendar, User, Building, TrendingUp, Eye, X } from 'lucide-react';
import FundModal from './FundModal.tsx';

const FundManagement = ({ funds, onRefresh, apiAvailable, token }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFund, setSelectedFund] = useState(null);
    const [modalMode, setModalMode] = useState('create'); // 'create', 'edit'
    const [showFiscalYearModal, setShowFiscalYearModal] = useState(false);
    const [fiscalYearData, setFiscalYearData] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCreateFund = () => {
        setSelectedFund(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleEditFund = (fund) => {
        setSelectedFund(fund);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleArchiveFund = async (fundId) => {
        if (window.confirm('Are you sure you want to archive this fund? This action cannot be undone.')) {
            try {
                const response = await fetch(`http://127.0.0.1:8000/api/funds/${fundId}/archive/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    onRefresh();
                } else {
                    alert('Failed to archive fund');
                }
            } catch (error) {
                console.error('Error archiving fund:', error);
                alert('Failed to archive fund. Please try again.');
            }
        }
    };

    const fetchFiscalYearSummary = async (fund, fiscalYear = null) => {
        setLoading(true);
        try {
            const currentYear = fiscalYear || new Date().getFullYear();
            const response = await fetch(`http://127.0.0.1:8000/api/funds/${fund.id}/fiscal_year_summary/?fiscal_year=${currentYear}`, {
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setFiscalYearData({ ...data, fund });
                setSelectedFund(fund);
                setShowFiscalYearModal(true);
            }
        } catch (error) {
            console.error('Error fetching fiscal year summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (fund) => {
        const totalBudget = parseFloat(fund.total_budget) || 0;
        const spentAmount = parseFloat(fund.spent_amount) || 0;
        const remaining = totalBudget - spentAmount;
        const percentUsed = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0;

        if (fund.is_archived) {
            return <span className="badge badge-secondary">Archived</span>;
        } else if (remaining <= 0) {
            return <span className="badge badge-danger">Depleted</span>;
        } else if (percentUsed >= 90) {
            return <span className="badge badge-warning">Low Balance</span>;
        } else if (percentUsed >= 75) {
            return <span className="badge badge-warning">Alert</span>;
        } else {
            return <span className="badge badge-success">Active</span>;
        }
    };

    const getProgressBarColor = (fund) => {
        const totalBudget = parseFloat(fund.total_budget) || 0;
        const spentAmount = parseFloat(fund.spent_amount) || 0;
        const percentUsed = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0;
        
        if (percentUsed >= 90) return 'bg-danger-500';
        if (percentUsed >= 75) return 'bg-warning-500';
        return 'bg-success-500';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-secondary-900">Fund Management</h3>
                    <p className="text-sm text-secondary-600">Create, edit, and manage laboratory funding sources</p>
                </div>
                <button
                    onClick={handleCreateFund}
                    className="btn btn-primary flex items-center"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Fund
                </button>
            </div>

            {/* Multi-Year Budget Management Panel */}
            {funds.some(f => f.grant_duration_years > 1) && (
                <div className="bg-white border border-secondary-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-lg font-semibold text-secondary-900 mb-2 flex items-center">
                                📅 Multi-Year Budget Management
                                <span className="ml-2 w-3 h-3 bg-success-400 rounded-full"></span>
                            </h4>
                            <p className="text-sm text-secondary-600">Track and manage grants across multiple fiscal years with automatic carry-over calculations</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {funds.filter(f => f.grant_duration_years > 1).map(fund => (
                            <div key={fund.id} className="bg-gradient-to-br from-indigo-50 to-purple-100 border border-indigo-200 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h5 className="font-semibold text-indigo-900 mb-1">{fund.name}</h5>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="badge badge-info text-xs">
                                                Year {fund.current_year} of {fund.grant_duration_years}
                                            </span>
                                            {fund.funding_agency && ['cihr', 'nserc', 'sshrc'].includes(fund.funding_agency) && (
                                                <span className="badge badge-success text-xs">Tri-Agency</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-indigo-700">Total Grant:</span>
                                        <span className="font-medium text-indigo-900">${(fund.total_budget || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-indigo-700">Current Year Budget:</span>
                                        <span className="font-medium text-indigo-900">
                                            ${(fund.annual_budgets?.[fund.current_year] || (fund.total_budget / fund.grant_duration_years)).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-indigo-700">Spent This Year:</span>
                                        <span className="font-medium text-red-600">${(fund.spent_amount || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-indigo-700">Remaining:</span>
                                        <span className="font-medium text-green-600">
                                            ${((fund.annual_budgets?.[fund.current_year] || (fund.total_budget / fund.grant_duration_years)) - (fund.spent_amount || 0)).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-indigo-600 mb-1">
                                        <span>Budget Utilization</span>
                                        <span>
                                            {(((fund.spent_amount || 0) / (fund.annual_budgets?.[fund.current_year] || (fund.total_budget / fund.grant_duration_years))) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-indigo-200 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                                            style={{ 
                                                width: `${Math.min(((fund.spent_amount || 0) / (fund.annual_budgets?.[fund.current_year] || (fund.total_budget / fund.grant_duration_years))) * 100, 100)}%` 
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                
                                <div className="mt-3 pt-3 border-t border-indigo-200">
                                    <button
                                        onClick={() => fetchFiscalYearSummary(fund)}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium w-full text-center py-1 bg-indigo-50 rounded"
                                        disabled={loading}
                                    >
                                        View Detailed Fiscal Analysis
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Funds Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {funds.map((fund) => {
                    const totalBudget = parseFloat(fund.total_budget) || 0;
                    const spentAmount = parseFloat(fund.spent_amount) || 0;
                    const remaining = totalBudget - spentAmount;
                    const percentUsed = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0;
                    
                    return (
                        <div key={fund.id} className="bg-white border border-secondary-200 rounded-lg shadow-soft overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="text-lg font-semibold text-secondary-900 mb-1">
                                            {fund.name}
                                        </h4>
                                        <p className="text-sm text-secondary-600 mb-2">
                                            {fund.description}
                                        </p>
                                        {getStatusBadge(fund)}
                                    </div>
                                    <div className="flex space-x-1 ml-4">
                                        <button
                                            onClick={() => handleEditFund(fund)}
                                            className="p-2 hover:bg-primary-50 rounded-lg transition-colors group"
                                            disabled={fund.is_archived}
                                        >
                                            <Edit className="w-4 h-4 text-secondary-400 group-hover:text-primary-600" />
                                        </button>
                                        <button
                                            onClick={() => handleArchiveFund(fund.id)}
                                            className="p-2 hover:bg-danger-50 rounded-lg transition-colors group"
                                            disabled={fund.is_archived}
                                        >
                                            <Archive className="w-4 h-4 text-secondary-400 group-hover:text-danger-600" />
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
                                        <span className="text-sm font-medium text-warning-600">
                                            ${spentAmount.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-secondary-600">Remaining</span>
                                        <span className={`text-sm font-medium ${remaining > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                                            ${remaining.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="w-full bg-secondary-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(fund)}`}
                                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-secondary-500">
                                            <span>{percentUsed.toFixed(1)}% used</span>
                                            <span>{(100 - percentUsed).toFixed(1)}% remaining</span>
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
                                                Year {fund.current_year} of {fund.grant_duration_years}
                                            </span>
                                        </div>
                                    )}
                                    {fund.funding_agency && ['cihr', 'nserc', 'sshrc'].includes(fund.funding_agency) && (
                                        <div className="flex items-center text-xs text-info-600 bg-info-50 rounded px-2 py-1">
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            Tri-Agency Compliance Enabled
                                        </div>
                                    )}
                                </div>

                                {/* Quick Actions for Multi-year Grants */}
                                {fund.grant_duration_years > 1 && !fund.is_archived && (
                                    <div className="mt-3 pt-3 border-t border-secondary-200">
                                        <button
                                            onClick={() => fetchFiscalYearSummary(fund)}
                                            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                                            disabled={loading}
                                        >
                                            View Fiscal Year Summary
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {funds.length === 0 && (
                    <div className="col-span-full text-center py-12">
                        <DollarSign className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-secondary-900 mb-2">No Funds Available</h3>
                        <p className="text-secondary-600 mb-4">
                            Create your first fund to start managing laboratory budgets.
                        </p>
                        <button
                            onClick={handleCreateFund}
                            className="btn btn-primary"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Fund
                        </button>
                    </div>
                )}
            </div>

            {/* Fund Modal */}
            <FundModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                fund={selectedFund}
                mode={modalMode}
                onSave={onRefresh}
                apiAvailable={apiAvailable}
                token={token}
            />

            {/* Fiscal Year Summary Modal */}
            {showFiscalYearModal && fiscalYearData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-secondary-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-semibold text-secondary-900">
                                        Fiscal Year Summary - {fiscalYearData.fund?.name}
                                    </h3>
                                    <p className="text-sm text-secondary-600 mt-1">
                                        Year {fiscalYearData.current_year} of {fiscalYearData.fund?.grant_duration_years} • FY {fiscalYearData.fiscal_year}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowFiscalYearModal(false)}
                                    className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                                >
                                    <X className="w-6 h-6 text-secondary-600" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                                    <div className="flex items-center">
                                        <DollarSign className="w-8 h-8 text-success-600 mr-3" />
                                        <div>
                                            <p className="text-sm text-success-700">Annual Budget</p>
                                            <p className="text-2xl font-bold text-success-900">
                                                ${parseFloat(fiscalYearData.annual_budget || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                                    <div className="flex items-center">
                                        <TrendingUp className="w-8 h-8 text-warning-600 mr-3" />
                                        <div>
                                            <p className="text-sm text-warning-700">Spent This Year</p>
                                            <p className="text-2xl font-bold text-warning-900">
                                                ${parseFloat(fiscalYearData.spent_amount || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-info-50 border border-info-200 rounded-lg p-4">
                                    <div className="flex items-center">
                                        <Calendar className="w-8 h-8 text-info-600 mr-3" />
                                        <div>
                                            <p className="text-sm text-info-700">Remaining</p>
                                            <p className="text-2xl font-bold text-info-900">
                                                ${parseFloat(fiscalYearData.remaining_budget || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {fiscalYearData.carryover_info && (
                                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
                                    <h4 className="font-medium text-primary-900 mb-2">Carry-over Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-primary-700">From Previous Year:</span>
                                            <span className="ml-2 font-medium">${parseFloat(fiscalYearData.carryover_info.from_previous || 0).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-primary-700">Available for Next Year:</span>
                                            <span className="ml-2 font-medium">${parseFloat(fiscalYearData.carryover_info.available_next || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {fiscalYearData.compliance_notes && (
                                <div className="bg-info-50 border border-info-200 rounded-lg p-4">
                                    <h4 className="font-medium text-info-900 mb-2">Compliance Notes</h4>
                                    <p className="text-sm text-info-800">{fiscalYearData.compliance_notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-secondary-200 flex justify-end">
                            <button
                                onClick={() => setShowFiscalYearModal(false)}
                                className="btn btn-primary"
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

export default FundManagement;