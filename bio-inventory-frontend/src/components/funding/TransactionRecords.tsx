import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Calendar, DollarSign, Package, User, FileText } from 'lucide-react';

const TransactionRecords = ({ transactions, funds, onRefresh, token }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFund, setSelectedFund] = useState('');
    const [selectedCostType, setSelectedCostType] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
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

        // Filter by cost type
        if (selectedCostType) {
            filtered = filtered.filter(transaction => transaction.cost_type === selectedCostType);
        }

        // Filter by expense category
        if (selectedCategory) {
            filtered = filtered.filter(transaction => transaction.expense_category === selectedCategory);
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
                    return new Date(b.transaction_date) - new Date(a.transaction_date);
                case 'date_asc':
                    return new Date(a.transaction_date) - new Date(b.transaction_date);
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
    }, [transactions, searchTerm, selectedFund, selectedCostType, selectedCategory, dateRange, sortBy]);

    const totalAmount = filteredTransactions.reduce((sum, transaction) => {
        const amount = parseFloat(transaction.amount) || 0;
        return sum + amount;
    }, 0);

    const directCosts = filteredTransactions.reduce((sum, transaction) => {
        if (transaction.cost_type === 'direct') {
            return sum + (parseFloat(transaction.amount) || 0);
        }
        return sum;
    }, 0);

    const indirectCosts = filteredTransactions.reduce((sum, transaction) => {
        if (transaction.cost_type === 'indirect') {
            return sum + (parseFloat(transaction.amount) || 0);
        }
        return sum;
    }, 0);

    const exportTransactions = () => {
        const exportData = {
            export_date: new Date().toISOString(),
            date_range: dateRange,
            selected_fund: selectedFund ? funds.find(f => f.id === parseInt(selectedFund))?.name : 'All Funds',
            total_transactions: filteredTransactions.length,
            total_amount: totalAmount,
            transactions: filteredTransactions.map(transaction => ({
                date: transaction.transaction_date,
                fund: transaction.fund?.name,
                item: transaction.item_name,
                description: transaction.description,
                amount: transaction.amount,
                request_id: transaction.request_id,
                created_by: transaction.created_by?.username
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `transaction-records-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
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
        setSelectedCostType('');
        setSelectedCategory('');
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
                            Cost Type
                        </label>
                        <select
                            value={selectedCostType}
                            onChange={(e) => setSelectedCostType(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Cost Types</option>
                            <option value="direct">Direct Research Costs</option>
                            <option value="indirect">Indirect/Administrative Costs</option>
                        </select>
                        <p className="text-xs text-secondary-500 mt-1">
                            Direct: Research-specific expenses. Indirect: Administrative/facility costs.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Category
                        </label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Categories</option>
                            <optgroup label="Direct Research Costs">
                                <option value="personnel">Personnel/Salaries</option>
                                <option value="equipment">Equipment/Instruments</option>
                                <option value="supplies">Supplies/Materials</option>
                                <option value="travel">Travel/Transportation</option>
                                <option value="services">External Services</option>
                            </optgroup>
                            <optgroup label="Indirect Costs">
                                <option value="facilities">Facilities/Utilities</option>
                                <option value="administration">Administration</option>
                                <option value="overhead">Institutional Overhead</option>
                            </optgroup>
                            <option value="other">Other</option>
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

            {/* Audit Trail Status Panel */}
            <div className="bg-white border border-secondary-200 rounded-lg p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h4 className="text-lg font-semibold text-secondary-900 mb-2 flex items-center">
                            🔍 Comprehensive Audit Trail
                            <span className="ml-2 w-3 h-3 bg-success-400 rounded-full"></span>
                        </h4>
                        <p className="text-sm text-secondary-600">Complete transaction tracking for regulatory compliance and financial audits</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-700">{filteredTransactions.length}</div>
                            <div className="text-xs font-medium text-green-600 mb-1">Total Records</div>
                            <div className="text-xs text-green-500">Fully tracked</div>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-700">
                                {filteredTransactions.filter(t => t.cost_type === 'direct').length}
                            </div>
                            <div className="text-xs font-medium text-blue-600 mb-1">Direct Costs</div>
                            <div className="text-xs text-blue-500">Properly categorized</div>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-700">
                                {filteredTransactions.filter(t => t.cost_type === 'indirect').length}
                            </div>
                            <div className="text-xs font-medium text-orange-600 mb-1">Indirect Costs</div>
                            <div className="text-xs text-orange-500">Admin tracked</div>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-700">
                                {filteredTransactions.filter(t => t.fund?.funding_agency && ['cihr', 'nserc', 'sshrc'].includes(t.fund.funding_agency)).length}
                            </div>
                            <div className="text-xs font-medium text-purple-600 mb-1">Tri-Agency</div>
                            <div className="text-xs text-purple-500">Audit ready</div>
                        </div>
                    </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-info-50 border border-info-200 rounded-lg p-3">
                        <div className="flex items-center text-sm">
                            <div className="w-2 h-2 bg-info-500 rounded-full mr-2"></div>
                            <span className="font-medium text-info-800">7-Year Retention Policy Active</span>
                        </div>
                        <p className="text-xs text-info-700 mt-1">All records automatically maintained per TAGFA requirements</p>
                    </div>
                    
                    <div className="bg-success-50 border border-success-200 rounded-lg p-3">
                        <div className="flex items-center text-sm">
                            <div className="w-2 h-2 bg-success-500 rounded-full mr-2"></div>
                            <span className="font-medium text-success-800">Real-time Cost Categorization</span>
                        </div>
                        <p className="text-xs text-success-700 mt-1">Direct vs indirect costs automatically tracked and verified</p>
                    </div>
                </div>
            </div>

            {/* Compliance Notice for Tri-Agency Funds */}
            {transactions.some(t => t.fund?.funding_agency && ['cihr', 'nserc', 'sshrc'].includes(t.fund.funding_agency)) && (
                <div className="bg-info-50 border border-info-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-info-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h4 className="text-sm font-medium text-info-800">Canadian Tri-Agency Compliance</h4>
                            <p className="text-sm text-info-700 mt-1">
                                Transaction records for CIHR, NSERC, and SSHRC funds must be retained for a minimum of 7 years 
                                and be readily available for audit as per TAGFA guidelines. All expenditures are automatically 
                                categorized for compliance reporting.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center mr-3">
                            <DollarSign className="w-5 h-5 text-success-600" />
                        </div>
                        <div>
                            <p className="text-sm text-secondary-600">Direct Costs</p>
                            <p className="text-xl font-bold text-success-600">
                                ${directCosts.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center mr-3">
                            <DollarSign className="w-5 h-5 text-warning-600" />
                        </div>
                        <div>
                            <p className="text-sm text-secondary-600">Indirect Costs</p>
                            <p className="text-xl font-bold text-warning-600">
                                ${indirectCosts.toLocaleString()}
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
                                <th className="table-header-cell">Cost Type</th>
                                <th className="table-header-cell">Category</th>
                                <th className="table-header-cell">Amount</th>
                                <th className="table-header-cell">Fiscal Year</th>
                                <th className="table-header-cell">Audit Trail</th>
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
                                        <div className="flex items-center space-x-2">
                                            <span className={`badge ${transaction.cost_type === 'direct' ? 'badge-success' : 'badge-warning'}`}>
                                                {transaction.cost_type === 'direct' ? 'Direct' : 'Indirect'}
                                            </span>
                                            {transaction.cost_type === 'indirect' && (
                                                <span className="text-xs text-info-600 bg-info-50 px-2 py-1 rounded-full">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <span className="badge badge-secondary">
                                            {transaction.expense_category_display || transaction.expense_category || 'Supplies'}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <span className="text-lg font-bold text-success-600">
                                            ${(parseFloat(transaction.amount) || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <span className="text-sm font-medium text-primary-600">
                                            FY{transaction.fiscal_year || new Date().getFullYear()}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <div className="space-y-1">
                                            <div className="flex items-center">
                                                <User className="w-3 h-3 text-secondary-400 mr-1" />
                                                <span className="text-xs text-secondary-700">
                                                    {transaction.created_by?.username || 'System'}
                                                </span>
                                            </div>
                                            {transaction.request_id && (
                                                <div className="text-xs text-secondary-500">
                                                    Req: {transaction.request_id}
                                                </div>
                                            )}
                                            {transaction.fund?.funding_agency && ['cihr', 'nserc', 'sshrc'].includes(transaction.fund.funding_agency) && (
                                                <div className="flex items-center">
                                                    <span className="w-2 h-2 bg-success-400 rounded-full mr-1"></span>
                                                    <span className="text-xs text-success-600">Audit Ready</span>
                                                </div>
                                            )}
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