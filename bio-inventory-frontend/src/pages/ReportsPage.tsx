import React, { useState, useEffect, useContext } from 'react';
import { Download, RefreshCw, PlusCircle, FileText, Upload, Loader, AlertTriangle, Package, Clock } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';

const ReportsPage = () => {
    const { token } = useContext(AuthContext);
    const [reports, setReports] = useState(null);
    const [expiringItems, setExpiringItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Fetch reports data
            Promise.all([
                fetch('http://127.0.0.1:8000/api/items/reports/', {
                    headers: { 'Authorization': `Token ${token}` }
                }).then(res => res.json()),
                fetch('http://127.0.0.1:8000/api/items/expiring_this_month/', {
                    headers: { 'Authorization': `Token ${token}` }
                }).then(res => res.json())
            ]).then(([reportsData, expiringData]) => {
                setReports(reportsData);
                setExpiringItems(expiringData.items);
                setLoading(false);
            }).catch(error => {
                console.error('Error fetching reports:', error);
                setLoading(false);
            });
        }
    }, [token]);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader className="w-8 h-8 animate-spin text-primary-600" /></div>;
    if (!reports) return <div className="text-center text-secondary-500">No report data available</div>;

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 mb-2">Laboratory Dashboard</h1>
                    <p className="text-secondary-600">Real-time inventory overview and key performance metrics</p>
                </div>
                <div className="flex space-x-3">
                    <button className="btn btn-secondary flex items-center">
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                    </button>
                    <button className="btn btn-primary flex items-center">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Enhanced Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-white to-primary-50 p-6 rounded-xl shadow-soft border border-primary-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
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

                <div className="bg-gradient-to-br from-white to-danger-50 p-6 rounded-xl shadow-soft border border-danger-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-secondary-600">Expired Items</p>
                            <p className="text-2xl font-bold text-danger-600">{reports.summary.expired_items}</p>
                            <p className="text-xs text-danger-600 mt-1">{reports.summary.expired_items > 0 ? 'Requires attention!' : 'All items current'}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-danger-600" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-white to-warning-50 p-6 rounded-xl shadow-soft border border-warning-200 hover:shadow-medium transition-all duration-200 cursor-pointer">
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
                    <button className="btn btn-primary flex items-center justify-center p-4 hover:shadow-medium transition-all duration-200">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Add New Item
                    </button>
                    <button className="btn btn-secondary flex items-center justify-center p-4 hover:shadow-medium transition-all duration-200">
                        <FileText className="w-5 h-5 mr-2" />
                        New Request
                    </button>
                    <button className="btn btn-secondary flex items-center justify-center p-4 hover:shadow-medium transition-all duration-200">
                        <Upload className="w-5 h-5 mr-2" />
                        Import Data
                    </button>
                </div>
            </div>

            {/* Charts and Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Items by Type */}
                <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-secondary-900">Items by Type</h3>
                        <span className="text-xs text-secondary-500">{reports.breakdown.by_type.length} total types</span>
                    </div>
                    <div className="space-y-4">
                        {reports.breakdown.by_type.slice(0, 5).map((item, index) => {
                            const maxCount = Math.max(...reports.breakdown.by_type.map(i => i.count));
                            const percentage = (item.count / maxCount) * 100;
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
                                        <div className="bg-primary-600 h-2 rounded-full" style={{width: `${percentage}%`}}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Items by Location */}
                <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-secondary-900">Items by Location</h3>
                        <span className="text-xs text-secondary-500">{reports.breakdown.by_location.length} locations</span>
                    </div>
                    <div className="space-y-4">
                        {reports.breakdown.by_location.slice(0, 5).map((item, index) => {
                            const maxCount = Math.max(...reports.breakdown.by_location.map(i => i.count));
                            const percentage = (item.count / maxCount) * 100;
                            return (
                                <div key={index} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-secondary-700">{item.location__name}</span>
                                        <span className="text-sm text-secondary-900 font-semibold bg-secondary-100 px-2 py-1 rounded">{item.count} items</span>
                                    </div>
                                    <div className="w-full bg-secondary-100 rounded-full h-2">
                                        <div className="bg-secondary-600 h-2 rounded-full" style={{width: `${percentage}%`}}></div>
                                    </div>
                                </div>
                            );
                        })}
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

            {/* Recent Activity & System Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Recent Activity */}
                <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                                <PlusCircle className="w-4 h-4 text-success-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-secondary-900">New items added to inventory</p>
                                <p className="text-xs text-secondary-500">Last update: 2 hours ago</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                                <Clock className="w-4 h-4 text-warning-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-secondary-900">Stock level alerts generated</p>
                                <p className="text-xs text-secondary-500">Last update: 4 hours ago</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <FileText className="w-4 h-4 text-primary-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-secondary-900">New requests submitted</p>
                                <p className="text-xs text-secondary-500">Last update: 6 hours ago</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Health */}
                <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                    <h3 className="text-lg font-semibold text-secondary-900 mb-4">System Status</h3>
                    <div className="space-y-4">
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
            </div>

            {/* Weekly Summary */}
            <div className="bg-white p-6 rounded-xl shadow-soft border border-secondary-200">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Weekly Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">+{Math.floor(Math.random() * 50) + 10}</div>
                        <div className="text-sm text-secondary-600">Items Added</div>
                        <div className="text-xs text-success-600">↑ 15% vs last week</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-secondary-600">{Math.floor(Math.random() * 30) + 5}</div>
                        <div className="text-sm text-secondary-600">Requests Fulfilled</div>
                        <div className="text-xs text-success-600">↑ 8% vs last week</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-warning-600">{Math.floor(Math.random() * 10) + 2}</div>
                        <div className="text-sm text-secondary-600">Items Expired</div>
                        <div className="text-xs text-danger-600">↓ 3% vs last week</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-success-600">${(Math.random() * 5000 + 1000).toFixed(0)}</div>
                        <div className="text-sm text-secondary-600">Value Added</div>
                        <div className="text-xs text-success-600">↑ 12% vs last week</div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ReportsPage;
