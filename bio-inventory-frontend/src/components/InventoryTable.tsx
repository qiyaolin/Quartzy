import React, { useState } from 'react';
import { ChevronDown, Edit, Trash2, AlertTriangle, Clock, Package, History } from 'lucide-react';

const InventoryTable = ({ groupedData, onEdit, onDelete, onViewRequestHistory, onBatchAction }) => {
    const [expandedGroups, setExpandedGroups] = useState({});
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    
    const toggleGroup = (groupId) => { setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] })); };
    
    const handleSelectAll = (checked) => {
        setSelectAll(checked);
        if (checked) {
            const allItemIds = new Set();
            Object.values(groupedData).forEach(group => {
                allItemIds.add(group.id);
                group.instances.forEach(instance => {
                    allItemIds.add(instance.id);
                });
            });
            setSelectedItems(allItemIds);
        } else {
            setSelectedItems(new Set());
        }
    };
    
    const handleSelectItem = (itemId, checked) => {
        const newSelected = new Set(selectedItems);
        if (checked) {
            newSelected.add(itemId);
        } else {
            newSelected.delete(itemId);
        }
        setSelectedItems(newSelected);
        
        // Update select all checkbox
        const totalItems = Object.values(groupedData).reduce((count, group) => 
            count + 1 + group.instances.length, 0);
        setSelectAll(newSelected.size === totalItems);
    };
    
    const getRowClassName = (item) => {
        const baseClass = "table-row";
        if (item.expiration_status === 'EXPIRED') {
            return `${baseClass} bg-danger-25 hover:bg-danger-50`;
        } else if (item.expiration_status === 'EXPIRING_SOON') {
            return `${baseClass} bg-warning-25 hover:bg-warning-50`;
        } else if (item.is_low_stock) {
            return `${baseClass} bg-orange-25 hover:bg-orange-50`;
        }
        return baseClass;
    };

    const getGroupRowClassName = (group) => {
        const status = getGroupStatus(group);
        const baseClass = "bg-secondary-25 hover:bg-secondary-50 transition-colors duration-150";
        
        if (status.hasExpired) {
            return `${baseClass} border-l-4 border-danger-500 bg-danger-25 hover:bg-danger-50`;
        } else if (status.hasExpiringSoon) {
            return `${baseClass} border-l-4 border-warning-500 bg-warning-25 hover:bg-warning-50`;
        } else if (status.hasLowStock) {
            return `${baseClass} border-l-4 border-orange-500 bg-orange-25 hover:bg-orange-50`;
        }
        
        return baseClass;
    };
    
    const getGroupStatus = (group) => {
        const expiredCount = group.instances.filter(item => item.expiration_status === 'EXPIRED').length;
        const expiringSoonCount = group.instances.filter(item => item.expiration_status === 'EXPIRING_SOON').length;
        const lowStockCount = group.instances.filter(item => item.is_low_stock).length;
        
        return {
            hasExpired: expiredCount > 0,
            hasExpiringSoon: expiringSoonCount > 0,
            hasLowStock: lowStockCount > 0,
            expiredCount,
            expiringSoonCount,
            lowStockCount,
            totalInstances: group.instances.length
        };
    };

    const getStatusIndicators = (status) => {
        const indicators = [];
        
        if (status.hasExpired) {
            indicators.push(
                <div key="expired" className="flex items-center space-x-1 bg-danger-100 text-danger-700 px-2 py-1 rounded-md text-xs font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{status.expiredCount} Expired</span>
                </div>
            );
        }
        
        if (status.hasExpiringSoon) {
            indicators.push(
                <div key="expiring" className="flex items-center space-x-1 bg-warning-100 text-warning-700 px-2 py-1 rounded-md text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    <span>{status.expiringSoonCount} Expiring Soon</span>
                </div>
            );
        }
        
        if (status.hasLowStock) {
            indicators.push(
                <div key="lowstock" className="flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-medium">
                    <Package className="w-3 h-3" />
                    <span>{status.lowStockCount} Low Stock</span>
                </div>
            );
        }
        
        return indicators;
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
        <div className="card overflow-hidden">
            {/* Enhanced Selection Bar */}
            {selectedItems.size > 0 && (
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200 p-6 animate-slide-down">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-primary-500 rounded-2xl">
                                <span className="text-white font-bold text-sm">{selectedItems.size}</span>
                            </div>
                            <div>
                                <span className="text-lg font-semibold text-primary-900">
                                    {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                                </span>
                                <p className="text-sm text-primary-700">Choose an action to apply to selected items</p>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                onClick={() => onBatchAction && onBatchAction('archive', Array.from(selectedItems))}
                                className="btn btn-secondary btn-sm hover:scale-105 transition-transform"
                            >
                                Archive Selected
                            </button>
                            <button 
                                onClick={() => onBatchAction && onBatchAction('export', Array.from(selectedItems))}
                                className="btn btn-secondary btn-sm hover:scale-105 transition-transform"
                            >
                                Export Selected
                            </button>
                            <button 
                                onClick={() => onBatchAction && onBatchAction('delete', Array.from(selectedItems))}
                                className="btn btn-danger btn-sm hover:scale-105 transition-transform"
                            >
                                Delete Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced Table */}
            <div className="overflow-x-auto">
                <table className="table">
                    <thead className="table-header">
                        <tr>
                            <th className="table-header-cell w-12">
                                <input 
                                    type="checkbox" 
                                    className="checkbox" 
                                    checked={selectAll}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="table-header-cell">
                                <div className="flex items-center space-x-2">
                                    <Package className="w-4 h-4 text-gray-500" />
                                    <span>Item Name</span>
                                </div>
                            </th>
                            <th className="table-header-cell">Vendor</th>
                            <th className="table-header-cell">Total Amount</th>
                            <th className="table-header-cell">Expiration Status</th>
                            <th className="table-header-cell">Type</th>
                            <th className="table-header-cell w-24">Actions</th>
                        </tr>
                    </thead>
                <tbody className="table-body">
                    {Object.values(groupedData).map(group => (
                        <React.Fragment key={group.id}>
                            <tr className={getGroupRowClassName(group)}>
                                <td className="table-cell">
                                    <input 
                                        type="checkbox" 
                                        className="checkbox" 
                                        checked={selectedItems.has(group.id)}
                                        onChange={(e) => handleSelectItem(group.id, e.target.checked)}
                                    />
                                </td>
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
                                    <div className="flex flex-wrap gap-1">
                                        {getStatusIndicators(getGroupStatus(group))}
                                        {getStatusIndicators(getGroupStatus(group)).length === 0 && (
                                            <span className="text-xs text-secondary-400">All items OK</span>
                                        )}
                                    </div>
                                </td>
                                <td className="table-cell">
                                    <span className="badge badge-secondary">{group.item_type?.name || 'N/A'}</span>
                                </td>
                                <td className="table-cell">
                                    <div className="flex items-center space-x-1">
                                        <button 
                                            onClick={() => onEdit(group.instances[0])} 
                                            className="p-2.5 hover:bg-primary-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                            title="Edit item"
                                        >
                                            <Edit className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                                        </button>
                                        <button 
                                            onClick={() => onViewRequestHistory && onViewRequestHistory(group.instances[0])} 
                                            className="p-2.5 hover:bg-info-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                            title="View request history"
                                        >
                                            <History className="w-4 h-4 text-gray-400 group-hover:text-info-600 transition-colors" />
                                        </button>
                                        <button 
                                            className="p-2.5 hover:bg-danger-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                            title="Delete item"
                                        >
                                            <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-danger-600 transition-colors" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {expandedGroups[group.id] && group.instances.map(instance => (
                                <tr key={instance.id} className={getRowClassName(instance)}>
                                    <td className="table-cell">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox" 
                                            checked={selectedItems.has(instance.id)}
                                            onChange={(e) => handleSelectItem(instance.id, e.target.checked)}
                                        />
                                    </td>
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
                                        <span className="badge badge-secondary text-xs">{group.item_type?.name || 'N/A'}</span>
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center space-x-1">
                                            <button 
                                                onClick={() => onEdit(instance)} 
                                                className="p-2.5 hover:bg-primary-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                                title="Edit instance"
                                            >
                                                <Edit className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                                            </button>
                                            <button 
                                                onClick={() => onViewRequestHistory && onViewRequestHistory(instance)} 
                                                className="p-2.5 hover:bg-info-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                                title="View request history"
                                            >
                                                <History className="w-4 h-4 text-gray-400 group-hover:text-info-600 transition-colors" />
                                            </button>
                                            <button 
                                                onClick={() => onDelete(instance)} 
                                                className="p-2.5 hover:bg-danger-50 rounded-xl transition-all duration-200 group hover:scale-105 hover:shadow-md"
                                                title="Delete instance"
                                            >
                                                <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-danger-600 transition-colors" />
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
        </div>
    );
};

export default InventoryTable;
