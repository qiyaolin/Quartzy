import React, { useState, useMemo } from 'react';
import { Search, Download, Calendar, DollarSign, Package, User, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';

const TransactionRecords = ({ transactions, funds, onRefresh, token }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFund, setSelectedFund] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [sortBy, setSortBy] = useState('date_desc');

    const filteredTransactions = useMemo(() => {
        let filtered = [...transactions];

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(transaction =>
                transaction.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                transaction.fund?.name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by fund
        if (selectedFund) {
            filtered = filtered.filter(transaction => transaction.fund?.id === parseInt(selectedFund));
        }

        // Filter by date range
        if (dateRange.start) {
            filtered = filtered.filter(transaction => 
                new Date(transaction.transaction_date) >= new Date(dateRange.start)
            );
        }
        if (dateRange.end) {
            filtered = filtered.filter(transaction => 
                new Date(transaction.transaction_date) <= new Date(dateRange.end)
            );
        }

        // Sort transactions
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date_desc':
                    return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
                case 'date_asc':
                    return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
                case 'amount_desc':
                    return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
                case 'amount_asc':
                    return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
                case 'fund':
                    return (a.fund?.name || '').localeCompare(b.fund?.name || '');
                default:
                    return 0;
            }
        });

        return filtered;
    }, [transactions, searchTerm, selectedFund, dateRange, sortBy]);

    const totalAmount = filteredTransactions.reduce((sum, transaction) => {
        const amount = parseFloat(transaction.amount) || 0;
        return sum + amount;
    }, 0);

    const exportTransactions = () => {
        const transactionData = filteredTransactions.map(transaction => ({
            Date: transaction.transaction_date,
            Fund: transaction.fund?.name || 'N/A',
            Item: transaction.item_name,
            Description: transaction.description,
            Amount: `$${parseFloat(transaction.amount || '0' || 0).toFixed(2)}`,
            'Request ID': transaction.request_id,
            'Created By': transaction.created_by?.username || 'N/A'
        }));

        const summaryInfo = {
            'Export Date': new Date().toLocaleDateString(),
            'Date Range': dateRange.start && dateRange.end 
                ? `${dateRange.start} to ${dateRange.end}` 
                : 'All Dates',
            'Selected Fund': selectedFund 
                ? funds.find(f => f.id === parseInt(selectedFund))?.name || 'Unknown Fund'
                : 'All Funds',
            'Total Transactions': filteredTransactions.length,
            'Total Amount': `$${totalAmount.toFixed(2)}`
        };

        exportToExcel({
            fileName: 'transaction-records',
            sheetName: 'Transaction Records',
            title: 'Transaction Records Export',
            data: transactionData,
            summary: summaryInfo
        });
    };

    const getTransactionTypeIcon = (transaction) => {
        if (transaction.transaction_type === 'purchase') {
            return <Package className="w-4 h-4 text-primary-600" />;
        }
        return <DollarSign className="w-4 h-4 text-secondary-600" />;
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedFund('');
        setDateRange({ start: '', end: '' });
        setSortBy('date_desc');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-secondary-900">Transaction Records</h3>
                    <p className="text-sm text-secondary-600">Track all approved expenditures and budget allocations</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={exportTransactions}
                        className="btn btn-secondary flex items-center"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </button>
                    <button
                        onClick={onRefresh}
                        className="btn btn-primary"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-secondary-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Search
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 w-4 h-4" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input w-full pl-9"
                                placeholder="Search items, funds..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Fund
                        </label>
                        <select
                            value={selectedFund}
                            onChange={(e) => setSelectedFund(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Funds</option>
                            {funds.map(fund => (
                                <option key={fund.id} value={fund.id}>
                                    {fund.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="input w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="input w-full"
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-1">
                                Sort by
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="input"
                            >
                                <option value="date_desc">Date (Newest First)</option>
                                <option value="date_asc">Date (Oldest First)</option>
                                <option value="amount_desc">Amount (Highest First)</option>
                                <option value="amount_asc">Amount (Lowest First)</option>
                                <option value="fund">Fund Name</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={clearFilters}
                        className="btn btn-secondary text-sm"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <FileText className="w-8 h-8 text-primary-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Total Transactions</p>
                            <p className="text-2xl font-bold text-secondary-900">
                                {filteredTransactions.length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-success-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Total Amount</p>
                            <p className="text-2xl font-bold text-success-600">
                                ${totalAmount.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <Calendar className="w-8 h-8 text-warning-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Date Range</p>
                            <p className="text-lg font-medium text-secondary-900">
                                {dateRange.start && dateRange.end 
                                    ? `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`
                                    : 'All Time'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-lg shadow-soft border border-secondary-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead className="table-header">
                            <tr>
                                <th className="table-header-cell">Date</th>
                                <th className="table-header-cell">Item/Description</th>
                                <th className="table-header-cell">Fund</th>
                                <th className="table-header-cell">Amount</th>
                                <th className="table-header-cell">Request ID</th>
                                <th className="table-header-cell">Created By</th>
                            </tr>
                        </thead>
                        <tbody className="table-body">
                            {filteredTransactions.map((transaction) => (
                                <tr key={transaction.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="flex items-center">
                                            {getTransactionTypeIcon(transaction)}
                                            <div className="ml-2">
                                                <div className="text-sm font-medium text-secondary-900">
                                                    {new Date(transaction.transaction_date).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    {new Date(transaction.transaction_date).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div>
                                            <div className="text-sm font-medium text-secondary-900">
                                                {transaction.item_name}
                                            </div>
                                            {transaction.description && (
                                                <div className="text-xs text-secondary-600">
                                                    {transaction.description}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <span className="badge badge-primary">
                                            {transaction.fund?.name || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <span className="text-lg font-bold text-success-600">
                                            ${(parseFloat(transaction.amount) || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        {transaction.request_id ? (
                                            <span className="text-sm font-mono text-secondary-700">
                                                #{transaction.request_id}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-secondary-500">-</span>
                                        )}
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center">
                                            <User className="w-4 h-4 text-secondary-400 mr-2" />
                                            <span className="text-sm text-secondary-700">
                                                {transaction.created_by?.username || 'System'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredTransactions.length === 0 && (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-secondary-900 mb-2">No Transactions Found</h3>
                            <p className="text-secondary-600">
                                {searchTerm || selectedFund || dateRange.start || dateRange.end
                                    ? 'Try adjusting your filters to see more results.'
                                    : 'No transactions have been recorded yet.'
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionRecords;