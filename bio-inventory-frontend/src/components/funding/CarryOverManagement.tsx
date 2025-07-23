import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, DollarSign, Check, X, Clock, ArrowRight, AlertCircle } from 'lucide-react';

const CarryOverManagement = ({ funds, token }) => {
    const [carryovers, setCarryovers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedFund, setSelectedFund] = useState('');
    const [selectedFiscalYear, setSelectedFiscalYear] = useState(new Date().getFullYear());
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const triAgencyFunds = useMemo(() => {
        return funds.filter(fund => 
            fund.funding_agency && 
            ['cihr', 'nserc', 'sshrc'].includes(fund.funding_agency)
        );
    }, [funds]);

    const fetchCarryovers = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/carryovers/', {
                headers: {
                    'Authorization': `Token ${token}`
                }
            }).catch(() => ({ ok: false, status: 404 }));

            if (response.ok) {
                const data = await response.json();
                setCarryovers(data);
            } else {
                // API not available, start with empty carry-overs
                setCarryovers([]);
            }
        } catch (error) {
            console.error('Error fetching carry-overs:', error);
        } finally {
            setLoading(false);
        }
    };

    const createCarryover = async () => {
        if (!selectedFund) {
            setError('Please select a fund');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/funds/${selectedFund}/create_carryover/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    from_fiscal_year: selectedFiscalYear,
                    notes: notes
                })
            }).catch(() => ({ ok: false, status: 404 }));

            if (response.ok) {
                setShowCreateModal(false);
                setSelectedFund('');
                setNotes('');
                setError('');
                fetchCarryovers();
            } else {
                const errorData = await response.json().catch(() => ({ error: 'API not available' }));
                setError(errorData.error || 'API endpoint not available. Please ensure the backend carry-over API is properly configured.');
            }
        } catch (error) {
            console.error('Error creating carry-over:', error);
            setError('Failed to create carry-over request');
        } finally {
            setLoading(false);
        }
    };

    const approveCarryover = async (carryoverId) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/carryovers/${carryoverId}/approve/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (response.ok) {
                fetchCarryovers();
            }
        } catch (error) {
            console.error('Error approving carry-over:', error);
        }
    };

    const processCarryover = async (carryoverId) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/carryovers/${carryoverId}/process/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (response.ok) {
                fetchCarryovers();
            }
        } catch (error) {
            console.error('Error processing carry-over:', error);
        }
    };

    useEffect(() => {
        fetchCarryovers();
    }, []);

    const getStatusBadge = (carryover) => {
        if (carryover.is_processed) {
            return <span className="badge badge-success">Processed</span>;
        } else if (carryover.is_approved) {
            return <span className="badge badge-info">Approved</span>;
        } else {
            return <span className="badge badge-warning">Pending Approval</span>;
        }
    };

    const groupedCarryovers = useMemo(() => {
        const grouped = {
            pending: carryovers.filter(c => !c.is_approved),
            approved: carryovers.filter(c => c.is_approved && !c.is_processed),
            processed: carryovers.filter(c => c.is_processed)
        };
        return grouped;
    }, [carryovers]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-secondary-900">Carry-over Management</h3>
                    <p className="text-sm text-secondary-600">Manage unspent fund transfers between fiscal years</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                    disabled={triAgencyFunds.length === 0}
                >
                    Create Carry-over Request
                </button>
            </div>

            {triAgencyFunds.length === 0 && (
                <div className="bg-info-50 border border-info-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-info-600 mr-3 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-info-800">No Tri-Agency Funds</h4>
                            <p className="text-sm text-info-700">
                                Carry-over management is available for CIHR, NSERC, and SSHRC funds only.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <Clock className="w-8 h-8 text-warning-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Pending Approval</p>
                            <p className="text-2xl font-bold text-warning-600">
                                {groupedCarryovers.pending.length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <Check className="w-8 h-8 text-info-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Approved</p>
                            <p className="text-2xl font-bold text-info-600">
                                {groupedCarryovers.approved.length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-success-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Processed</p>
                            <p className="text-2xl font-bold text-success-600">
                                {groupedCarryovers.processed.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Carry-over List */}
            <div className="bg-white rounded-lg shadow-soft border border-secondary-200 overflow-hidden">
                <div className="p-6 border-b border-secondary-200">
                    <h4 className="text-lg font-semibold text-secondary-900">Carry-over Requests</h4>
                </div>
                
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                        <p className="text-secondary-600">Loading carry-overs...</p>
                    </div>
                ) : carryovers.length === 0 ? (
                    <div className="p-12 text-center">
                        <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-secondary-900 mb-2">No Carry-overs</h3>
                        <p className="text-secondary-600">
                            No carry-over requests have been created yet.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead className="table-header">
                                <tr>
                                    <th className="table-header-cell">Fund</th>
                                    <th className="table-header-cell">Fiscal Years</th>
                                    <th className="table-header-cell">Amount</th>
                                    <th className="table-header-cell">Status</th>
                                    <th className="table-header-cell">Created</th>
                                    <th className="table-header-cell">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="table-body">
                                {carryovers.map((carryover) => (
                                    <tr key={carryover.id} className="table-row">
                                        <td className="table-cell">
                                            <div>
                                                <div className="text-sm font-medium text-secondary-900">
                                                    {carryover.fund?.name}
                                                </div>
                                                <div className="text-xs text-secondary-500 capitalize">
                                                    {carryover.fund?.funding_agency}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex items-center">
                                                <span className="text-sm font-medium">FY{carryover.from_fiscal_year}</span>
                                                <ArrowRight className="w-4 h-4 mx-2 text-secondary-400" />
                                                <span className="text-sm font-medium">FY{carryover.to_fiscal_year}</span>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <div>
                                                <div className="text-lg font-bold text-success-600">
                                                    ${parseFloat(carryover.carryover_amount).toLocaleString()}
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    {carryover.carryover_percentage?.toFixed(1)}% of budget
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            {getStatusBadge(carryover)}
                                        </td>
                                        <td className="table-cell">
                                            <div className="text-sm text-secondary-700">
                                                {new Date(carryover.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-secondary-500">
                                                by {carryover.created_by?.username}
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex space-x-2">
                                                {!carryover.is_approved && (
                                                    <button
                                                        onClick={() => approveCarryover(carryover.id)}
                                                        className="btn btn-sm btn-success"
                                                        title="Approve carry-over"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {carryover.is_approved && !carryover.is_processed && (
                                                    <button
                                                        onClick={() => processCarryover(carryover.id)}
                                                        className="btn btn-sm btn-primary"
                                                        title="Process carry-over"
                                                    >
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Carry-over Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-secondary-200">
                            <h3 className="text-lg font-semibold text-secondary-900">
                                Create Carry-over Request
                            </h3>
                            <p className="text-sm text-secondary-600 mt-1">
                                Transfer unspent funds to the next fiscal year
                            </p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                            {error && (
                                <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    Select Fund *
                                </label>
                                <select
                                    value={selectedFund}
                                    onChange={(e) => setSelectedFund(e.target.value)}
                                    className="input w-full"
                                >
                                    <option value="">Choose a fund...</option>
                                    {triAgencyFunds.map(fund => (
                                        <option key={fund.id} value={fund.id}>
                                            {fund.name} ({fund.funding_agency?.toUpperCase()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    From Fiscal Year
                                </label>
                                <input
                                    type="number"
                                    value={selectedFiscalYear}
                                    onChange={(e) => setSelectedFiscalYear(parseInt(e.target.value))}
                                    className="input w-full"
                                    min="2020"
                                    max="2030"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    Notes (optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="input w-full"
                                    rows={3}
                                    placeholder="Additional notes about this carry-over request..."
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-secondary-200 flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setError('');
                                    setSelectedFund('');
                                    setNotes('');
                                }}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createCarryover}
                                className="btn btn-primary"
                                disabled={loading || !selectedFund}
                            >
                                {loading ? 'Creating...' : 'Create Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarryOverManagement;