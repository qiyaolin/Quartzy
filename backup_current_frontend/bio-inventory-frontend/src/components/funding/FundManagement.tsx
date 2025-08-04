import React, { useState } from 'react';
import { Plus, Edit, Archive, DollarSign, Calendar, User, Building } from 'lucide-react';
import FundModal from './FundModal';
import { buildApiUrl } from '../../config/api';

const FundManagement = ({ funds, onRefresh, token }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFund, setSelectedFund] = useState(null);
    const [modalMode, setModalMode] = useState('create'); // 'create', 'edit'

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
                const response = await fetch(buildApiUrl(`/api/funds/${fundId}/archive/`), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    onRefresh();
                } else if (response.status === 404) {
                    alert('Funding API is not yet implemented on the backend. Please contact your system administrator.');
                } else {
                    alert('Failed to archive fund');
                }
            } catch (error) {
                console.error('Error archiving fund:', error);
                alert('Failed to archive fund. The funding system may not be fully implemented yet.');
            }
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
                                </div>
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
                token={token}
            />
        </div>
    );
};

export default FundManagement;