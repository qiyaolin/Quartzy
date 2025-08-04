import React, { useState, useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, DollarSign, AlertTriangle, Target } from 'lucide-react';
import { exportMultiSheetExcel } from '../../utils/excelExport';

const BudgetReports = ({ funds, transactions, budgetSummary, token }) => {
    const [selectedPeriod, setSelectedPeriod] = useState('6months');
    const [selectedFund, setSelectedFund] = useState('');

    const reportData = useMemo(() => {
        // Calculate spending trends
        const endDate = new Date();
        let startDate = new Date();
        
        switch (selectedPeriod) {
            case '1month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case '3months':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case '6months':
                startDate.setMonth(startDate.getMonth() - 6);
                break;
            case '1year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(startDate.getMonth() - 6);
        }

        // Filter transactions by period and fund
        const filteredTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.transaction_date || transaction.date);
            const inPeriod = transactionDate >= startDate && transactionDate <= endDate;
            const inFund = selectedFund ? transaction.fund?.id === parseInt(selectedFund) : true;
            return inPeriod && inFund;
        });

        // Group by month for spending trends
        const monthlySpending = {};
        filteredTransactions.forEach(transaction => {
            const monthKey = new Date(transaction.transaction_date || transaction.date).toISOString().slice(0, 7);
            const amount = parseFloat(transaction.amount || 0);
            monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + amount;
        });

        // Convert to array for chart
        const spendingTrend = Object.entries(monthlySpending)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => ({
                month: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                amount: Number(amount)
            }));

        // Calculate fund utilization
        const activeFunds = selectedFund 
            ? funds.filter(fund => fund.id === parseInt(selectedFund))
            : funds.filter(fund => !fund.is_archived);

        const fundUtilization = activeFunds.map(fund => {
            const fundTransactions = filteredTransactions.filter(t => t.fund?.id === fund.id);
            const spent = fundTransactions.reduce((sum, t) => sum + (parseFloat(t.amount || 0)), 0);
            const totalBudget = parseFloat(fund.total_budget || 0);
            const utilization = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
            
            return {
                fund: fund.name,
                total_budget: totalBudget,
                spent,
                remaining: totalBudget - spent,
                utilization: Math.min(utilization, 100)
            };
        });

        return {
            spendingTrend,
            fundUtilization,
            totalSpent: filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.amount || 0)), 0),
            transactionCount: filteredTransactions.length
        };
    }, [funds, transactions, selectedPeriod, selectedFund]);

    const exportReport = () => {
        const now = new Date();
        
        // Summary data
        const summary = [
            { 'Metric': 'Report Generated', 'Value': now.toLocaleDateString() },
            { 'Metric': 'Total Transactions', 'Value': reportData.transactionCount },
            { 'Metric': 'Total Spent', 'Value': `$${reportData.totalSpent.toLocaleString()}` },
            { 'Metric': 'Funds Analyzed', 'Value': reportData.fundUtilization.length },
            { 'Metric': 'Period', 'Value': selectedPeriod.replace(/(\d)([a-z])/, '$1 $2') },
            { 'Metric': 'Selected Fund', 'Value': selectedFund ? funds.find(f => f.id === parseInt(selectedFund))?.name : 'All Funds' }
        ];

        // Spending trend data
        const spendingData = reportData.spendingTrend.map(item => ({
            'Month': item.month,
            'Amount Spent': `$${item.amount.toFixed(2)}`
        }));

        // Fund utilization data
        const utilizationData = reportData.fundUtilization.map(item => ({
            'Fund Name': item.fund,
            'Total Budget': `$${item.total_budget.toFixed(2)}`,
            'Amount Spent': `$${item.spent.toFixed(2)}`,
            'Remaining Budget': `$${item.remaining.toFixed(2)}`,
            'Utilization Rate': `${item.utilization.toFixed(1)}%`,
            'Status': item.utilization >= 90 ? 'Critical' : item.utilization >= 75 ? 'Warning' : 'Healthy'
        }));

        // Budget summary data from props
        const budgetSummaryData = budgetSummary ? Object.entries(budgetSummary).map(([key, value]) => ({
            'Summary Item': key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            'Amount': typeof value === 'number' ? `$${value.toLocaleString()}` : value
        })) : [];

        const sheets = [
            {
                name: 'Summary',
                title: 'Budget Report Summary',
                data: summary
            },
            {
                name: 'Spending Trend',
                title: 'Monthyl Spending Trend',
                data: spendingData
            },
            {
                name: 'Fund Utilization',
                title: 'Fund Utilization Report',
                data: utilizationData
            }
        ];

        if (budgetSummaryData.length > 0) {
            sheets.push({
                name: 'Budget Overview',
                title: 'Overall Budget Summary',
                data: budgetSummaryData
            });
        }

        exportMultiSheetExcel({
            fileName: 'budget-report',
            summary: summary,
            sheets: sheets
        });
    };

    const getUtilizationColor = (utilization) => {
        if (utilization >= 90) return 'text-red-600';
        if (utilization >= 75) return 'text-yellow-600';
        return 'text-green-600';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Budget Reports</h2>
                    <p className="text-gray-600">Analyze spending trends and fund utilization</p>
                </div>
                <button
                    onClick={exportReport}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Time Period
                        </label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="1month">Last Month</option>
                            <option value="3months">Last 3 Months</option>
                            <option value="6months">Last 6 Months</option>
                            <option value="1year">Last Year</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fund
                        </label>
                        <select
                            value={selectedFund}
                            onChange={(e) => setSelectedFund(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="">All Funds</option>
                            {funds.filter(fund => !fund.is_archived).map(fund => (
                                <option key={fund.id} value={fund.id}>
                                    {fund.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Spent</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                ${reportData.totalSpent.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Transactions</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {reportData.transactionCount}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Target className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Active Funds</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {reportData.fundUtilization.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Spending Trend */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Spending Trend</h3>
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-4">
                        {reportData.spendingTrend.slice(-6).map((item, index) => {
                            const maxAmount = Math.max(...reportData.spendingTrend.map(i => i.amount));
                            const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                            
                            return (
                                <div key={index} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">
                                            {item.month}
                                        </span>
                                        <span className="text-sm font-bold text-green-600">
                                            ${(item.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                            className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Fund Utilization */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Fund Utilization</h3>
                        <PieChart className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-6">
                        {reportData.fundUtilization.map((fund, index) => (
                            <div key={index} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h5 className="font-medium text-gray-900">{fund.fund}</h5>
                                        <p className="text-sm text-gray-600">
                                            ${(fund.spent || 0).toLocaleString()} of ${(fund.total_budget || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-bold ${getUtilizationColor(fund.utilization)}`}>
                                            {fund.utilization.toFixed(1)}%
                                        </span>
                                        {fund.utilization >= 90 && (
                                            <AlertTriangle className="w-4 h-4 text-red-500 inline ml-1" />
                                        )}
                                    </div>
                                </div>
                                
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-300 ${
                                            fund.utilization >= 90 
                                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                                : fund.utilization >= 75
                                                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                                                : 'bg-gradient-to-r from-green-500 to-green-600'
                                        }`}
                                        style={{ width: `${Math.min(fund.utilization, 100)}%` }}
                                    ></div>
                                </div>
                                
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Remaining: ${(fund.remaining || 0).toLocaleString()}</span>
                                    <span>
                                        {fund.utilization >= 90 ? 'Critical' : 
                                         fund.utilization >= 75 ? 'Warning' : 'Healthy'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetReports;