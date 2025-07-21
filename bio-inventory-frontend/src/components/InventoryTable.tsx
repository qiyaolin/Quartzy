import React, { useState } from 'react';
import { ChevronDown, Edit, Trash2, AlertTriangle, Clock } from 'lucide-react';

const InventoryTable = ({ groupedData, onEdit, onDelete }) => {
    const [expandedGroups, setExpandedGroups] = useState({});
    const toggleGroup = (groupId) => { setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] })); };
    
    const getRowClassName = (item) => {
        const baseClass = "table-row";
        if (item.expiration_status === 'EXPIRED') {
            return `${baseClass} bg-danger-25 hover:bg-danger-50`;
        } else if (item.expiration_status === 'EXPIRING_SOON') {
            return `${baseClass} bg-warning-25 hover:bg-warning-50`;
        } else if (parseFloat(item.quantity) <= 5) { // Assuming low stock threshold of 5
            return `${baseClass} bg-orange-25 hover:bg-orange-50`;
        }
        return baseClass;
    };
    
    const getExpirationBadge = (item) => {
        if (!item.expiration_date) {
            return <span className="text-xs text-secondary-400">No expiration</span>;
        }
        
        const status = item.expiration_status;
        const daysLeft = item.days_until_expiration;
        
        let badgeClass = 'badge-secondary';
        let label = 'Good';
        let icon = null;
        
        if (status === 'EXPIRED') {
            badgeClass = 'badge-danger';
            label = 'Expired';
            icon = <AlertTriangle className="w-3 h-3 mr-1" />;
        } else if (status === 'EXPIRING_SOON') {
            badgeClass = 'badge-warning';
            label = `${daysLeft} days left`;
            icon = <Clock className="w-3 h-3 mr-1" />;
        } else if (daysLeft !== null && daysLeft <= 60) {
            label = `${daysLeft} days left`;
        }
        
        return (
            <div className="flex flex-col items-start">
                <span className={`badge ${badgeClass} flex items-center text-xs`}>
                    {icon}
                    {label}
                </span>
                {item.expiration_date && (
                    <span className="text-xs text-secondary-400 mt-1">
                        {new Date(item.expiration_date).toLocaleDateString()}
                    </span>
                )}
            </div>
        );
    };
    return (
        <div className="overflow-x-auto">
            <table className="table">
                <thead className="table-header"><tr>
                    <th className="table-header-cell w-12"><input type="checkbox" className="checkbox" /></th>
                    <th className="table-header-cell">Item Name</th>
                    <th className="table-header-cell">Vendor</th>
                    <th className="table-header-cell">Total Amount</th>
                    <th className="table-header-cell">Expiration</th>
                    <th className="table-header-cell">Type</th>
                    <th className="table-header-cell w-24">Actions</th>
                </tr></thead>
                <tbody className="table-body">
                    {Object.values(groupedData).map(group => (
                        <React.Fragment key={group.id}>
                            <tr className="bg-secondary-25 hover:bg-secondary-50 transition-colors duration-150">
                                <td className="table-cell"><input type="checkbox" className="checkbox" /></td>
                                <td className="table-cell">
                                    <button onClick={() => toggleGroup(group.id)} className="flex items-center font-medium text-secondary-900 hover:text-primary-700 transition-colors group">
                                        <ChevronDown className={`w-4 h-4 mr-2 text-secondary-400 group-hover:text-primary-500 transition-all duration-200 ${expandedGroups[group.id] ? 'rotate-180' : ''}`} />
                                        {group.name}
                                    </button>
                                </td>
                                <td className="table-cell text-secondary-600">{group.vendor?.name || 'N/A'}</td>
                                <td className="table-cell">
                                    <span className="font-medium text-secondary-900">{group.totalQuantity.toFixed(2)}</span>
                                    <span className="text-secondary-500 ml-1">{group.instances[0]?.unit}</span>
                                </td>
                                <td className="table-cell">
                                    <span className="text-xs text-secondary-400">Multiple items</span>
                                </td>
                                <td className="table-cell">
                                    <span className="badge badge-secondary">{group.item_type?.name || 'N/A'}</span>
                                </td>
                                <td className="table-cell">
                                    <div className="flex items-center space-x-1">
                                        <button onClick={() => onEdit(group.instances[0])} className="p-2 hover:bg-primary-50 rounded-lg transition-colors group">
                                            <Edit className="w-4 h-4 text-secondary-400 group-hover:text-primary-600" />
                                        </button>
                                        <div className="relative">
                                            <button className="p-2 hover:bg-danger-50 rounded-lg transition-colors group">
                                                <Trash2 className="w-4 h-4 text-secondary-400 group-hover:text-danger-600" />
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            {expandedGroups[group.id] && group.instances.map(instance => (
                                <tr key={instance.id} className={getRowClassName(instance)}>
                                    <td className="table-cell"></td>
                                    <td className="table-cell pl-16">
                                        <div className="text-sm text-secondary-700">
                                            <span className="text-secondary-500">Location:</span> {instance.location?.name || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="text-sm text-secondary-600">
                                            <span className="text-secondary-500">Owner:</span> {instance.owner?.username || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="text-sm">
                                            <span className="font-medium text-secondary-900">{parseFloat(instance.quantity).toFixed(2)}</span>
                                            <span className="text-secondary-500 ml-1">{instance.unit}</span>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        {getExpirationBadge(instance)}
                                    </td>
                                    <td className="table-cell">
                                        <div className="text-sm text-secondary-500">
                                            {new Date(instance.updated_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center space-x-1">
                                            <button onClick={() => onEdit(instance)} className="p-2 hover:bg-primary-50 rounded-lg transition-colors group">
                                                <Edit className="w-4 h-4 text-secondary-400 group-hover:text-primary-600" />
                                            </button>
                                            <button onClick={() => onDelete(instance)} className="p-2 hover:bg-danger-50 rounded-lg transition-colors group">
                                                <Trash2 className="w-4 h-4 text-secondary-400 group-hover:text-danger-600" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default InventoryTable;
