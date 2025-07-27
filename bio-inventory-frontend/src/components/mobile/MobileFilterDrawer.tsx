import React from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterSection {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'toggle';
  options?: FilterOption[];
  value?: any;
}

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filters: FilterSection[];
  onFilterChange: (key: string, value: any) => void;
  onClearAll: () => void;
}

const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  title,
  filters,
  onFilterChange,
  onClearAll
}) => {
  if (!isOpen) return null;

  const renderFilterSection = (filter: FilterSection) => {
    switch (filter.type) {
      case 'select':
        return (
          <select
            value={filter.value || ''}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        
      case 'multiselect':
        return (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filter.options?.map((option) => {
              const isSelected = filter.value?.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const currentValue = filter.value || [];
                      const newValue = e.target.checked
                        ? [...currentValue, option.value]
                        : currentValue.filter((v: string) => v !== option.value);
                      onFilterChange(filter.key, newValue);
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              );
            })}
          </div>
        );
        
      case 'toggle':
        return (
          <div className="space-y-2">
            {filter.options?.map((option) => {
              const isSelected = filter.value?.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    const currentValue = filter.value || [];
                    const newValue = isSelected
                      ? currentValue.filter((v: string) => v !== option.value)
                      : [...currentValue, option.value];
                    onFilterChange(filter.key, newValue);
                  }}
                  className={`w-full p-3 text-left rounded-lg border transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClearAll}
              className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors duration-200"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {filter.label}
              </label>
              {renderFilterSection(filter)}
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 safe-area-inset-bottom">
          <button
            onClick={onClose}
            className="w-full bg-primary-600 text-white py-4 px-4 rounded-xl font-medium hover:bg-primary-700 transition-colors duration-200 touch-manipulation min-h-[44px]"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileFilterDrawer;