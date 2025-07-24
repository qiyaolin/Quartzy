import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, Edit, Trash2, AlertTriangle, Clock, Package, History } from 'lucide-react';
import { useDebouncedCallback, shallowEqual } from '../utils/performance';

interface Item {
  id: number;
  name: string;
  quantity: number;
  location: string;
  expiration_date?: string;
  expiration_status?: 'EXPIRED' | 'EXPIRING_SOON' | 'GOOD';
  days_until_expiration?: number;
  is_low_stock?: boolean;
}

interface GroupedData {
  [key: string]: {
    id: number;
    instances: Item[];
  };
}

interface Props {
  groupedData: GroupedData;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onViewRequestHistory: (item: Item) => void;
  onBatchAction: (action: string, selectedItems: Set<number>) => void;
}

// Memoized row component for better performance
const InventoryRow = React.memo(({ 
  item, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onViewRequestHistory 
}: {
  item: Item;
  isSelected: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onViewRequestHistory: (item: Item) => void;
}) => {
  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(item.id, e.target.checked);
  }, [item.id, onSelect]);

  const handleEdit = useCallback(() => onEdit(item), [item, onEdit]);
  const handleDelete = useCallback(() => onDelete(item), [item, onDelete]);
  const handleViewHistory = useCallback(() => onViewRequestHistory(item), [item, onViewRequestHistory]);

  const rowClassName = useMemo(() => {
    const baseClass = "table-row";
    if (item.expiration_status === 'EXPIRED') {
      return `${baseClass} bg-danger-25 hover:bg-danger-50`;
    } else if (item.expiration_status === 'EXPIRING_SOON') {
      return `${baseClass} bg-warning-25 hover:bg-warning-50`;
    } else if (item.is_low_stock) {
      return `${baseClass} bg-orange-25 hover:bg-orange-50`;
    }
    return baseClass;
  }, [item.expiration_status, item.is_low_stock]);

  const expirationBadge = useMemo(() => {
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
  }, [item.expiration_date, item.expiration_status, item.days_until_expiration]);

  return (
    <tr className={rowClassName}>
      <td className="table-cell">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectChange}
          className="rounded border-gray-300"
        />
      </td>
      <td className="table-cell font-medium">{item.name}</td>
      <td className="table-cell">{item.quantity}</td>
      <td className="table-cell">{item.location}</td>
      <td className="table-cell">{expirationBadge}</td>
      <td className="table-cell">
        <div className="flex space-x-2">
          <button
            onClick={handleEdit}
            className="p-1 text-primary-600 hover:text-primary-800 transition-colors"
            title="Edit item"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-danger-600 hover:text-danger-800 transition-colors"
            title="Delete item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleViewHistory}
            className="p-1 text-secondary-600 hover:text-secondary-800 transition-colors"
            title="View request history"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}, shallowEqual);

// Memoized group component
const InventoryGroup = React.memo(({ 
  groupId, 
  group, 
  isExpanded, 
  onToggle, 
  selectedItems, 
  onSelectItem, 
  onEdit, 
  onDelete, 
  onViewRequestHistory 
}: {
  groupId: string;
  group: { id: number; instances: Item[] };
  isExpanded: boolean;
  onToggle: (groupId: string) => void;
  selectedItems: Set<number>;
  onSelectItem: (id: number, checked: boolean) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onViewRequestHistory: (item: Item) => void;
}) => {
  const handleToggle = useCallback(() => onToggle(groupId), [groupId, onToggle]);

  const groupStatus = useMemo(() => {
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
  }, [group.instances]);

  const groupRowClassName = useMemo(() => {
    const baseClass = "bg-secondary-25 hover:bg-secondary-50 transition-colors duration-150";
    
    if (groupStatus.hasExpired) {
      return `${baseClass} border-l-4 border-danger-500 bg-danger-25 hover:bg-danger-50`;
    } else if (groupStatus.hasExpiringSoon) {
      return `${baseClass} border-l-4 border-warning-500 bg-warning-25 hover:bg-warning-50`;
    } else if (groupStatus.hasLowStock) {
      return `${baseClass} border-l-4 border-orange-500 bg-orange-25 hover:bg-orange-50`;
    }
    
    return baseClass;
  }, [groupStatus]);

  const statusIndicators = useMemo(() => {
    const indicators = [];
    
    if (groupStatus.hasExpired) {
      indicators.push(
        <div key="expired" className="flex items-center space-x-1 bg-danger-100 text-danger-700 px-2 py-1 rounded-md text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          <span>{groupStatus.expiredCount} Expired</span>
        </div>
      );
    }
    
    if (groupStatus.hasExpiringSoon) {
      indicators.push(
        <div key="expiring" className="flex items-center space-x-1 bg-warning-100 text-warning-700 px-2 py-1 rounded-md text-xs font-medium">
          <Clock className="w-3 h-3" />
          <span>{groupStatus.expiringSoonCount} Expiring Soon</span>
        </div>
      );
    }
    
    if (groupStatus.hasLowStock) {
      indicators.push(
        <div key="lowstock" className="flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-medium">
          <Package className="w-3 h-3" />
          <span>{groupStatus.lowStockCount} Low Stock</span>
        </div>
      );
    }
    
    return indicators;
  }, [groupStatus]);

  return (
    <>
      <tr 
        className={`cursor-pointer ${groupRowClassName}`}
        onClick={handleToggle}
      >
        <td colSpan={6} className="table-cell">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ChevronDown 
                className={`w-4 h-4 transition-transform duration-200 ${
                  isExpanded ? '' : '-rotate-90'
                }`} 
              />
              <span className="font-semibold text-secondary-900">
                {groupId} ({group.instances.length} items)
              </span>
            </div>
            {statusIndicators.length > 0 && (
              <div className="flex space-x-2">
                {statusIndicators}
              </div>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && group.instances.map((item) => (
        <InventoryRow
          key={item.id}
          item={item}
          isSelected={selectedItems.has(item.id)}
          onSelect={onSelectItem}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewRequestHistory={onViewRequestHistory}
        />
      ))}
    </>
  );
}, shallowEqual);

const OptimizedInventoryTable: React.FC<Props> = ({ 
  groupedData, 
  onEdit, 
  onDelete, 
  onViewRequestHistory, 
  onBatchAction 
}) => {
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const debouncedBatchAction = useDebouncedCallback((action: string, items: Set<number>) => {
    onBatchAction(action, items);
  }, 300);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const allItemIds = new Set<number>();
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
  }, [groupedData]);

  const handleSelectItem = useCallback((itemId: number, checked: boolean) => {
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
  }, [selectedItems, groupedData]);

  const sortedGroups = useMemo(() => {
    return Object.keys(groupedData).sort();
  }, [groupedData]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-secondary-200">
        <thead className="bg-secondary-50">
          <tr>
            <th className="table-header w-12">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300"
              />
            </th>
            <th className="table-header text-left">Name</th>
            <th className="table-header text-left">Quantity</th>
            <th className="table-header text-left">Location</th>
            <th className="table-header text-left">Expiration</th>
            <th className="table-header text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-secondary-200">
          {sortedGroups.map((groupId) => (
            <InventoryGroup
              key={groupId}
              groupId={groupId}
              group={groupedData[groupId]}
              isExpanded={expandedGroups[groupId]}
              onToggle={toggleGroup}
              selectedItems={selectedItems}
              onSelectItem={handleSelectItem}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewRequestHistory={onViewRequestHistory}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(OptimizedInventoryTable, shallowEqual);