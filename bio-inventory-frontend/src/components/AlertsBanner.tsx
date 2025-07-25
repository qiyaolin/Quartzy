import React, { useState, useEffect, useContext } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

const AlertsBanner = () => {
    const { token } = useContext(AuthContext);
    const [alerts, setAlerts] = useState({ expired: { count: 0 }, expiring_soon: { count: 0 }, low_stock: { count: 0 } });
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        if (token) {
            fetch('http://127.0.0.1:8000/api/items/alerts/', {
                headers: { 'Authorization': `Token ${token}` }
            })
            .then(response => response.json())
            .then(data => setAlerts(data))
            .catch(error => console.error('Error fetching alerts:', error));
        }
    }, [token]);

    const totalAlerts = alerts.expired.count + alerts.expiring_soon.count + alerts.low_stock.count;

    if (totalAlerts === 0 || isDismissed) return null;

    return (
        <div className="bg-warning-50 border-b border-warning-200">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <TriangleAlert className="w-5 h-5 text-warning-600" />
                        <span className="text-sm font-medium text-warning-800">
                            {totalAlerts} items need attention: 
                            {alerts.expired.count > 0 && ` ${alerts.expired.count} expired`}
                            {alerts.expiring_soon.count > 0 && ` ${alerts.expiring_soon.count} expiring soon`}
                            {alerts.low_stock.count > 0 && ` ${alerts.low_stock.count} low stock`}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-warning-600 hover:text-warning-700 text-sm font-medium"
                        >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                        <button 
                            onClick={() => setIsDismissed(true)}
                            className="text-warning-600 hover:text-warning-700 p-1 rounded-md hover:bg-warning-100 transition-colors"
                            title="Dismiss notification"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                {isExpanded && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {alerts.expired.count > 0 && (
                            <div className="bg-danger-50 p-3 rounded-lg border border-danger-200">
                                <h4 className="text-sm font-semibold text-danger-800 mb-2">Expired Items ({alerts.expired.count})</h4>
                                {alerts.expired.items?.slice(0, 3).map(item => (
                                    <div key={item.id} className="text-xs text-danger-700 truncate">
                                        • {item.name}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {alerts.expiring_soon.count > 0 && (
                            <div className="bg-warning-50 p-3 rounded-lg border border-warning-200">
                                <h4 className="text-sm font-semibold text-warning-800 mb-2">Expiring Soon ({alerts.expiring_soon.count})</h4>
                                {alerts.expiring_soon.items?.slice(0, 3).map(item => (
                                    <div key={item.id} className="text-xs text-warning-700 truncate">
                                        • {item.name} ({item.days_until_expiration} days)
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {alerts.low_stock.count > 0 && (
                            <div className="bg-primary-50 p-3 rounded-lg border border-primary-200">
                                <h4 className="text-sm font-semibold text-primary-800 mb-2">Low Stock ({alerts.low_stock.count})</h4>
                                {alerts.low_stock.items?.slice(0, 3).map(item => (
                                    <div key={item.id} className="text-xs text-primary-700 truncate">
                                        • {item.name} ({item.quantity} {item.unit})
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsBanner;
