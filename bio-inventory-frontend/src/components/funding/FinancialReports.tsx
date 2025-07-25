import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, Filter, TrendingUp, 
  DollarSign, Clock, Users, BarChart3, PieChart,
  AlertTriangle, CheckCircle, Eye, Printer
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts';

interface ReportData {
  monthly_summary: Array<{
    month: string;
    total_spent: number;
    transaction_count: number;
    active_funds: number;
  }>;
  fund_utilization: Array<{
    fund_name: string;
    fund_id: string;
    utilization_rate: number;
    total_budget: number;
    spent_amount: number;
    days_remaining: number;
  }>;
  agency_performance: Array<{
    agency_name: string;
    total_budget: number;
    total_spent: number;
    fund_count: number;
    avg_utilization: number;
  }>;
  expense_categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  upcoming_deadlines: Array<{
    fund_name: string;
    fund_id: string;
    end_date: string;
    days_remaining: number;
    remaining_budget: number;
  }>;
}

interface FinancialReportsProps {
  token: string;
}

const FinancialReports: React.FC<FinancialReportsProps> = ({ token }) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('overview');
  const [dateRange, setDateRange] = useState('last_12_months');
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, selectedAgencies]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/enhanced-funds/financial_reports/?range=${dateRange}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Failed to fetch report data:', error);
      // Set null instead of mock data - let the UI handle the error state
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return formatCurrency(amount);
  };

  const generatePDFReport = () => {
    // Implementation for PDF generation would go here
    console.log('Generating PDF report...');
  };

  const exportToExcel = () => {
    // Implementation for Excel export would go here
    console.log('Exporting to Excel...');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Generating Financial Reports...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Report Generation Failed</h3>
        <p className="text-gray-600">Unable to generate financial reports at this time.</p>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="financial-reports space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Reports</h1>
            <p className="text-gray-600">
              Comprehensive financial analysis and reporting for McGill University Biology Lab
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="last_3_months">Last 3 Months</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="last_12_months">Last 12 Months</option>
              <option value="current_year">Current Year</option>
              <option value="all_time">All Time</option>
            </select>
            <button
              onClick={generatePDFReport}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF Report
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Report Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'utilization', name: 'Fund Utilization', icon: TrendingUp },
              { id: 'agencies', name: 'Agency Performance', icon: Users },
              { id: 'expenses', name: 'Expense Analysis', icon: PieChart },
              { id: 'deadlines', name: 'Upcoming Deadlines', icon: Clock }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`${
                  activeReport === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Report Content */}
        <div className="p-6">
          {activeReport === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Monthly Spending Overview</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={reportData.monthly_summary}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={(value) => value.split('-')[1] + '/' + value.split('-')[0].slice(-2)}
                    />
                    <YAxis 
                      yAxisId="amount"
                      orientation="left"
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <YAxis 
                      yAxisId="count"
                      orientation="right"
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'total_spent' ? formatCurrency(Number(value)) : value,
                        name === 'total_spent' ? 'Total Spent' : name === 'transaction_count' ? 'Transactions' : 'Active Funds'
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="amount" dataKey="total_spent" fill="#3B82F6" name="Total Spent" />
                    <Bar yAxisId="count" dataKey="transaction_count" fill="#10B981" name="Transactions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeReport === 'utilization' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Fund Utilization Analysis</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fund Information
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Budget Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Utilization Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.fund_utilization.map((fund, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{fund.fund_name}</div>
                            <div className="text-sm text-gray-500">{fund.fund_id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(fund.spent_amount)} / {formatCurrency(fund.total_budget)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3 max-w-[100px]">
                              <div 
                                className={`h-2 rounded-full ${
                                  fund.utilization_rate >= 90 ? 'bg-red-500' :
                                  fund.utilization_rate >= 70 ? 'bg-orange-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(fund.utilization_rate, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{fund.utilization_rate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${fund.days_remaining < 60 ? 'text-red-600' : 'text-gray-900'}`}>
                            {fund.days_remaining} days
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'agencies' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Funding Agency Performance</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Budget by Agency</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.agency_performance} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatCompactCurrency(value)} />
                      <YAxis type="category" dataKey="agency_name" width={120} tick={{fontSize: 10}} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="total_budget" fill="#3B82F6" name="Total Budget" />
                      <Bar dataKey="total_spent" fill="#10B981" name="Total Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Agency Summary</h3>
                  <div className="space-y-4">
                    {reportData.agency_performance.map((agency, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                        <h4 className="font-medium text-gray-900 text-sm mb-2">{agency.agency_name}</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Total Budget:</span>
                            <div className="font-medium">{formatCurrency(agency.total_budget)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Avg. Utilization:</span>
                            <div className="font-medium">{agency.avg_utilization.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'expenses' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Expense Category Analysis</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Expense Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={reportData.expense_categories}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({category, percentage}) => `${category} (${percentage.toFixed(1)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {reportData.expense_categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
                  <div className="space-y-3">
                    {reportData.expense_categories.map((category, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">{category.category}</span>
                          <span className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1">
                          <div className="text-lg font-bold text-gray-900">{formatCurrency(category.amount)}</div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${category.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'deadlines' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Fund Deadlines</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">
                    {reportData.upcoming_deadlines.length} funds require attention within the next 120 days
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportData.upcoming_deadlines.map((fund, index) => (
                  <div key={index} className={`bg-white rounded-lg border-2 p-6 ${
                    fund.days_remaining < 30 ? 'border-red-200 bg-red-50' : 
                    fund.days_remaining < 60 ? 'border-orange-200 bg-orange-50' : 
                    'border-yellow-200 bg-yellow-50'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{fund.fund_name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        fund.days_remaining < 30 ? 'bg-red-100 text-red-800' :
                        fund.days_remaining < 60 ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {fund.days_remaining} days left
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fund ID:</span>
                        <span className="font-medium">{fund.fund_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">End Date:</span>
                        <span className="font-medium">{new Date(fund.end_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Remaining Budget:</span>
                        <span className="font-medium">{formatCurrency(fund.remaining_budget)}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-2">
                      <button className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                        View Details
                      </button>
                      <button className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
                        Generate Alert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialReports;