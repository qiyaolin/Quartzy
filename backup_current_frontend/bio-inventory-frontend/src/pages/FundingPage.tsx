import React, { useState, useEffect, useContext } from 'react';
import { DollarSign, BarChart3, Receipt, AlertTriangle, Wallet, CreditCard } from 'lucide-react';
import { AuthContext } from '../components/AuthContext';
import FundManagement from '../components/funding/FundManagement';
import TransactionRecords from '../components/funding/TransactionRecords';
import BudgetReports from '../components/funding/BudgetReports';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const FundingPage = () => {
    const { token, user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('funds');
    const [funds, setFunds] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [budgetSummary, setBudgetSummary] = useState(null);
    const [apiStatus, setApiStatus] = useState({ available: true, message: '' });

    // Check if user is admin
    const isAdmin = user?.is_staff || user?.is_superuser;

    useEffect(() => {
        if (token && isAdmin) {
            fetchFundingData();
        }
    }, [token, isAdmin]);

    const fetchFundingData = async () => {
        setLoading(true);
        try {
            // Check if APIs are available with graceful fallbacks
            const fundsResponse = await fetch(buildApiUrl(API_ENDPOINTS.FUNDS), {
                headers: { 'Authorization': `Token ${token}` }
            }).catch(() => ({ ok: false, status: 404 }));
            
            const transactionsResponse = await fetch(buildApiUrl(API_ENDPOINTS.TRANSACTIONS), {
                headers: { 'Authorization': `Token ${token}` }
            }).catch(() => ({ ok: false, status: 404 }));
            
            const summaryResponse = await fetch(buildApiUrl(API_ENDPOINTS.BUDGET_SUMMARY), {
                headers: { 'Authorization': `Token ${token}` }
            }).catch(() => ({ ok: false, status: 404 }));
            
            // Process responses with fallbacks
            const fundsData = fundsResponse.ok ? await fundsResponse.json().catch(() => []) : [];
            const transactionsData = transactionsResponse.ok ? await transactionsResponse.json().catch(() => []) : [];
            const summaryData = summaryResponse.ok ? await summaryResponse.json().catch(() => null) : null;
            
            setFunds(fundsData.results || fundsData || []);
            setTransactions(transactionsData.results || transactionsData || []);
            setBudgetSummary(summaryData || { total_budget: 0, total_spent: 0 });
            
            // Check API availability status
            const allApisAvailable = fundsResponse.ok && transactionsResponse.ok && summaryResponse.ok;
            if (!allApisAvailable) {
                setApiStatus({
                    available: false,
                    message: 'Some funding APIs are not yet implemented on the backend. You can still explore the interface, but full functionality will be available once the backend APIs are deployed.'
                });
            } else {
                setApiStatus({ available: true, message: '' });
            }
        } catch (error) {
            console.error('Error fetching funding data:', error);
            // Set default fallback data
            setFunds([]);
            setTransactions([]);
            setBudgetSummary({ total_budget: 0, total_spent: 0 });
        } finally {
            setLoading(false);
        }
    };

    const refreshData = () => {
        fetchFundingData();
    };

    // Access control
    if (!isAdmin) {
        return (
            <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <AlertTriangle className="w-16 h-16 text-warning-600 mb-4" />
                    <h2 className="text-2xl font-bold text-secondary-900 mb-2">Access Restricted</h2>
                    <p className="text-secondary-600">Only administrators can access the funding management system.</p>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                        <p className="text-secondary-600">Loading funding data...</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 mb-2">Funding Management</h1>
                    <p className="text-secondary-600">Manage laboratory funds, budgets, and financial transactions</p>
                    {!apiStatus.available && (
                        <div className="mt-3 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                            <div className="flex items-start">
                                <AlertTriangle className="w-5 h-5 text-warning-600 mr-2 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-warning-800">API Development Status</p>
                                    <p className="text-xs text-warning-700 mt-1">{apiStatus.message}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                        <div className="flex items-center space-x-2">
                            <Wallet className="w-5 h-5 text-success-600" />
                            <div>
                                <p className="text-sm text-secondary-600">Total Budget</p>
                                <p className="text-lg font-bold text-success-600">
                                    ${(parseFloat(budgetSummary?.total_budget) || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-soft border border-secondary-200">
                        <div className="flex items-center space-x-2">
                            <CreditCard className="w-5 h-5 text-warning-600" />
                            <div>
                                <p className="text-sm text-secondary-600">Spent</p>
                                <p className="text-lg font-bold text-warning-600">
                                    ${(parseFloat(budgetSummary?.total_spent) || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-soft border border-secondary-200 mb-8">
                <div className="border-b border-secondary-200">
                    <nav className="flex space-x-8 px-6">
                        <button
                            onClick={() => setActiveTab('funds')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'funds'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                            }`}
                        >
                            <div className="flex items-center space-x-2">
                                <DollarSign className="w-4 h-4" />
                                <span>Fund Management</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'transactions'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                            }`}
                        >
                            <div className="flex items-center space-x-2">
                                <Receipt className="w-4 h-4" />
                                <span>Transaction Records</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'reports'
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                            }`}
                        >
                            <div className="flex items-center space-x-2">
                                <BarChart3 className="w-4 h-4" />
                                <span>Budget Reports</span>
                            </div>
                        </button>
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'funds' && (
                        <FundManagement 
                            funds={funds}
                            onRefresh={refreshData}
                            token={token}
                        />
                    )}
                    {activeTab === 'transactions' && (
                        <TransactionRecords 
                            transactions={transactions}
                            funds={funds}
                            onRefresh={refreshData}
                            token={token}
                        />
                    )}
                    {activeTab === 'reports' && (
                        <BudgetReports 
                            funds={funds}
                            transactions={transactions}
                            budgetSummary={budgetSummary}
                            token={token}
                        />
                    )}
                </div>
            </div>
        </main>
    );
};

export default FundingPage;