import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, Calendar, 
  PieChart, BarChart3, FileText, Settings, Plus,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  Download, Eye, Edit3, Filter, RefreshCw, Users,
  Target, Activity, Wallet, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from 'recharts';

interface FinancialStats {
  summary: {
    total_funds: number;
    total_budget: number;
    total_spent: number;
    total_committed: number;
    available_budget: number;
    overall_utilization: number;
    expiring_funds: number;
  };
  utilization_distribution: {
    under_50: number;
    '50_to_80': number;
    '80_to_95': number;
    over_95: number;
  };
  agency_breakdown: Array<{
    funding_agency__name: string;
    count: number;
    total_budget: number;
    total_spent: number;
  }>;
  monthly_spending_trend: Array<{
    month: string;
    total_spent: number;
    transaction_count: number;
  }>;
  alerts_count: number;
}

interface Fund {
  id: number;
  fund_id: string;
  name: string;
  total_budget: number;
  spent_amount: number;
  committed_amount: number;
  available_budget: number;
  utilization_rate: number;
  days_remaining: number;
  is_expiring_soon: boolean;
  status: string;
  funding_agency_name: string;
  pi_name: string;
}

interface FinancialDashboardProps {
  token: string;
}

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ token }) => {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('12months');
  const [refreshing, setRefreshing] = useState(false);
  const [showNewFundModal, setShowNewFundModal] = useState(false);
  const [showViewAllModal, setShowViewAllModal] = useState(false);
  const [showAgencyDetailsModal, setShowAgencyDetailsModal] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [showFundDetailsModal, setShowFundDetailsModal] = useState(false);

  useEffect(() => {
    fetchFinancialData();
  }, [selectedTimeRange]);

  const fetchFinancialData = async () => {
    setRefreshing(true);
    try {
      const [statsResponse, fundsResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/enhanced-funds/dashboard_stats/', {
          headers: { 'Authorization': `Token ${token}` }
        }),
        fetch('http://127.0.0.1:8000/api/enhanced-funds/', {
          headers: { 'Authorization': `Token ${token}` }
        })
      ]);

      if (!statsResponse.ok || !fundsResponse.ok) {
        throw new Error(`API Error: Stats ${statsResponse.status}, Funds ${fundsResponse.status}`);
      }

      const [statsData, fundsData] = await Promise.all([
        statsResponse.json(),
        fundsResponse.json()
      ]);

      setStats(statsData);
      setFunds(fundsData.results || fundsData);
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
      // Set empty states instead of mock data
      setStats(null);
      setFunds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const getUtilizationColor = (rate: number) => {
    if (rate >= 95) return 'text-red-600 bg-red-50 border-red-200';
    if (rate >= 80) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusBadge = (fund: Fund) => {
    if (fund.is_expiring_soon) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Expiring Soon</span>;
    }
    if (fund.utilization_rate > 90) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Budget Critical</span>;
    }
    if (fund.status === 'active') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">{fund.status}</span>;
  };

  const getSeverityIcon = (count: number) => {
    if (count > 5) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (count > 2) return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    if (count > 0) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const generateMonthlyExpenditureReport = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/enhanced-funds/monthly_expenditure_report/', {
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (response.ok) {
        const reportData = await response.json();
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Monthly Lab Expenditure Report - McGill Biology Lab</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #1f2937;
                  max-width: 1200px;
                  margin: 0 auto;
                  padding: 40px 20px;
                  background: #f9fafb;
                }
                .header {
                  background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 12px;
                  margin-bottom: 30px;
                  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.1);
                }
                .header h1 {
                  margin: 0 0 10px 0;
                  font-size: 2.5rem;
                  font-weight: 700;
                }
                .header p {
                  margin: 0;
                  opacity: 0.9;
                  font-size: 1.1rem;
                }
                .summary-cards {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
                }
                .card {
                  background: white;
                  border-radius: 12px;
                  padding: 25px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  border-left: 4px solid #3b82f6;
                }
                .card h3 {
                  margin: 0 0 10px 0;
                  color: #374151;
                  font-size: 0.9rem;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  font-weight: 600;
                }
                .card .value {
                  font-size: 2rem;
                  font-weight: 700;
                  color: #1f2937;
                  margin-bottom: 5px;
                }
                .monthly-section {
                  background: white;
                  border-radius: 12px;
                  padding: 30px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  margin-bottom: 30px;
                }
                .monthly-section h2 {
                  margin: 0 0 25px 0;
                  color: #1f2937;
                  font-size: 1.5rem;
                  font-weight: 600;
                  border-bottom: 2px solid #e5e7eb;
                  padding-bottom: 10px;
                }
                .month-item {
                  border: 1px solid #e5e7eb;
                  border-radius: 8px;
                  padding: 20px;
                  margin-bottom: 15px;
                  background: #f9fafb;
                }
                .month-header {
                  display: flex;
                  justify-content: between;
                  align-items: center;
                  margin-bottom: 15px;
                }
                .month-title {
                  font-size: 1.2rem;
                  font-weight: 600;
                  color: #1f2937;
                }
                .month-total {
                  font-size: 1.1rem;
                  font-weight: 700;
                  color: #059669;
                }
                .categories {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                  gap: 10px;
                  margin-top: 10px;
                }
                .category-item {
                  background: white;
                  padding: 10px 15px;
                  border-radius: 6px;
                  text-align: center;
                  border: 1px solid #d1d5db;
                }
                .category-name {
                  font-size: 0.8rem;
                  color: #6b7280;
                  margin-bottom: 5px;
                }
                .category-amount {
                  font-weight: 600;
                  color: #1f2937;
                }
                .footer {
                  text-align: center;
                  padding: 20px;
                  color: #6b7280;
                  font-size: 0.9rem;
                  margin-top: 40px;
                  border-top: 1px solid #e5e7eb;
                }
                @media (max-width: 768px) {
                  body { padding: 20px 15px; }
                  .header h1 { font-size: 2rem; }
                  .month-header { flex-direction: column; align-items: flex-start; }
                }
                @media print {
                  body { background: white; box-shadow: none; }
                  .card, .monthly-section { box-shadow: none; border: 1px solid #ddd; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Monthly Lab Expenditure Report</h1>
                <p>McGill University Biology Department • Period: ${reportData.period.start_date} to ${reportData.period.end_date}</p>
              </div>
              
              <div class="summary-cards">
                <div class="card">
                  <h3>Total Expenditure</h3>
                  <div class="value">${formatCurrency(reportData.summary.total_expenditure)}</div>
                </div>
                <div class="card">
                  <h3>Months Covered</h3>
                  <div class="value">${reportData.summary.months_covered}</div>
                </div>
                <div class="card">
                  <h3>Average Monthly Spending</h3>
                  <div class="value">${formatCurrency(reportData.summary.average_monthly_spending)}</div>
                </div>
              </div>
              
              <div class="monthly-section">
                <h2>Monthly Breakdown</h2>
                ${reportData.monthly_data.map(month => `
                  <div class="month-item">
                    <div class="month-header">
                      <div class="month-title">${new Date(month.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</div>
                      <div class="month-total">${formatCurrency(month.total_spent)} (${month.transaction_count} transactions)</div>
                    </div>
                    <div class="categories">
                      ${Object.entries(month.categories).map(([category, amount]) => `
                        <div class="category-item">
                          <div class="category-name">${category}</div>
                          <div class="category-amount">${formatCurrency(amount)}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
              
              <div class="footer">
                <p>Generated on ${new Date().toLocaleDateString()} • McGill University Biology Lab Financial Management System</p>
                <p>🤖 Generated with Claude Code</p>
              </div>
            </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Failed to generate monthly expenditure report:', error);
    }
  };

  const generateGrantUtilizationReport = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/enhanced-funds/grant_utilization_report/', {
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (response.ok) {
        const reportData = await response.json();
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Grant Utilization Report - McGill Biology Lab</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #1f2937;
                  max-width: 1400px;
                  margin: 0 auto;
                  padding: 40px 20px;
                  background: #f9fafb;
                }
                .header {
                  background: linear-gradient(135deg, #059669 0%, #047857 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 12px;
                  margin-bottom: 30px;
                  box-shadow: 0 4px 6px rgba(5, 150, 105, 0.1);
                }
                .header h1 {
                  margin: 0 0 10px 0;
                  font-size: 2.5rem;
                  font-weight: 700;
                }
                .header p {
                  margin: 0;
                  opacity: 0.9;
                  font-size: 1.1rem;
                }
                .summary-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
                }
                .summary-card {
                  background: white;
                  border-radius: 12px;
                  padding: 25px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  border-left: 4px solid #059669;
                }
                .summary-card h3 {
                  margin: 0 0 10px 0;
                  color: #374151;
                  font-size: 0.9rem;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  font-weight: 600;
                }
                .summary-card .value {
                  font-size: 2rem;
                  font-weight: 700;
                  color: #1f2937;
                  margin-bottom: 5px;
                }
                .grants-section {
                  background: white;
                  border-radius: 12px;
                  padding: 30px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  margin-bottom: 30px;
                }
                .grants-section h2 {
                  margin: 0 0 25px 0;
                  color: #1f2937;
                  font-size: 1.5rem;
                  font-weight: 600;
                  border-bottom: 2px solid #e5e7eb;
                  padding-bottom: 10px;
                }
                .grant-card {
                  border: 1px solid #e5e7eb;
                  border-radius: 12px;
                  padding: 25px;
                  margin-bottom: 20px;
                  background: #f9fafb;
                  transition: all 0.2s ease;
                }
                .grant-card:hover {
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                  transform: translateY(-2px);
                }
                .grant-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 20px;
                  flex-wrap: wrap;
                  gap: 15px;
                }
                .grant-title {
                  flex: 1;
                  min-width: 300px;
                }
                .grant-title h3 {
                  margin: 0 0 8px 0;
                  color: #1f2937;
                  font-size: 1.3rem;
                  font-weight: 600;
                  line-height: 1.3;
                }
                .grant-meta {
                  color: #6b7280;
                  font-size: 0.9rem;
                  margin-bottom: 5px;
                }
                .utilization-badge {
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: 600;
                  font-size: 0.9rem;
                  text-align: center;
                  min-width: 80px;
                }
                .util-high { background: #fee2e2; color: #dc2626; }
                .util-medium { background: #fef3c7; color: #d97706; }
                .util-low { background: #dcfce7; color: #16a34a; }
                .grant-stats {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 15px;
                  margin-bottom: 20px;
                }
                .stat-item {
                  background: white;
                  padding: 15px;
                  border-radius: 8px;
                  border: 1px solid #d1d5db;
                }
                .stat-label {
                  font-size: 0.8rem;
                  color: #6b7280;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .stat-value {
                  font-size: 1.1rem;
                  font-weight: 600;
                  color: #1f2937;
                }
                .progress-bar {
                  width: 100%;
                  height: 8px;
                  background: #e5e7eb;
                  border-radius: 4px;
                  overflow: hidden;
                  margin-top: 10px;
                }
                .progress-fill {
                  height: 100%;
                  transition: width 0.3s ease;
                }
                .category-breakdown {
                  margin-top: 15px;
                }
                .category-title {
                  font-size: 0.9rem;
                  font-weight: 600;
                  color: #374151;
                  margin-bottom: 10px;
                }
                .category-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                  gap: 8px;
                }
                .category-chip {
                  background: white;
                  padding: 8px 12px;
                  border-radius: 6px;
                  text-align: center;
                  border: 1px solid #d1d5db;
                  font-size: 0.8rem;
                }
                .footer {
                  text-align: center;
                  padding: 20px;
                  color: #6b7280;
                  font-size: 0.9rem;
                  margin-top: 40px;
                  border-top: 1px solid #e5e7eb;
                }
                @media (max-width: 768px) {
                  body { padding: 20px 15px; }
                  .header h1 { font-size: 2rem; }
                  .grant-header { flex-direction: column; }
                  .grant-stats { grid-template-columns: 1fr 1fr; }
                }
                @media print {
                  body { background: white; }
                  .grant-card { break-inside: avoid; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Grant Utilization Report</h1>
                <p>McGill University Biology Department • Comprehensive analysis of research grant performance</p>
              </div>
              
              <div class="summary-grid">
                <div class="summary-card">
                  <h3>Total Grants</h3>
                  <div class="value">${reportData.summary.total_grants}</div>
                </div>
                <div class="summary-card">
                  <h3>Total Budget</h3>
                  <div class="value">${formatCurrency(reportData.summary.total_budget)}</div>
                </div>
                <div class="summary-card">
                  <h3>Overall Utilization</h3>
                  <div class="value">${reportData.summary.overall_utilization.toFixed(1)}%</div>
                </div>
                <div class="summary-card">
                  <h3>High Utilization (>80%)</h3>
                  <div class="value">${reportData.summary.high_utilization_grants}</div>
                </div>
              </div>
              
              <div class="grants-section">
                <h2>Grant Performance Analysis</h2>
                ${reportData.grants.map(grant => {
                  const utilizationClass = grant.utilization_rate > 80 ? 'util-high' : 
                                         grant.utilization_rate > 50 ? 'util-medium' : 'util-low';
                  const progressColor = grant.utilization_rate > 80 ? '#dc2626' : 
                                      grant.utilization_rate > 50 ? '#d97706' : '#16a34a';
                  
                  return `
                  <div class="grant-card">
                    <div class="grant-header">
                      <div class="grant-title">
                        <h3>${grant.fund_name}</h3>
                        <div class="grant-meta">ID: ${grant.fund_id} • PI: ${grant.pi_name}</div>
                        <div class="grant-meta">Agency: ${grant.funding_agency}</div>
                        <div class="grant-meta">Duration: ${grant.start_date ? new Date(grant.start_date).toLocaleDateString() : 'N/A'} - ${grant.end_date ? new Date(grant.end_date).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div class="utilization-badge ${utilizationClass}">
                        ${grant.utilization_rate.toFixed(1)}%
                      </div>
                    </div>
                    
                    <div class="grant-stats">
                      <div class="stat-item">
                        <div class="stat-label">Total Budget</div>
                        <div class="stat-value">${formatCurrency(grant.total_budget)}</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-label">Amount Spent</div>
                        <div class="stat-value">${formatCurrency(grant.spent_amount)}</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-label">Available Budget</div>
                        <div class="stat-value">${formatCurrency(grant.available_budget)}</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-label">Days Remaining</div>
                        <div class="stat-value">${grant.days_remaining > 0 ? grant.days_remaining + ' days' : 'Expired'}</div>
                      </div>
                    </div>
                    
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${Math.min(grant.utilization_rate, 100)}%; background-color: ${progressColor};"></div>
                    </div>
                    
                    ${grant.category_breakdown && grant.category_breakdown.length > 0 ? `
                      <div class="category-breakdown">
                        <div class="category-title">Budget Allocation by Category</div>
                        <div class="category-grid">
                          ${grant.category_breakdown.map(cat => `
                            <div class="category-chip">
                              <div style="font-weight: 600;">${cat.category}</div>
                              <div>${formatCurrency(cat.spent)} / ${formatCurrency(cat.allocated)}</div>
                              <div style="color: #6b7280;">(${cat.utilization.toFixed(1)}%)</div>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}
                    
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 0.9rem; color: #6b7280;">
                      Recent Activity: ${formatCurrency(grant.recent_activity.last_90_days_spent)} spent in last 90 days (${grant.recent_activity.recent_transactions} transactions)
                    </div>
                  </div>
                `;
                }).join('')}
              </div>
              
              <div class="footer">
                <p>Generated on ${new Date().toLocaleDateString()} • McGill University Biology Lab Financial Management System</p>
                <p>🤖 Generated with Claude Code</p>
              </div>
            </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Failed to generate grant utilization report:', error);
    }
  };

  const generateDeadlineAlertsReport = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/enhanced-funds/deadline_alerts_report/', {
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (response.ok) {
        const reportData = await response.json();
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Grant Deadline Alerts Report - McGill Biology Lab</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #1f2937;
                  max-width: 1200px;
                  margin: 0 auto;
                  padding: 40px 20px;
                  background: #f9fafb;
                }
                .header {
                  background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 12px;
                  margin-bottom: 30px;
                  box-shadow: 0 4px 6px rgba(220, 38, 38, 0.1);
                }
                .header h1 {
                  margin: 0 0 10px 0;
                  font-size: 2.5rem;
                  font-weight: 700;
                }
                .header p {
                  margin: 0;
                  opacity: 0.9;
                  font-size: 1.1rem;
                }
                .alert-icon {
                  display: inline-block;
                  margin-right: 8px;
                }
                .summary-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
                }
                .summary-card {
                  background: white;
                  border-radius: 12px;
                  padding: 25px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  border-left: 4px solid #dc2626;
                }
                .summary-card h3 {
                  margin: 0 0 10px 0;
                  color: #374151;
                  font-size: 0.9rem;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  font-weight: 600;
                }
                .summary-card .value {
                  font-size: 2rem;
                  font-weight: 700;
                  color: #1f2937;
                  margin-bottom: 5px;
                }
                .alerts-section {
                  background: white;
                  border-radius: 12px;
                  padding: 30px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  margin-bottom: 30px;
                }
                .section-header {
                  display: flex;
                  align-items: center;
                  margin-bottom: 25px;
                  padding-bottom: 15px;
                  border-bottom: 2px solid #e5e7eb;
                }
                .section-header h2 {
                  margin: 0;
                  color: #1f2937;
                  font-size: 1.5rem;
                  font-weight: 600;
                  flex: 1;
                }
                .urgency-badge {
                  padding: 6px 12px;
                  border-radius: 16px;
                  font-size: 0.8rem;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .critical { background: #fee2e2; color: #dc2626; }
                .warning { background: #fef3c7; color: #d97706; }
                .info { background: #dbeafe; color: #2563eb; }
                .alert-card {
                  border-radius: 12px;
                  padding: 25px;
                  margin-bottom: 20px;
                  transition: all 0.2s ease;
                }
                .alert-card.critical {
                  background: #fef2f2;
                  border: 2px solid #fecaca;
                }
                .alert-card.warning {
                  background: #fffbeb;
                  border: 2px solid #fde68a;
                }
                .alert-card.info {
                  background: #eff6ff;
                  border: 2px solid #bfdbfe;
                }
                .alert-card:hover {
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                  transform: translateY(-2px);
                }
                .alert-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 20px;
                  flex-wrap: wrap;
                  gap: 15px;
                }
                .alert-title {
                  flex: 1;
                  min-width: 300px;
                }
                .alert-title h3 {
                  margin: 0 0 8px 0;
                  color: #1f2937;
                  font-size: 1.3rem;
                  font-weight: 600;
                  line-height: 1.3;
                }
                .alert-meta {
                  color: #6b7280;
                  font-size: 0.9rem;
                  margin-bottom: 5px;
                }
                .days-remaining {
                  padding: 10px 18px;
                  border-radius: 20px;
                  font-weight: 700;
                  font-size: 1.1rem;
                  text-align: center;
                  min-width: 100px;
                  white-space: nowrap;
                }
                .days-critical { background: #dc2626; color: white; }
                .days-warning { background: #d97706; color: white; }
                .days-info { background: #2563eb; color: white; }
                .alert-stats {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                  gap: 15px;
                  margin-bottom: 20px;
                }
                .stat-item {
                  background: white;
                  padding: 15px;
                  border-radius: 8px;
                  border: 1px solid #d1d5db;
                }
                .stat-label {
                  font-size: 0.8rem;
                  color: #6b7280;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .stat-value {
                  font-size: 1.1rem;
                  font-weight: 600;
                  color: #1f2937;
                }
                .action-buttons {
                  display: flex;
                  gap: 10px;
                  margin-top: 15px;
                  flex-wrap: wrap;
                }
                .action-btn {
                  padding: 8px 16px;
                  border-radius: 6px;
                  font-size: 0.9rem;
                  font-weight: 500;
                  border: none;
                  cursor: pointer;
                  transition: all 0.2s ease;
                }
                .btn-primary {
                  background: #3b82f6;
                  color: white;
                }
                .btn-secondary {
                  background: #e5e7eb;
                  color: #374151;
                }
                .action-btn:hover {
                  transform: translateY(-1px);
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .empty-state {
                  text-align: center;
                  padding: 40px 20px;
                  color: #6b7280;
                }
                .footer {
                  text-align: center;
                  padding: 20px;
                  color: #6b7280;
                  font-size: 0.9rem;
                  margin-top: 40px;
                  border-top: 1px solid #e5e7eb;
                }
                @media (max-width: 768px) {
                  body { padding: 20px 15px; }
                  .header h1 { font-size: 2rem; }
                  .alert-header { flex-direction: column; }
                  .alert-stats { grid-template-columns: 1fr 1fr; }
                }
                @media print {
                  body { background: white; }
                  .alert-card { break-inside: avoid; }
                  .action-buttons { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1><span class="alert-icon">⚠️</span>Grant Deadline Alerts</h1>
                <p>McGill University Biology Department • Critical grant management alerts and upcoming deadlines</p>
              </div>
              
              <div class="summary-grid">
                <div class="summary-card">
                  <h3>Critical Alerts</h3>
                  <div class="value">${reportData.summary.critical_alerts}</div>
                  <div style="color: #dc2626; font-size: 0.9rem;">≤ 30 days remaining</div>
                </div>
                <div class="summary-card">
                  <h3>Warning Alerts</h3>
                  <div class="value">${reportData.summary.warning_alerts}</div>
                  <div style="color: #d97706; font-size: 0.9rem;">31-90 days remaining</div>
                </div>
                <div class="summary-card">
                  <h3>Info Alerts</h3>
                  <div class="value">${reportData.summary.info_alerts}</div>
                  <div style="color: #2563eb; font-size: 0.9rem;">91-180 days remaining</div>
                </div>
                <div class="summary-card">
                  <h3>At-Risk Budget</h3>
                  <div class="value">${formatCurrency(reportData.summary.total_at_risk_budget)}</div>
                  <div style="color: #6b7280; font-size: 0.9rem;">Critical + Warning</div>
                </div>
              </div>
              
              ${reportData.alerts.critical && reportData.alerts.critical.length > 0 ? `
                <div class="alerts-section">
                  <div class="section-header">
                    <h2>🚨 Critical Alerts (≤ 30 days)</h2>
                    <div class="urgency-badge critical">Immediate Action Required</div>
                  </div>
                  ${reportData.alerts.critical.map(alert => `
                    <div class="alert-card critical">
                      <div class="alert-header">
                        <div class="alert-title">
                          <h3>${alert.fund_name}</h3>
                          <div class="alert-meta">ID: ${alert.fund_id} • PI: ${alert.pi_name}</div>
                          <div class="alert-meta">Agency: ${alert.funding_agency}</div>
                          <div class="alert-meta">End Date: ${new Date(alert.end_date).toLocaleDateString()}</div>
                        </div>
                        <div class="days-remaining days-critical">
                          ${alert.days_remaining} days left
                        </div>
                      </div>
                      
                      <div class="alert-stats">
                        <div class="stat-item">
                          <div class="stat-label">Total Budget</div>
                          <div class="stat-value">${formatCurrency(alert.total_budget)}</div>
                        </div>
                        <div class="stat-item">
                          <div class="stat-label">Remaining Budget</div>
                          <div class="stat-value">${formatCurrency(alert.remaining_budget)}</div>
                        </div>
                        <div class="stat-item">
                          <div class="stat-label">Utilization Rate</div>
                          <div class="stat-value">${alert.utilization_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      <div class="action-buttons">
                        <button class="action-btn btn-primary">Request Extension</button>
                        <button class="action-btn btn-primary">Transfer Funds</button>
                        <button class="action-btn btn-secondary">Generate Report</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${reportData.alerts.warning && reportData.alerts.warning.length > 0 ? `
                <div class="alerts-section">
                  <div class="section-header">
                    <h2>⚠️ Warning Alerts (31-90 days)</h2>
                    <div class="urgency-badge warning">Plan Action Soon</div>
                  </div>
                  ${reportData.alerts.warning.map(alert => `
                    <div class="alert-card warning">
                      <div class="alert-header">
                        <div class="alert-title">
                          <h3>${alert.fund_name}</h3>
                          <div class="alert-meta">ID: ${alert.fund_id} • PI: ${alert.pi_name}</div>
                          <div class="alert-meta">Agency: ${alert.funding_agency}</div>
                          <div class="alert-meta">End Date: ${new Date(alert.end_date).toLocaleDateString()}</div>
                        </div>
                        <div class="days-remaining days-warning">
                          ${alert.days_remaining} days left
                        </div>
                      </div>
                      
                      <div class="alert-stats">
                        <div class="stat-item">
                          <div class="stat-label">Total Budget</div>
                          <div class="stat-value">${formatCurrency(alert.total_budget)}</div>
                        </div>
                        <div class="stat-item">
                          <div class="stat-label">Remaining Budget</div>
                          <div class="stat-value">${formatCurrency(alert.remaining_budget)}</div>
                        </div>
                        <div class="stat-item">
                          <div class="stat-label">Utilization Rate</div>
                          <div class="stat-value">${alert.utilization_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      <div class="action-buttons">
                        <button class="action-btn btn-primary">Review Budget</button>
                        <button class="action-btn btn-secondary">Schedule Meeting</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${reportData.alerts.information && reportData.alerts.information.length > 0 ? `
                <div class="alerts-section">
                  <div class="section-header">
                    <h2>ℹ️ Information Alerts (91-180 days)</h2>
                    <div class="urgency-badge info">Monitor Progress</div>
                  </div>
                  ${reportData.alerts.information.map(alert => `
                    <div class="alert-card info">
                      <div class="alert-header">
                        <div class="alert-title">
                          <h3>${alert.fund_name}</h3>
                          <div class="alert-meta">ID: ${alert.fund_id} • PI: ${alert.pi_name}</div>
                          <div class="alert-meta">Agency: ${alert.funding_agency}</div>
                          <div class="alert-meta">End Date: ${new Date(alert.end_date).toLocaleDateString()}</div>
                        </div>
                        <div class="days-remaining days-info">
                          ${alert.days_remaining} days left
                        </div>
                      </div>
                      
                      <div class="alert-stats">
                        <div class="stat-item">
                          <div class="stat-label">Total Budget</div>
                          <div class="stat-value">${formatCurrency(alert.total_budget)}</div>
                        </div>
                        <div class="stat-item">
                          <div class="stat-label">Remaining Budget</div>
                          <div class="stat-value">${formatCurrency(alert.remaining_budget)}</div>
                        </div>
                        <div class="stat-item">
                          <div class="stat-label">Utilization Rate</div>
                          <div class="stat-value">${alert.utilization_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${(!reportData.alerts.critical || reportData.alerts.critical.length === 0) && 
                (!reportData.alerts.warning || reportData.alerts.warning.length === 0) && 
                (!reportData.alerts.information || reportData.alerts.information.length === 0) ? `
                <div class="alerts-section">
                  <div class="empty-state">
                    <h2>✅ No Active Deadline Alerts</h2>
                    <p>All grants have sufficient time remaining before their deadlines.</p>
                  </div>
                </div>
              ` : ''}
              
              <div class="footer">
                <p>Generated on ${new Date().toLocaleDateString()} • McGill University Biology Lab Financial Management System</p>
                <p>🤖 Generated with Claude Code</p>
              </div>
            </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Failed to generate deadline alerts report:', error);
    }
  };

  const handleNewFund = () => {
    setShowNewFundModal(true);
  };

  const handleExportSpendingTrend = () => {
    if (!stats?.monthly_spending_trend) return;
    
    const csvContent = [
      ['Month', 'Total Spent (CAD)', 'Transaction Count'],
      ...stats.monthly_spending_trend.map(item => [
        item.month,
        item.total_spent.toFixed(2),
        item.transaction_count.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthly-spending-trend-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleViewAgencyDetails = () => {
    setShowAgencyDetailsModal(true);
  };

  const handleViewAllFunds = () => {
    setShowViewAllModal(true);
  };

  const handleViewFundDetails = (fund: Fund) => {
    setSelectedFund(fund);
    setShowFundDetailsModal(true);
  };

  const handleEditFund = (fund: Fund) => {
    setSelectedFund(fund);
    setShowNewFundModal(true); // Reuse the same modal for editing
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Loading Financial Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Financial Data</h3>
        <p className="text-gray-600 mb-4">There was an error loading the financial dashboard data.</p>
        <button
          onClick={fetchFinancialData}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const utilizationData = [
    { name: 'Under 50%', value: stats.utilization_distribution.under_50, color: '#10B981' },
    { name: '50-80%', value: stats.utilization_distribution['50_to_80'], color: '#3B82F6' },
    { name: '80-95%', value: stats.utilization_distribution['80_to_95'], color: '#F59E0B' },
    { name: 'Over 95%', value: stats.utilization_distribution.over_95, color: '#EF4444' }
  ];

  return (
    <div className="financial-dashboard space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Biology Lab Financial Dashboard</h1>
            <p className="text-gray-600">
              McGill University - Real-time research grant monitoring and laboratory budget analysis
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="12months">Last 12 Months</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={fetchFinancialData}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={handleNewFund}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Fund
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Research Budget */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">Total Research Budget</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {formatCompactCurrency(stats.summary.total_budget)}
              </p>
              <div className="flex items-center text-sm text-gray-600">
                <Wallet className="w-4 h-4 mr-1" />
                {stats.summary.total_funds} active grants
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Lab Expenditures */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">Lab Expenditures</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {formatCompactCurrency(stats.summary.total_spent)}
              </p>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                {stats.summary.overall_utilization.toFixed(1)}% of budget used
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Available Research Funds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">Available Research Funds</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {formatCompactCurrency(stats.summary.available_budget)}
              </p>
              <div className="flex items-center text-sm text-purple-600">
                <Target className="w-4 h-4 mr-1" />
                {formatCompactCurrency(stats.summary.total_committed)} pre-committed
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Grant Status Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">Grant Status Alerts</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {stats.summary.expiring_funds + stats.alerts_count}
              </p>
              <div className="flex items-center text-sm">
                {getSeverityIcon(stats.summary.expiring_funds + stats.alerts_count)}
                <span className="ml-1 text-gray-600">
                  {stats.summary.expiring_funds} expiring + {stats.alerts_count} budget alerts
                </span>
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Budget Utilization Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Research Grant Utilization</h3>
                <p className="text-sm text-gray-600 mt-1">Active grants categorized by budget spending percentage</p>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select className="text-sm border-gray-300 rounded-md">
                  <option>All Funds</option>
                  <option>Active Only</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={utilizationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {utilizationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} funds`, name]} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Spending Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lab Spending Trends</h3>
                <p className="text-sm text-gray-600 mt-1">Monthly research expenditure analysis</p>
              </div>
              <button 
                onClick={handleExportSpendingTrend}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.monthly_spending_trend}>
                <defs>
                  <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{fontSize: 12}}
                  tickFormatter={(value) => value.split('-')[1] + '/' + value.split('-')[0].slice(-2)}
                />
                <YAxis 
                  tick={{fontSize: 12}}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                />
                <Tooltip 
                  formatter={(value, name) => [formatCurrency(Number(value)), 'Monthly Spending']}
                  labelFormatter={(label) => `Month: ${label}`}
                  contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_spent" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSpending)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Funding Agency Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Research Funding Sources</h3>
              <p className="text-sm text-gray-600 mt-1">Grant budget and expenditure by Canadian funding agencies</p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleViewAgencyDetails}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                View Details
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stats.agency_breakdown} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="funding_agency__name" 
                tick={{fontSize: 11}}
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis 
                tick={{fontSize: 12}}
                tickFormatter={(value) => formatCompactCurrency(value)}
              />
              <Tooltip 
                formatter={(value, name) => [
                  formatCurrency(Number(value)), 
                  name === 'total_budget' ? 'Total Budget' : 'Total Spent'
                ]}
                contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Bar 
                dataKey="total_budget" 
                fill="#3B82F6" 
                name="Total Budget" 
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Bar 
                dataKey="total_spent" 
                fill="#10B981" 
                name="Total Spent" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Research Funds Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Active Research Grants</h3>
              <p className="text-sm text-gray-600 mt-1">Biology lab grant portfolio and budget utilization status</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <button className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </button>
              <button 
                onClick={handleViewAllFunds}
                className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700"
              >
                <Eye className="w-4 h-4 mr-1" />
                View All ({funds.length})
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grant Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget Utilization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grant Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {funds.slice(0, 10).map((fund) => (
                <tr key={fund.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{fund.name}</p>
                      <p className="text-sm text-gray-500">{fund.fund_id}</p>
                      <div className="flex items-center mt-1">
                        <Users className="w-3 h-3 text-gray-400 mr-1" />
                        <p className="text-xs text-gray-400">PI: {fund.pi_name}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{fund.funding_agency_name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(fund.spent_amount)} / {formatCurrency(fund.total_budget)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Available: {formatCurrency(fund.available_budget)}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3 max-w-[60px]">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            fund.utilization_rate >= 95 ? 'bg-red-500' :
                            fund.utilization_rate >= 80 ? 'bg-orange-500' :
                            fund.utilization_rate >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(fund.utilization_rate, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getUtilizationColor(fund.utilization_rate)}`}>
                        {fund.utilization_rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      <span className={`font-medium ${fund.days_remaining < 30 ? 'text-red-600' : fund.days_remaining < 90 ? 'text-orange-600' : 'text-gray-900'}`}>
                        {fund.days_remaining > 0 ? `${fund.days_remaining} days` : 'Expired'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(fund)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleViewFundDetails(fund)}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditFund(fund)}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                        title="Edit Fund"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-blue-50 p-2 rounded-lg mr-3">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Grant Reports</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Generate research funding and expenditure reports</p>
          <div className="space-y-2">
            <button 
              onClick={generateMonthlyExpenditureReport}
              className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center"
            >
              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
              Monthly Lab Expenditure
            </button>
            <button 
              onClick={generateGrantUtilizationReport}
              className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center"
            >
              <TrendingUp className="w-4 h-4 mr-2 text-gray-500" />
              Grant Utilization Report
            </button>
            <button 
              onClick={generateDeadlineAlertsReport}
              className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center"
            >
              <AlertTriangle className="w-4 h-4 mr-2 text-gray-500" />
              Grant Deadline Alerts
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-green-50 p-2 rounded-lg mr-3">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Lab Budget Analysis</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Analyze research expenditure patterns and trends</p>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center">
              <Activity className="w-4 h-4 mr-2 text-gray-500" />
              Research Spending Trends
            </button>
            <button className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center">
              <PieChart className="w-4 h-4 mr-2 text-gray-500" />
              Equipment vs Supplies
            </button>
            <button className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center">
              <Target className="w-4 h-4 mr-2 text-gray-500" />
              Grant Budget Forecasting
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-purple-50 p-2 rounded-lg mr-3">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Grant Administration</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage research funding and compliance settings</p>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-gray-500" />
              Budget Alert Thresholds
            </button>
            <button className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
              Canadian Dollar (CAD)
            </button>
            <button className="w-full px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-gray-500" />
              PI Approval Workflows
            </button>
          </div>
        </div>
      </div>

      {/* Simple Fund Creation Modal */}
      {showNewFundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {selectedFund ? 'Edit Fund' : 'Create New Fund'}
            </h3>
            <p className="text-gray-600 mb-4">
              This feature will redirect you to the Fund Management page where you can {selectedFund ? 'edit' : 'create'} research grants.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNewFundModal(false);
                  setSelectedFund(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.location.href = '/funding';
                  setShowNewFundModal(false);
                  setSelectedFund(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Fund Management
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All Funds Modal */}
      {showViewAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">All Research Grants ({funds.length})</h3>
              <button
                onClick={() => setShowViewAllModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fund</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Utilization</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {funds.map((fund) => (
                    <tr key={fund.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{fund.name}</p>
                          <p className="text-xs text-gray-500">{fund.fund_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {formatCurrency(fund.spent_amount)} / {formatCurrency(fund.total_budget)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getUtilizationColor(fund.utilization_rate)}`}>
                          {fund.utilization_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {getStatusBadge(fund)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Agency Details Modal */}
      {showAgencyDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Funding Agency Details</h3>
              <button
                onClick={() => setShowAgencyDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              {stats?.agency_breakdown.map((agency, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900">{agency.funding_agency__name}</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div>
                      <span className="text-gray-600">Total Budget:</span>
                      <span className="ml-2 font-medium">{formatCurrency(agency.total_budget)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Spent:</span>
                      <span className="ml-2 font-medium">{formatCurrency(agency.total_spent)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Fund Count:</span>
                      <span className="ml-2 font-medium">{agency.count}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Utilization:</span>
                      <span className="ml-2 font-medium">
                        {((agency.total_spent / agency.total_budget) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fund Details Modal */}
      {showFundDetailsModal && selectedFund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fund Details</h3>
              <button
                onClick={() => {
                  setShowFundDetailsModal(false);
                  setSelectedFund(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900">{selectedFund.name}</h4>
                <p className="text-sm text-gray-600">{selectedFund.fund_id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Total Budget:</span>
                  <p className="font-medium">{formatCurrency(selectedFund.total_budget)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Spent Amount:</span>
                  <p className="font-medium">{formatCurrency(selectedFund.spent_amount)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Available Budget:</span>
                  <p className="font-medium">{formatCurrency(selectedFund.available_budget)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Utilization Rate:</span>
                  <p className="font-medium">{selectedFund.utilization_rate.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Days Remaining:</span>
                  <p className="font-medium">
                    {selectedFund.days_remaining > 0 ? `${selectedFund.days_remaining} days` : 'Expired'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">PI:</span>
                  <p className="font-medium">{selectedFund.pi_name}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Funding Agency:</span>
                <p className="font-medium">{selectedFund.funding_agency_name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Status:</span>
                <div className="mt-1">{getStatusBadge(selectedFund)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;