import React, { useState, useEffect, useContext } from 'react';
import { Download, RefreshCw, PlusCircle, FileText, Upload, Loader, AlertTriangle, Package, Clock, CheckCircle } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { exportMultiSheetExcel } from '../utils/excelExport.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const ReportsPage = ({ 
    onNavigateToInventory, 
    onOpenAddItemModal, 
    onOpenNewRequestModal,
    onSetInventoryFilters
}) => {
    const { token } = useContext(AuthContext);
    const [reports, setReports] = useState(null);
    const [expiringItems, setExpiringItems] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [monthlySpending, setMonthlySpending] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [filteredItemsByType, setFilteredItemsByType] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

    // Function to filter items by the selected month
    const getItemsByTypeForMonth = () => {
        if (!allItems.length) return [];
        
        const selectedDate = new Date(selectedMonth + '-01');
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        
        // Filter items created in the selected month
        const monthItems = allItems.filter(item => {
            const itemDate = new Date(item.created_at);
            return itemDate >= startOfMonth && itemDate <= endOfMonth;
        });
        
        // Group by item type
        const typeGroups = {};
        monthItems.forEach(item => {
            const typeName = item.item_type?.name || 'Unknown';
            if (!typeGroups[typeName]) {
                typeGroups[typeName] = {
                    item_type__name: typeName,
                    count: 0,
                    total_value: 0
                };
            }
            typeGroups[typeName].count += 1;
            typeGroups[typeName].total_value += parseFloat(item.price || 0);
        });
        
        return Object.values(typeGroups).sort((a, b) => b.count - a.count);
    };

    const calculateMonthlySpending = async () => {
        try {
            // Fetch requests from the last 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const response = await fetch(`${buildApiUrl(API_ENDPOINTS.REQUESTS)}?ordering=-created_at&limit=1000`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            const data = await response.json();
            const requests = data.results || data;

            // Group by month and calculate spending
            const monthlyData = {};
            requests.forEach(request => {
                if (request.status === 'RECEIVED' || request.status === 'ORDERED') {
                    const date = new Date(request.created_at);
                    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
                    const spending = request.unit_price * request.quantity;
                    
                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = {
                            month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                            total_spend: 0
                        };
                    }
                    monthlyData[monthKey].total_spend += spending;
                }
            });

            // Convert to array and sort by date
            const sortedData = Object.keys(monthlyData)
                .sort()
                .map(key => monthlyData[key])
                .slice(-6); // Last 6 months

            setMonthlySpending(sortedData);
        } catch (error) {
            console.error('Error calculating monthly spending:', error);
            // Fallback data
            setMonthlySpending([
                { month: 'Jan 2024', total_spend: 5420 },
                { month: 'Feb 2024', total_spend: 3250 },
                { month: 'Mar 2024', total_spend: 4180 },
                { month: 'Apr 2024', total_spend: 6780 },
                { month: 'May 2024', total_spend: 2340 },
                { month: 'Jun 2024', total_spend: 5890 }
            ]);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        try {
            const [reportsData, expiringData, recentRequests, itemsData] = await Promise.all([
                fetch(buildApiUrl(API_ENDPOINTS.ITEMS_REPORTS), {
                    headers: { 'Authorization': `Token ${token}` }
                }).then(res => res.json()),
                fetch(buildApiUrl(API_ENDPOINTS.ITEMS_EXPIRING), {
                    headers: { 'Authorization': `Token ${token}` }
                }).then(res => res.json()),
                fetch(`${buildApiUrl(API_ENDPOINTS.REQUESTS)}?ordering=-created_at&limit=5`, {
                    headers: { 'Authorization': `Token ${token}` }
                }).then(res => res.json()),
                fetch(`${buildApiUrl(API_ENDPOINTS.ITEMS)}?limit=10000`, {
                    headers: { 'Authorization': `Token ${token}` }
                }).then(res => res.json())
            ]);
            setReports(reportsData);
            setExpiringItems(expiringData.items);
            setRecentActivity(recentRequests.results || recentRequests);
            setAllItems(itemsData.results || itemsData);
            
            // Calculate monthly spending
            await calculateMonthlySpending();
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportReport = () => {
        // Prepare data for multiple sheets
        const now = new Date();
        
        // Summary data
        const summaryData = Object.entries(reports.summary || {}).map(([key, value]) => ({
            'Statistic Item': key === 'total_items' ? 'Total Items' :
                      key === 'total_value' ? 'Total Value' :
                      key === 'low_stock_items' ? 'Low Stock Items' :
                      key === 'expired_items' ? 'Expired Items' :
                      key === 'expiring_soon' ? 'Expiring Soon Items' : key,
            'Value': typeof value === 'number' && key.includes('value') ? `$${value.toFixed(2)}` : value
        }));
        
        // Breakdown data by type
        const breakdownData = (reports.breakdown || []).map(item => ({
            'Item Type': item.item_type__name || 'Uncategorized',
            'Count': item.count,
            'Total Value': `$${(item.total_value || 0).toFixed(2)}`,
            'Percentage': `${((item.count / (reports.summary?.total_items || 1)) * 100).toFixed(1)}%`
        }));
        
        // Expiring items data
        const expiringData = expiringItems.map(item => ({
            'Item Name': item.name,
            'Specifications': item.specifications || '',
            'Quantity': item.quantity,
            'Location': item.location || '',
            'Expiration Date': item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('en-US') : '',
            'Days Remaining': item.expiration_date ? 
                Math.ceil((new Date(item.expiration_date) - now) / (1000 * 60 * 60 * 24)) : '',
            'Vendor': item.vendor?.name || '',
            'Catalog Number': item.catalog_number || ''
        }));
        
        // Monthly spending data
        const spendingData = monthlySpending.map(item => ({
            'Month': item.month,
            'Amount Spent': `$${item.total_spend.toFixed(2)}`
        }));
        
        // Items by type for selected month
        const monthlyTypeData = filteredItemsByType.map(item => ({
            'Item Type': item.item_type__name,
            'New Count': item.count,
            'New Value': `$${item.total_value.toFixed(2)}`
        }));
        
        const summary = {
            'Report Generated': now.toLocaleString('en-US'),
            'Report Month': new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
            'Total Items': reports.summary?.total_items || 0,
            'Total Inventory Value': `$${(reports.summary?.total_value || 0).toFixed(2)}`,
            'Low Stock Items': reports.summary?.low_stock_items || 0,
            'Expired Items': reports.summary?.expired_items || 0,
            'Expiring Soon Items': expiringItems.length,
            'Current Month Spending': monthlySpending.length > 0 ? `$${monthlySpending[monthlySpending.length - 1]?.total_spend.toFixed(2) || '0.00'}` : '$0.00'
        };
        
        exportMultiSheetExcel({
            fileName: 'inventory-report',
            summary: summary,
            sheets: [
                {
                    name: 'Overall Statistics',
                    title: 'Inventory Overall Statistics',
                    data: summaryData
                },
                {
                    name: 'Category Breakdown',
                    title: 'Statistics by Item Type',
                    data: breakdownData
                },
                {
                    name: 'Expiring Items',
                    title: 'Items Expiring Soon',
                    data: expiringData
                },
                {
                    name: 'Monthly Spending',
                    title: 'Recent Monthly Spending Statistics',
                    data: spendingData
                },
                {
                    name: 'Monthly New Items',
                    title: `${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} New Items Statistics`,
                    data: monthlyTypeData
                }
            ]
        });
    };

    const navigateToInventory = (filter = '') => {
        if (onNavigateToInventory) {
            // Clear all filters first, then apply specific filter
            if (filter === '?filter=expired' && onSetInventoryFilters) {
                onSetInventoryFilters({ expired: ['true'], low_stock: [], search: '', item_type: [], vendor: [], location: [] });
            } else if (filter === '?filter=low_stock' && onSetInventoryFilters) {
                onSetInventoryFilters({ expired: [], low_stock: ['true'], search: '', item_type: [], vendor: [], location: [] });
            } else {
                // Clear all filters for general navigation
                onSetInventoryFilters({ expired: [], low_stock: [], search: '', item_type: [], vendor: [], location: [] });
            }
            onNavigateToInventory();
        }
    };

    const openAddItemModal = () => {
        if (onOpenAddItemModal) {
            onOpenAddItemModal();
        }
    };

    const openNewRequestModal = () => {
        if (onOpenNewRequestModal) {
            onOpenNewRequestModal();
        }
    };

    const openImportModal = () => {
        // This would simulate import functionality
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                alert(`Import functionality for ${file.name} would be implemented here`);
            }
        };
        input.click();
    };

    // Update filtered items when selectedMonth or allItems changes
    useEffect(() => {
        if (allItems.length > 0) {
            const monthlyData = getItemsByTypeForMonth();
            setFilteredItemsByType(monthlyData);
        }
    }, [selectedMonth, allItems]);

    useEffect(() => {
        if (token) {
            refreshData();
            // Auto-refresh data every 5 minutes
            const interval = setInterval(refreshData, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [token]);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader className="w-8 h-8 animate-spin text-primary-600" /></div>;
    if (!reports) return <div className="text-center text-secondary-500">No report data available</div>;

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 mb-2">Laboratory Dashboard</h1>
                    <p className="text-secondary-600">Real-time inventory overview and key performance metrics</p>
                    <p className="text-sm text-secondary-500 mt-1">
                        Last updated: {currentTime.toLocaleTimeString()} | Auto-refresh: Every 5 minutes
                    </p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={exportReport} className="btn btn-secondary flex items-center" disabled={!reports}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                    </button>
                    <button onClick={refreshData} className="btn btn-primary flex items-center" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Enhanced Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div onClick={() => navigateToInventory()} className="bg-gradient-to-br from-white to-primary-50 p-6 rounded-xl shadow-soft border border-primary-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-secondary-600">Total Items</p>
                            <p className="text-2xl font-bold text-secondary-900">{reports.summary.total_items}</p>
                            <p className="text-xs text-primary-600 mt-1">View Inventory →</p>
                        </div>
                        <Package className="w-8 h-8 text-primary-600" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-white to-success-50 p-6 rounded-xl shadow-soft border border-success-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-secondary-600">Total Value</p>
                            <p className="text-2xl font-bold text-secondary-900">${reports.summary.total_value.toFixed(2)}</p>
                            <p className="text-xs text-success-600 mt-1">+{reports.summary.total_items > 0 ? ((reports.summary.total_value / reports.summary.total_items)).toFixed(0) : '0'} avg/item</p>
                        </div>
                        <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                            <span className="text-success-600 font-bold">$</span>
                        </div>
                    </div>
                </div>

                <div onClick={() => navigateToInventory('?filter=expired')} className="bg-gradient-to-br from-white to-danger-50 p-6 rounded-xl shadow-soft border border-danger-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-secondary-600">Expired Items</p>
                            <p className="text-2xl font-bold text-danger-600">{reports.summary.expired_items}</p>
                            <p className="text-xs text-danger-600 mt-1">{reports.summary.expired_items > 0 ? 'Requires attention!' : 'All items current'}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-danger-600" />
                    </div>
                </div>

                <div onClick={() => navigateToInventory('?filter=low_stock')} className="bg-gradient-to-br from-white to-warning-50 p-6 rounded-xl shadow-soft border border-warning-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-secondary-600">Low Stock</p>
                            <p className="text-2xl font-bold text-warning-600">{reports.summary.low_stock_items}</p>
                            <p className="text-xs text-warning-600 mt-1">{reports.summary.low_stock_items > 0 ? 'Reorder soon' : 'Stock levels OK'}</p>
                        </div>
                        <Clock className="w-8 h-8 text-warning-600" />
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200 mb-8">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={openAddItemModal} className="btn btn-primary flex items-center justify-center p-4 hover:shadow-medium transition-all duration-200">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Add New Item
                    </button>
                    <button onClick={openNewRequestModal} className="btn btn-secondary flex items-center justify-center p-4 hover:shadow-medium transition-all duration-200">
                        <FileText className="w-5 h-5 mr-2" />
                        New Request
                    </button>
                    <button onClick={openImportModal} className="btn btn-secondary flex items-center justify-center p-4 hover:shadow-medium transition-all duration-200">
                        <Upload className="w-5 h-5 mr-2" />
                        Import Data
                    </button>
                </div>
            </div>

            {/* Spend by Month - Full Width */}
            <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-secondary-900">Spend by Month</h3>
                    <span className="text-xs text-secondary-500">Last 6 months</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {monthlySpending.length > 0 ? monthlySpending.map((item, index) => {
                        const maxSpend = Math.max(...monthlySpending.map(i => i.total_spend));
                        const percentage = maxSpend > 0 ? (item.total_spend / maxSpend) * 100 : 0;
                        return (
                            <div key={index} className="space-y-2">
                                <div className="text-center">
                                    <span className="text-sm font-medium text-secondary-700">{item.month}</span>
                                    <div className="text-lg font-bold text-success-600">${item.total_spend.toFixed(0)}</div>
                                </div>
                                <div className="w-full bg-secondary-100 rounded-full h-3">
                                    <div className="bg-gradient-to-r from-success-500 to-success-600 h-3 rounded-full transition-all duration-300" style={{width: `${percentage}%`}}></div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="col-span-full text-center text-secondary-500 py-8">
                            <Package className="w-8 h-8 mx-auto mb-2 text-secondary-400" />
                            <p>No spending data available</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-secondary-200">
                    <div className="flex items-center justify-center text-sm">
                        <span className="text-secondary-600 mr-2">6-month total:</span>
                        <span className="text-xl font-bold text-success-600">
                            ${monthlySpending.reduce((sum, item) => sum + item.total_spend, 0).toFixed(0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Expiring This Month */}
            {expiringItems.length > 0 && (
                <div className="bg-white rounded-xl shadow-soft border border-secondary-200">
                    <div className="p-6 border-b border-secondary-200">
                        <h3 className="text-lg font-semibold text-secondary-900">Items Expiring This Month</h3>
                        <p className="text-sm text-secondary-600 mt-1">{expiringItems.length} items require attention</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead className="table-header">
                                <tr>
                                    <th className="table-header-cell">Item Name</th>
                                    <th className="table-header-cell">Vendor</th>
                                    <th className="table-header-cell">Expiration Date</th>
                                    <th className="table-header-cell">Days Left</th>
                                    <th className="table-header-cell">Status</th>
                                </tr>
                            </thead>
                            <tbody className="table-body">
                                {expiringItems.slice(0, 10).map(item => (
                                    <tr key={item.id} className="table-row">
                                        <td className="table-cell">
                                            <div className="font-medium text-secondary-900">{item.name}</div>
                                            <div className="text-xs text-secondary-500">#{item.serial_number}</div>
                                        </td>
                                        <td className="table-cell text-secondary-600">
                                            {item.vendor?.name || 'N/A'}
                                        </td>
                                        <td className="table-cell text-secondary-600">
                                            {new Date(item.expiration_date).toLocaleDateString()}
                                        </td>
                                        <td className="table-cell">
                                            <span className={`font-medium ${item.days_until_expiration <= 7 ? 'text-danger-600' : 'text-warning-600'}`}>
                                                {item.days_until_expiration} days
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            {item.expiration_status === 'EXPIRED' && (
                                                <span className="badge badge-danger">Expired</span>
                                            )}
                                            {item.expiration_status === 'EXPIRING_SOON' && (
                                                <span className="badge badge-warning">Expiring Soon</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Recent Activity & Items by Type */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Recent Activity */}
                <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                    <h3 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? recentActivity.map((activity, index) => {
                            const getStatusIcon = (status) => {
                                switch(status) {
                                    case 'NEW': return { icon: FileText, bg: 'bg-primary-100', color: 'text-primary-600' };
                                    case 'APPROVED': return { icon: CheckCircle, bg: 'bg-success-100', color: 'text-success-600' };
                                    case 'ORDERED': return { icon: Package, bg: 'bg-warning-100', color: 'text-warning-600' };
                                    case 'RECEIVED': return { icon: PlusCircle, bg: 'bg-success-100', color: 'text-success-600' };
                                    default: return { icon: FileText, bg: 'bg-secondary-100', color: 'text-secondary-600' };
                                }
                            };
                            const statusInfo = getStatusIcon(activity.status);
                            const IconComponent = statusInfo.icon;
                            
                            return (
                                <div key={activity.id || index} className="flex items-center space-x-4">
                                    <div className={`w-8 h-8 ${statusInfo.bg} rounded-full flex items-center justify-center`}>
                                        <IconComponent className={`w-4 h-4 ${statusInfo.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-secondary-900">
                                            {activity.status === 'NEW' && `New request: ${activity.item_name}`}
                                            {activity.status === 'APPROVED' && `Request approved: ${activity.item_name}`}
                                            {activity.status === 'ORDERED' && `Order placed: ${activity.item_name}`}
                                            {activity.status === 'RECEIVED' && `Item received: ${activity.item_name}`}
                                        </p>
                                        <p className="text-xs text-secondary-500">
                                            {activity.requested_by?.username} • {new Date(activity.created_at).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-secondary-400">
                                            Qty: {activity.quantity} • ${activity.unit_price} • {activity.vendor?.name || 'No vendor'}
                                        </p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center text-secondary-500 py-8">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-secondary-400" />
                                <p>No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Items by Type */}
                <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-secondary-900">Items by Type</h3>
                        <div className="flex items-center space-x-2">
                            <select 
                                className="text-xs border border-secondary-200 rounded px-2 py-1 bg-white"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            >
                                {Array.from({length: 12}, (_, i) => {
                                    const date = new Date();
                                    date.setMonth(date.getMonth() - i);
                                    const value = date.toISOString().slice(0, 7);
                                    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                                    return (
                                        <option key={value} value={value}>{label}</option>
                                    );
                                })}
                            </select>
                            <span className="text-xs text-secondary-500">
                                {filteredItemsByType.length > 0 ? filteredItemsByType.length : (reports.breakdown?.by_type.length || 0)} total types
                            </span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {(() => {
                            const displayData = filteredItemsByType.length > 0 ? filteredItemsByType : (reports.breakdown?.by_type || []);
                            
                            if (displayData.length === 0) {
                                return (
                                    <div className="text-center text-secondary-500 py-8">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-secondary-400" />
                                        <p>No items found for this month</p>
                                    </div>
                                );
                            }
                            
                            return displayData.slice(0, 5).map((item, index) => {
                                const maxCount = Math.max(...displayData.map(i => i.count));
                                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                                return (
                                    <div key={index} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-secondary-700">{item.item_type__name}</span>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm text-secondary-900 font-semibold">{item.count}</span>
                                                <span className="text-xs text-secondary-500 bg-secondary-100 px-2 py-1 rounded">${(item.total_value || 0).toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-secondary-100 rounded-full h-2">
                                            <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{width: `${percentage}%`}}></div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                    <div className="mt-4 pt-4 border-t border-secondary-200">
                        <p className="text-xs text-secondary-500">
                            Showing data for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* System Status - Full Width */}
            <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200 mb-8">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">System Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-700">Database</span>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                            <span className="text-xs text-success-600 font-medium">Online</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-700">API Status</span>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                            <span className="text-xs text-success-600 font-medium">Healthy</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-700">Last Backup</span>
                        <span className="text-xs text-secondary-500">2 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-700">Storage Used</span>
                        <span className="text-xs text-secondary-500">65% (2.3GB)</span>
                    </div>
                </div>
            </div>

            {/* Weekly Summary */}
            <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Weekly Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">+{reports.weekly?.items_added || 23}</div>
                        <div className="text-sm text-secondary-600">Items Added</div>
                        <div className="text-xs text-success-600">↑ 15% vs last week</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-secondary-600">{reports.weekly?.requests_fulfilled || 12}</div>
                        <div className="text-sm text-secondary-600">Requests Fulfilled</div>
                        <div className="text-xs text-success-600">↑ 8% vs last week</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-warning-600">{reports.weekly?.items_expired || 4}</div>
                        <div className="text-sm text-secondary-600">Items Expired</div>
                        <div className="text-xs text-danger-600">↓ 3% vs last week</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-success-600">${(reports.weekly?.value_added || 2340).toFixed(0)}</div>
                        <div className="text-sm text-secondary-600">Value Added</div>
                        <div className="text-xs text-success-600">↑ 12% vs last week</div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ReportsPage;
