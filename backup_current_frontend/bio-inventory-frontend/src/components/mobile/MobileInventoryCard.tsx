import React from 'react';
import { Package, MapPin, Calendar, AlertTriangle, Edit3, Trash2 } from 'lucide-react';

interface InventoryItem {
  id: number;
  name: string;
  vendor: string;
  location: string;
  quantity: number;
  unit: string;
  expiration_date?: string;
  status: string;
  low_stock_threshold?: number;
}

interface MobileInventoryCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onClick?: (item: InventoryItem) => void;
  isSelected?: boolean;
  onSelectionChange?: (item: InventoryItem, selected: boolean) => void;
  showSelection?: boolean;
}

const MobileInventoryCard: React.FC<MobileInventoryCardProps> = ({
  item,
  onEdit,
  onDelete,
  onClick,
  isSelected = false,
  onSelectionChange,
  showSelection = false
}) => {
  const isLowStock = item.low_stock_threshold && item.quantity <= item.low_stock_threshold;
  const isExpiringSoon = item.expiration_date && 
    new Date(item.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const getStatusColor = () => {
    if (isLowStock) return 'border-l-danger-500 bg-danger-50';
    if (isExpiringSoon) return 'border-l-warning-500 bg-warning-50';
    return 'border-l-success-500 bg-white';
  };

  const handleCardClick = () => {
    if (showSelection && onSelectionChange) {
      onSelectionChange(item, !isSelected);
    } else {
      onClick?.(item);
    }
  };

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-200 ${getStatusColor()} border-l-4 mb-4 overflow-hidden transition-all duration-200 touch-manipulation active:scale-[0.98] ${
        isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          {showSelection && (
            <div className="flex items-center mr-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelectionChange?.(item, e.target.checked);
                }}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
            </div>
          )}
          <h3 className="font-semibold text-gray-900 text-base flex-1 pr-3 leading-snug">
            {item.name}
          </h3>
          <div className="flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors duration-200 touch-manipulation"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-colors duration-200 touch-manipulation"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Quantity with status indicators */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Package size={18} className="text-gray-500" />
            <span className={`text-xl font-bold ${
              isLowStock ? 'text-danger-600' : 'text-gray-900'
            }`}>
              {item.quantity}
            </span>
            <span className="text-sm text-gray-500 font-medium">{item.unit}</span>
          </div>
          
          {(isLowStock || isExpiringSoon) && (
            <div className="flex flex-col space-y-1">
              {isLowStock && (
                <div className="flex items-center space-x-1 bg-danger-100 text-danger-700 px-3 py-1 rounded-full">
                  <AlertTriangle size={12} />
                  <span className="text-xs font-medium">Low Stock</span>
                </div>
              )}
              {isExpiringSoon && (
                <div className="flex items-center space-x-1 bg-warning-100 text-warning-700 px-3 py-1 rounded-full">
                  <Calendar size={12} />
                  <span className="text-xs font-medium">Expiring Soon</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <Package size={16} className="text-gray-400 flex-shrink-0" />
            <span className="font-medium min-w-0">Vendor:</span>
            <span className="truncate">
              {typeof item.vendor === 'object' && item.vendor !== null
                ? (item.vendor as any).name || 'Unknown Vendor'
                : item.vendor}
            </span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <MapPin size={16} className="text-gray-400 flex-shrink-0" />
            <span className="font-medium min-w-0">Location:</span>
            <span className="truncate">
              {typeof item.location === 'object' && item.location !== null
                ? (item.location as any).name || 'Unknown Location'
                : item.location}
            </span>
          </div>
          
          {item.expiration_date && (
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <Calendar size={16} className="text-gray-400 flex-shrink-0" />
              <span className="font-medium min-w-0">Expires:</span>
              <span className={`truncate ${isExpiringSoon ? 'text-warning-600 font-medium' : ''}`}>
                {new Date(item.expiration_date).toLocaleDateString('en-US')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileInventoryCard;