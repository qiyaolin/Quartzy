import React, { useState, useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, DollarSign, AlertTriangle, Target } from 'lucide-react';
import { exportMultiSheetExcel } from '../../utils/excelExport.ts';

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
            const transactionDate = new Date(transaction.transaction_date);
            const inPeriod = transactionDate >= startDate && transactionDate <= endDate;
            const inFund = selectedFund ? transaction.fund?.id === parseInt(selectedFund) : true;
            return inPeriod && inFund;
        });

        // Group by month for spending trends
        const monthlySpending = {};
        filteredTransactions.forEach(transaction => {
            const monthKey = new Date(transaction.transaction_date).toISOString().slice(0, 7);
            const amount = parseFloat(transaction.amount) || 0;
            monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + amount;
        });

        // Convert to array for chart
        const spendingTrend = Object.entries(monthlySpending)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => ({
                month: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                amount
            }));

        // Calculate fund utilization
        const activeFunds = selectedFund 
            ? funds.filter(fund => fund.id === parseInt(selectedFund))
            : funds.filter(fund => !fund.is_archived);

        const fundUtilization = activeFunds.map(fund => {
            const fundTransactions = filteredTransactions.filter(t => t.fund?.id === fund.id);
            const spent = fundTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            const totalBudget = parseFloat(fund.total_budget) || 0;
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
            totalSpent: filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
            transactionCount: filteredTransactions.length
        };
    }, [funds, transactions, selectedPeriod, selectedFund]);

    const exportReport = () => {
        const now = new Date();
        
        // Summary data
        const summaryData = [
            { 'Metric': 'Total Spent', 'Value': `$${reportData.totalSpent.toFixed(2)}` },
            { 'Metric': 'Transaction Count', 'Value': reportData.transactionCount },
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
            'Status': item.utilization >= 90 ? 'Critical' : 
                     item.utilization >= 75 ? 'Warning' : 'Good'
        }));

        // Budget summary data if available
        const budgetSummaryData = budgetSummary ? [
            { 'Summary Item': 'Total Budget', 'Amount': `$${budgetSummary.total_budget || 0}` },
            { 'Summary Item': 'Total Spent', 'Amount': `$${budgetSummary.total_spent || 0}` },
            { 'Summary Item': 'Total Remaining', 'Amount': `$${budgetSummary.total_remaining || 0}` },
            { 'Summary Item': 'Active Funds', 'Amount': budgetSummary.active_funds || 0 }
        ] : [];

        const summary = {
            'Report Generated': now.toLocaleString('en-US'),
            'Time Period': selectedPeriod.replace(/(\d)([a-z])/, '$1 $2'),
            'Fund Filter': selectedFund ? funds.find(f => f.id === parseInt(selectedFund))?.name : 'All Funds',
            'Total Spent': `$${reportData.totalSpent.toFixed(2)}`,
            'Transaction Count': reportData.transactionCount,
            'Funds Analyzed': reportData.fundUtilization.length,
            'Average Monthly Spending': spendingData.length > 0 ? 
                `$${(reportData.totalSpent / spendingData.length).toFixed(2)}` : '$0.00'
        };

        const sheets = [
            {
                name: 'Summary',
                title: 'Budget Report Summary',
                data: summaryData
            },
            {
                name: 'Spending Trend',
                title: 'Monthly Spending Trend',
                data: spendingData
            },
            {
                name: 'Fund Utilization',
                title: 'Fund Utilization Analysis',
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
        if (utilization >= 90) return 'text-danger-600';
        if (utilization >= 75) return 'text-warning-600';
        return 'text-success-600';
    };

    const getProgressBarColor = (utilization) => {
        if (utilization >= 90) return 'bg-danger-500';
        if (utilization >= 75) return 'bg-warning-500';
        return 'bg-success-500';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-secondary-900">Budget Reports</h3>
                    <p className="text-sm text-secondary-600">Analyze spending patterns and fund utilization</p>
                </div>
                <button
                    onClick={exportReport}
                    className="btn btn-secondary flex items-center"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                </button>
            </div>

            {/* Report Filters */}
            <div className="bg-secondary-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Time Period
                        </label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="input w-full"
                        >
                            <option value="1month">Last Month</option>
                            <option value="3months">Last 3 Months</option>
                            <option value="6months">Last 6 Months</option>
                            <option value="1year">Last Year</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Fund Focus
                        </label>
                        <select
                            value={selectedFund}
                            onChange={(e) => setSelectedFund(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Active Funds</option>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-success-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Total Spent</p>
                            <p className="text-2xl font-bold text-success-600">
                                ${reportData.totalSpent.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <BarChart3 className="w-8 h-8 text-primary-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Transactions</p>
                            <p className="text-2xl font-bold text-primary-600">
                                {reportData.transactionCount}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <Target className="w-8 h-8 text-warning-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Avg per Transaction</p>
                            <p className="text-2xl font-bold text-warning-600">
                                ${reportData.transactionCount > 0 ? (reportData.totalSpent / reportData.transactionCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center">
                        <TrendingUp className="w-8 h-8 text-secondary-600 mr-3" />
                        <div>
                            <p className="text-sm text-secondary-600">Funds Analyzed</p>
                            <p className="text-2xl font-bold text-secondary-600">
                                {reportData.fundUtilization.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Spending Trend Chart */}
                <div className="bg-white p-6 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-secondary-900 flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2" />
                            Spending Trend
                        </h4>
                    </div>
                    <div className="space-y-4">
                        {reportData.spendingTrend.length > 0 ? (
                            reportData.spendingTrend.map((item, index) => {
                                const maxAmount = Math.max(...reportData.spendingTrend.map(d => d.amount));
                                const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                                
                                return (
                                    <div key={index} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-secondary-700">
                                                {item.month}
                                            </span>
                                            <span className="text-sm font-bold text-success-600">
                                                ${(parseFloat(item.amount) || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="w-full bg-secondary-200 rounded-full h-3">
                                            <div
                                                className="bg-gradient-to-r from-success-500 to-success-600 h-3 rounded-full transition-all duration-300"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8">
                                <BarChart3 className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                                <p className="text-secondary-600">No spending data for selected period</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fund Utilization */}
                <div className="bg-white p-6 rounded-lg shadow-soft border border-secondary-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-secondary-900 flex items-center">
                            <PieChart className="w-5 h-5 mr-2" />
                            Fund Utilization
                        </h4>
                    </div>
                    <div className="space-y-6">
                        {reportData.fundUtilization.map((fund, index) => (
                            <div key={index} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h5 className="font-medium text-secondary-900">{fund.fund}</h5>
                                        <p className="text-sm text-secondary-600">
                                            ${(parseFloat(fund.spent) || 0).toLocaleString()} of ${(parseFloat(fund.total_budget) || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-bold ${getUtilizationColor(fund.utilization)}`}>
                                            {fund.utilization.toFixed(1)}%
                                        </span>
                                        {fund.utilization >= 90 && (
                                            <AlertTriangle className="w-4 h-4 text-danger-500 inline ml-1" />
                                        )}
                                    </div>
                                </div>
                                
                                <div className="w-full bg-secondary-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(fund.utilization)}`}
                                        style={{ width: `${Math.min(fund.utilization, 100)}%` }}
                                    ></div>
                                </div>
                                
                                <div className="flex justify-between text-xs text-secondary-600">
                                    <span>Remaining: ${(parseFloat(fund.remaining) || 0).toLocaleString()}</span>
                                    <span>
                                        {fund.utilization >= 90 ? 'Critical' : 
                                         fund.utilization >= 75 ? 'Warning' : 'Healthy'}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {reportData.fundUtilization.length === 0 && (
                            <div className="text-center py-8">
                                <Target className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                                <p className="text-secondary-600">No fund data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Budget Alerts */}
            {reportData.fundUtilization.some(fund => fund.utilization >= 75) && (
                <div className="mt-8 bg-warning-50 border border-warning-200 rounded-lg p-6">
                    <div className="flex items-start">
                        <AlertTriangle className="w-6 h-6 text-warning-600 mr-3 mt-1" />
                        <div>
                            <h4 className="text-lg font-semibold text-warning-800 mb-2">Budget Alerts</h4>
                            <div className="space-y-2">
                                {reportData.fundUtilization
                                    .filter(fund => fund.utilization >= 75)
                                    .map((fund, index) => (
                                        <div key={index} className="text-sm text-warning-700">
                                            <strong>{fund.fund}</strong>: {fund.utilization.toFixed(1)}% utilized
                                            {fund.utilization >= 90 ? ' - Critical: Consider budget reallocation' : 
                                             fund.utilization >= 75 ? ' - Warning: Monitor spending closely' : ''}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetReports;