import React, { useState, useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, DollarSign, AlertTriangle, Target } from 'lucide-react';

const BudgetReports = ({ funds, transactions, budgetSummary, token }) => {
    const [selectedPeriod, setSelectedPeriod] = useState('6months');
    const [selectedFund, setSelectedFund] = useState('');
    const [form300Data, setForm300Data] = useState(null);
    const [showForm300Modal, setShowForm300Modal] = useState(false);
    const [form300FiscalYear, setForm300FiscalYear] = useState(new Date().getFullYear());
    const [selectedTriAgencyFunds, setSelectedTriAgencyFunds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [multiyearLoading, setMultiyearLoading] = useState(false);
    const [multiyearData, setMultiyearData] = useState(null);
    const [showMultiyearModal, setShowMultiyearModal] = useState(false);
    const [multiyearStartYear, setMultiyearStartYear] = useState(new Date().getFullYear() - 2);
    const [multiyearEndYear, setMultiyearEndYear] = useState(new Date().getFullYear());

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
        // Create human-readable CSV format
        const csvData = [
            ['Budget Analysis Report'],
            [`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`],
            [`Analysis Period: ${selectedPeriod.replace('1month', 'Last Month').replace('3months', 'Last 3 Months').replace('6months', 'Last 6 Months').replace('1year', 'Last Year')}`],
            [`Fund Focus: ${selectedFund ? funds.find(f => f.id === parseInt(selectedFund))?.name : 'All Active Funds'}`],
            [],
            ['EXECUTIVE SUMMARY'],
            [`Total Amount Spent: $${reportData.totalSpent.toLocaleString()}`],
            [`Total Transactions: ${reportData.transactionCount}`],
            [`Funds Analyzed: ${reportData.fundUtilization.length}`],
            [`Average per Transaction: $${reportData.transactionCount > 0 ? (reportData.totalSpent / reportData.transactionCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}`],
            [],
            ['SPENDING TREND BY MONTH'],
            ['Month', 'Amount Spent'],
            ...reportData.spendingTrend.map(item => [
                item.month,
                `$${parseFloat(item.amount).toLocaleString()}`
            ]),
            [],
            ['FUND UTILIZATION ANALYSIS'],
            ['Fund Name', 'Total Budget', 'Amount Spent', 'Remaining Budget', 'Utilization %', 'Status'],
            ...reportData.fundUtilization.map(fund => [
                fund.fund,
                `$${parseFloat(fund.total_budget).toLocaleString()}`,
                `$${parseFloat(fund.spent).toLocaleString()}`,
                `$${parseFloat(fund.remaining).toLocaleString()}`,
                `${fund.utilization.toFixed(1)}%`,
                fund.utilization >= 90 ? 'Critical' : 
                fund.utilization >= 75 ? 'Warning' : 'Healthy'
            ]),
            [],
            ['BUDGET ALERTS'],
            ...reportData.fundUtilization
                .filter(fund => fund.utilization >= 75)
                .map(fund => [`${fund.fund}: ${fund.utilization.toFixed(1)}% utilized ${fund.utilization >= 90 ? '(CRITICAL - Consider budget reallocation)' : '(WARNING - Monitor spending closely)'}`]),
            [],
            ['BUDGET HEALTH INDICATORS'],
            [`Funds Near Limit (≥90%): ${reportData.fundUtilization.filter(f => f.utilization >= 90).length}`],
            [`Funds at Warning Level (75-89%): ${reportData.fundUtilization.filter(f => f.utilization >= 75 && f.utilization < 90).length}`],
            [`Healthy Funds (<75%): ${reportData.fundUtilization.filter(f => f.utilization < 75).length}`],
            [`Funds Over Budget: ${reportData.fundUtilization.filter(f => parseFloat(f.remaining) < 0).length}`],
            [],
            ['REPORT METHODOLOGY'],
            ['This report analyzes financial data for the selected time period and funds.'],
            ['Utilization percentages are calculated as: (Amount Spent / Total Budget) × 100'],
            ['Status levels: Healthy (<75%), Warning (75-89%), Critical (≥90%)'],
            ['All amounts are displayed in the system\'s base currency.'],
            [],
            ['For questions about this report, please contact your financial administrator.']
        ];

        // Convert to CSV format
        const csvContent = csvData.map(row => 
            Array.isArray(row) 
                ? row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                : `"${String(row).replace(/"/g, '""')}"`
        ).join('\n');

        // Add UTF-8 BOM for proper Excel compatibility
        const dataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);
        const exportFileDefaultName = `budget-analysis-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const exportMultiyearReport = () => {
        if (!multiyearData) return;
        
        // Create comprehensive multi-year CSV report
        const csvData = [
            ['Multi-Year Fiscal Summary Report'],
            [`Report Period: ${multiyearData.multiyear_data.report_period}`],
            [`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`],
            [`Funds Analyzed: ${multiyearData.multiyear_data.funds_analyzed}`],
            [],
            ['MULTI-YEAR OVERVIEW'],
            ['Fiscal Year', 'Total Budget', 'Total Spent', 'Total Remaining', 'Overall Utilization %', 'Direct Costs', 'Indirect Costs'],
            ...multiyearData.multiyear_data.fiscal_years.map(year => [
                `FY${year.fiscal_year}`,
                `$${year.totals.total_budget.toLocaleString()}`,
                `$${year.totals.total_spent.toLocaleString()}`,
                `$${year.totals.total_remaining.toLocaleString()}`,
                `${year.totals.overall_utilization.toFixed(1)}%`,
                `$${year.totals.direct_costs.toLocaleString()}`,
                `$${year.totals.indirect_costs.toLocaleString()}`
            ]),
            []
        ];
        
        // Add detailed breakdown for each fiscal year
        multiyearData.multiyear_data.fiscal_years.forEach(year => {
            csvData.push(
                [`FISCAL YEAR ${year.fiscal_year} - DETAILED BREAKDOWN`],
                ['Fund Name', 'Funding Agency', 'Grant Year', 'Total Years', 'Annual Budget', 'Year Spending', 'Unspent Amount', 'Utilization %', 'Direct Costs', 'Indirect Costs', 'Carry-over Requests'],
                ...year.funds.map(fund => [
                    fund.fund_name,
                    fund.funding_agency || 'N/A',
                    fund.current_year || 'N/A',
                    fund.total_years || 'N/A',
                    `$${fund.annual_budget.toLocaleString()}`,
                    `$${fund.year_spending.toLocaleString()}`,
                    `$${fund.unspent_amount.toLocaleString()}`,
                    `${fund.utilization_percentage.toFixed(1)}%`,
                    `$${fund.direct_costs.toLocaleString()}`,
                    `$${fund.indirect_costs.toLocaleString()}`,
                    fund.carry_over_requests
                ]),
                []
            );
        });
        
        csvData.push(
            ['REPORT NOTES'],
            ['This multi-year report shows fiscal performance across multiple years'],
            ['for funds with grant durations longer than one year.'],
            ['Utilization percentages show annual spending relative to annual budget.'],
            ['Carry-over requests indicate funds transferred between fiscal years.'],
            ['Direct costs include research-related expenses; indirect costs include overhead.']
        );

        // Convert to CSV format
        const csvContent = csvData.map(row => 
            Array.isArray(row) 
                ? row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                : `"${String(row).replace(/"/g, '""')}"`
        ).join('\n');

        // Add UTF-8 BOM for proper Excel compatibility
        const dataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);
        const exportFileDefaultName = `multiyear-summary-FY${multiyearStartYear}-FY${multiyearEndYear}-${new Date().toISOString().split('T')[0]}.csv`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
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

    const generateForm300Report = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/reports/generate_form300/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    fiscal_year: form300FiscalYear,
                    fund_ids: selectedTriAgencyFunds.length > 0 ? selectedTriAgencyFunds : undefined
                })
            }).catch(() => ({ ok: false, status: 404 }));

            if (response.ok) {
                const data = await response.json();
                setForm300Data(data);
                setShowForm300Modal(false);
                alert('Form 300 report generated successfully!');
            } else {
                const errorData = await response.json().catch(() => ({ error: 'API not available' }));
                alert(`Failed to generate Form 300 report: ${errorData.error || 'API endpoint not available'}. Please create some Tri-Agency funds first using the Fund Management tab.`);
                console.error('Failed to generate Form 300 report');
            }
        } catch (error) {
            alert(`Error generating Form 300 report: ${error.message}`);
            console.error('Error generating Form 300 report:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateMultiyearReport = async () => {
        setMultiyearLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/reports/generate_multiyear_summary/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    start_fiscal_year: multiyearStartYear,
                    end_fiscal_year: multiyearEndYear
                })
            }).catch(() => ({ ok: false, status: 404 }));

            if (response.ok) {
                const data = await response.json();
                setMultiyearData(data);
                setShowMultiyearModal(false);
                alert('Multi-Year Summary report generated successfully!');
            } else {
                const errorData = await response.json().catch(() => ({ error: 'API not available' }));
                alert(`Failed to generate Multi-Year Summary: ${errorData.error || 'API endpoint not available'}. Please create some multi-year grants first using the Fund Management tab.`);
                console.error('Failed to generate Multi-Year Summary');
            }
        } catch (error) {
            alert(`Error generating Multi-Year Summary: ${error.message}`);
            console.error('Error generating Multi-Year Summary:', error);
        } finally {
            setMultiyearLoading(false);
        }
    };

    const triAgencyFunds = useMemo(() => {
        return funds.filter(fund => 
            fund.funding_agency && [1,2,3].includes(fund.funding_agency)
        );
    }, [funds]);

    const exportForm300Report = () => {
        if (!form300Data) return;
        
        // Create Excel-compatible CSV format for Form 300
        const csvData = [
            ['Canadian Tri-Agency Form 300 - Grants in Aid of Research Statement of Account'],
            [`Fiscal Year: ${form300FiscalYear}`],
            [`Report Generated: ${new Date().toLocaleDateString()}`],
            [`Reporting Period: ${form300Data.form300_data?.reporting_period || 'Not specified'}`],
            [],
            ['DIRECT RESEARCH COSTS'],
            ['Category', 'Amount (CAD)'],
            ...Object.entries(form300Data.form300_data?.direct_costs || {}).map(([category, amount]) => [
                category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                `$${parseFloat(amount).toLocaleString()}`
            ]),
            ['TOTAL DIRECT COSTS', `$${parseFloat(form300Data.form300_data?.total_direct || 0).toLocaleString()}`],
            [],
            ['INDIRECT COSTS'],
            ['Category', 'Amount (CAD)'],
            ...Object.entries(form300Data.form300_data?.indirect_costs || {}).map(([category, amount]) => [
                category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                `$${parseFloat(amount).toLocaleString()}`
            ]),
            ['TOTAL INDIRECT COSTS', `$${parseFloat(form300Data.form300_data?.total_indirect || 0).toLocaleString()}`],
            [],
            ['GRAND TOTAL', `$${parseFloat(form300Data.form300_data?.grand_total || 0).toLocaleString()}`],
            [],
            ['AUDIT TRAIL COMPLIANCE'],
            [`Total Transactions: ${form300Data.transaction_count || 0}`],
            [`Earliest Transaction: ${form300Data.earliest_transaction || 'N/A'}`],
            [`Latest Transaction: ${form300Data.latest_transaction || 'N/A'}`],
            ['Retention Period: 7 years minimum as per TAGFA guidelines']
        ];

        const csvContent = csvData.map(row => 
            Array.isArray(row) ? row.map(cell => `"${cell}"`).join(',') : `"${row}"`
        ).join('\n');

        const dataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);
        const exportFileDefaultName = `TAGFA_Form300_FY${form300FiscalYear}_${new Date().toISOString().split('T')[0]}.csv`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div>
            {/* Standardized Reporting Dashboard */}
            <div className="bg-white border border-secondary-200 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="text-xl font-semibold text-secondary-900 mb-2">
                            📊 Standardized Financial Reports
                        </h4>
                        <p className="text-sm text-secondary-600">Generate compliance reports for funding agencies and audit requirements</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold text-sm">300</span>
                            </div>
                            <div>
                                <h5 className="font-semibold text-blue-900">TAGFA Form 300</h5>
                                <p className="text-xs text-blue-700">Grants in Aid Statement</p>
                            </div>
                        </div>
                        <p className="text-sm text-blue-800 mb-3">Official Canadian Tri-Agency financial reporting format with automated cost categorization and 7-year audit trail compliance.</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-blue-600">
                                {triAgencyFunds.length > 0 ? `${triAgencyFunds.length} funds available` : 'No Tri-Agency funds - create funds with CIHR/NSERC/SSHRC agencies'}
                            </span>
                            <button
                                onClick={() => setShowForm300Modal(true)}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                                disabled={triAgencyFunds.length === 0}
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold text-sm">📈</span>
                            </div>
                            <div>
                                <h5 className="font-semibold text-green-900">Budget Analysis</h5>
                                <p className="text-xs text-green-700">Comprehensive Report</p>
                            </div>
                        </div>
                        <p className="text-sm text-green-800 mb-3">Detailed spending analysis with direct/indirect cost breakdown, utilization rates, and fiscal year comparisons.</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-green-600">
                                {reportData.fundUtilization.length} funds analyzed
                            </span>
                            <button
                                onClick={exportReport}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                            >
                                Export
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h5 className="font-semibold text-purple-900">Multi-Year Summary</h5>
                                <p className="text-xs text-purple-700">Fiscal Year Report</p>
                            </div>
                        </div>
                        <p className="text-sm text-purple-800 mb-3">Track grant progress across multiple fiscal years with carry-over calculations and budget variance analysis.</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-purple-600">
                                {funds.filter(f => parseInt(f.grant_duration_years) > 1).length > 0 ? `${funds.filter(f => parseInt(f.grant_duration_years) > 1).length} multi-year grants` : 'No multi-year grants - create funds with duration > 1 year'}
                            </span>
                            <button
                                onClick={() => setShowMultiyearModal(true)}
                                className="px-3 py-1 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                                disabled={funds.filter(f => parseInt(f.grant_duration_years) > 1).length === 0}
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tri-Agency Compliance Section */}
            {triAgencyFunds.length > 0 && (
                <div className="bg-gradient-to-r from-primary-50 to-success-50 border border-primary-200 rounded-lg p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="text-lg font-semibold text-primary-900 mb-2">
                                Canadian Tri-Agency Compliance
                            </h4>
                            <p className="text-sm text-primary-700 mb-4">
                                Generate Form 300 reports and manage fiscal year compliance for CIHR, NSERC, and SSHRC funds.
                            </p>
                            <div className="flex items-center text-sm text-primary-600 mb-4">
                                <Target className="w-4 h-4 mr-2" />
                                <span>{triAgencyFunds.length} Tri-Agency fund(s) available</span>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setShowForm300Modal(true)}
                                className="btn btn-primary"
                            >
                                Generate Form 300
                            </button>
                            {form300Data && (
                                <button
                                    onClick={exportForm300Report}
                                    className="btn btn-secondary"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export Form 300
                                </button>
                            )}
                            {multiyearData && (
                                <button
                                    onClick={exportMultiyearReport}
                                    className="btn btn-secondary"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export Multi-Year Summary
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

            {/* Fiscal Year Tracking Section */}
            {funds.some(f => parseInt(f.grant_duration_years) > 1) && (
                <div className="bg-gradient-to-r from-secondary-50 to-primary-50 border border-secondary-200 rounded-lg p-6 mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h4 className="text-lg font-semibold text-secondary-900 mb-2">
                            Multi-Year Grant Tracking
                        </h4>
                            <p className="text-sm text-secondary-700 mb-4">
                                Monitor spending across fiscal years for multi-year grants with automatic carry-over calculations.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {funds.filter(f => parseInt(f.grant_duration_years) > 1).map(fund => (
                                    <div key={fund.id} className="bg-white rounded-lg p-3 shadow-sm">
                                        <h5 className="font-medium text-secondary-900 mb-1">{fund.name}</h5>
                                        <div className="text-xs text-secondary-600 space-y-1">
                                            <div>Year {fund.current_year} of {fund.grant_duration_years}</div>
                                            <div className="flex justify-between">
                                                <span>Annual Budget:</span>
                                                <span>${(fund.annual_budgets?.[fund.current_year] || (fund.total_budget / fund.grant_duration_years)).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Spent:</span>
                                                <span>${(fund.spent_amount || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-secondary-200 rounded-full h-2 mt-2">
                                            <div
                                                className="bg-primary-500 h-2 rounded-full"
                                                style={{ width: `${Math.min(((fund.spent_amount || 0) / (fund.annual_budgets?.[fund.current_year] || (fund.total_budget / fund.grant_duration_years))) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Multi-Year Summary Generation Modal */}
            {showMultiyearModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-secondary-200">
                            <h3 className="text-lg font-semibold text-secondary-900">
                                Generate Multi-Year Summary
                            </h3>
                            <p className="text-sm text-secondary-600 mt-1">
                                Analyze grant performance across fiscal years
                            </p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    Start Fiscal Year
                                </label>
                                <input
                                    type="number"
                                    value={multiyearStartYear}
                                    onChange={(e) => setMultiyearStartYear(parseInt(e.target.value))}
                                    className="input w-full"
                                    min="2020"
                                    max="2030"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    End Fiscal Year
                                </label>
                                <input
                                    type="number"
                                    value={multiyearEndYear}
                                    onChange={(e) => setMultiyearEndYear(parseInt(e.target.value))}
                                    className="input w-full"
                                    min="2020"
                                    max="2030"
                                />
                            </div>
                            <div className="mb-4">
                                <p className="text-xs text-secondary-500">
                                    This will analyze all multi-year grants (duration &gt; 1 year) within the selected fiscal year range.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-secondary-200 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowMultiyearModal(false)}
                                className="btn btn-secondary"
                                disabled={multiyearLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={generateMultiyearReport}
                                className="btn btn-primary"
                                disabled={multiyearLoading || multiyearStartYear > multiyearEndYear}
                            >
                                {multiyearLoading ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form 300 Generation Modal */}
            {showForm300Modal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-secondary-200">
                            <h3 className="text-lg font-semibold text-secondary-900">
                                Generate Form 300 Report
                            </h3>
                            <p className="text-sm text-secondary-600 mt-1">
                                Grants in Aid of Research Statement
                            </p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    Fiscal Year
                                </label>
                                <input
                                    type="number"
                                    value={form300FiscalYear}
                                    onChange={(e) => setForm300FiscalYear(parseInt(e.target.value))}
                                    className="input w-full"
                                    min="2020"
                                    max="2030"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    Select Funds (optional)
                                </label>
                                <div className="max-h-32 overflow-y-auto border border-secondary-200 rounded-lg p-2">
                                    {triAgencyFunds.map(fund => (
                                        <label key={fund.id} className="flex items-center py-1">
                                            <input
                                                type="checkbox"
                                                value={fund.id}
                                                checked={selectedTriAgencyFunds.includes(fund.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedTriAgencyFunds(prev => [...prev, fund.id]);
                                                    } else {
                                                        setSelectedTriAgencyFunds(prev => prev.filter(id => id !== fund.id));
                                                    }
                                                }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">{fund.name}</span>
                                            <span className="ml-auto text-xs text-secondary-500 capitalize">
                                                {AGENCY_MAP[fund.funding_agency]}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-secondary-500 mt-1">
                                    Leave empty to include all Tri-Agency funds
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-secondary-200 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowForm300Modal(false)}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={generateForm300Report}
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form 300 Results Display */}
            {form300Data && (
                <div className="bg-white rounded-lg shadow-soft border border-secondary-200 mt-6">
                    <div className="p-6 border-b border-secondary-200">
                        <h4 className="text-lg font-semibold text-secondary-900">
                            Form 300 Report - FY{form300FiscalYear}
                        </h4>
                        <p className="text-sm text-secondary-600">
                            {form300Data.form300_data?.reporting_period}
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h5 className="font-medium text-secondary-900 mb-3">Direct Research Costs</h5>
                                <div className="space-y-2">
                                    {form300Data.form300_data?.direct_costs && Object.entries(form300Data.form300_data.direct_costs).map(([category, amount]) => (
                                        <div key={category} className="flex justify-between text-sm">
                                            <span className="capitalize text-secondary-600">{category.replace('_', ' ')}</span>
                                            <span className="font-medium">${parseFloat(amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="border-t pt-2 flex justify-between font-medium">
                                        <span>Total Direct Costs</span>
                                        <span className="text-success-600">${parseFloat(form300Data.form300_data?.total_direct || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h5 className="font-medium text-secondary-900 mb-3">Indirect Costs</h5>
                                <div className="space-y-2">
                                    {form300Data.form300_data?.indirect_costs && Object.entries(form300Data.form300_data.indirect_costs).map(([category, amount]) => (
                                        <div key={category} className="flex justify-between text-sm">
                                            <span className="capitalize text-secondary-600">{category.replace('_', ' ')}</span>
                                            <span className="font-medium">${parseFloat(amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="border-t pt-2 flex justify-between font-medium">
                                        <span>Total Indirect Costs</span>
                                        <span className="text-warning-600">${parseFloat(form300Data.form300_data?.total_indirect || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-secondary-200">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-secondary-900">Grand Total</span>
                                <span className="text-xl font-bold text-primary-600">
                                    ${parseFloat(form300Data.form300_data?.grand_total || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Multi-Year Summary Results Display */}
            {multiyearData && (
                <div className="bg-white rounded-lg shadow-soft border border-secondary-200 mt-6">
                    <div className="p-6 border-b border-secondary-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="text-lg font-semibold text-secondary-900">
                                    Multi-Year Summary - {multiyearData.multiyear_data.report_period}
                                </h4>
                                <p className="text-sm text-secondary-600">
                                    {multiyearData.multiyear_data.funds_analyzed} funds analyzed across multiple fiscal years
                                </p>
                            </div>
                            <button
                                onClick={exportMultiyearReport}
                                className="btn btn-primary btn-sm"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export CSV
                            </button>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="space-y-6">
                            {multiyearData.multiyear_data.fiscal_years.map((year, index) => (
                                <div key={index} className="border border-secondary-200 rounded-lg">
                                    <div className="bg-secondary-50 p-4 border-b border-secondary-200">
                                        <h5 className="font-medium text-secondary-900">Fiscal Year {year.fiscal_year}</h5>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                            <div>
                                                <span className="text-secondary-600">Total Budget:</span>
                                                <div className="font-semibold text-primary-600">
                                                    ${year.totals.total_budget.toLocaleString()}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-secondary-600">Total Spent:</span>
                                                <div className="font-semibold text-success-600">
                                                    ${year.totals.total_spent.toLocaleString()}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-secondary-600">Remaining:</span>
                                                <div className="font-semibold text-warning-600">
                                                    ${year.totals.total_remaining.toLocaleString()}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-secondary-600">Utilization:</span>
                                                <div className="font-semibold">
                                                    {year.totals.overall_utilization.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid gap-3">
                                            {year.funds.map((fund, fundIndex) => (
                                                <div key={fundIndex} className="flex justify-between items-center p-3 bg-white rounded border border-secondary-100">
                                                    <div>
                                                        <h6 className="font-medium text-secondary-900">{fund.fund_name}</h6>
                                                        <p className="text-xs text-secondary-600">
                                                            {fund.funding_agency && <span className="capitalize">{AGENCY_MAP[fund.funding_agency]}</span>}
                                                            {fund.current_year && fund.total_years && (
                                                                <span className="ml-2">Year {fund.current_year} of {fund.total_years}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <div className="font-medium">
                                                            ${fund.year_spending.toLocaleString()} / ${fund.annual_budget.toLocaleString()}
                                                        </div>
                                                        <div className={`text-xs ${
                                                            fund.utilization_percentage >= 90 ? 'text-danger-600' :
                                                            fund.utilization_percentage >= 75 ? 'text-warning-600' : 'text-success-600'
                                                        }`}>
                                                            {fund.utilization_percentage.toFixed(1)}% utilized
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetReports;