import React from 'react';
import { Search, Bell, User, Filter, Plus, Menu } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showFilter?: boolean;
  onFilterClick?: () => void;
  showAdd?: boolean;
  onAddClick?: () => void;
  showMenuToggle?: boolean;
  onMenuToggle?: () => void;
  notificationCount?: number;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  showFilter = false,
  onFilterClick,
  showAdd = false,
  onAddClick,
  showMenuToggle = false,
  onMenuToggle,
  notificationCount = 0
}) => {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40 safe-area-inset-top">
      {/* Main header */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between min-h-[44px]">
          {/* Left side */}
          <div className="flex items-center space-x-3">
            {showMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors duration-200 touch-manipulation"
              >
                <Menu size={24} />
              </button>
            )}
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h1>
          </div>
          
          {/* Right side actions */}
          <div className="flex items-center space-x-1">
            {showFilter && (
              <button
                onClick={onFilterClick}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors duration-200 touch-manipulation"
              >
                <Filter size={20} />
              </button>
            )}
            
            {showAdd && (
              <button
                onClick={onAddClick}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white hover:bg-primary-700 rounded-xl transition-colors duration-200 touch-manipulation"
              >
                <Plus size={20} />
              </button>
            )}
            
            {/* Notifications */}
            <button className="relative min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors duration-200 touch-manipulation">
              <Bell size={20} />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 bg-danger-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium text-[10px]">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
            
            {/* User profile */}
            <button className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors duration-200 touch-manipulation">
              <User size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Search bar */}
      {showSearch && (
        <div className="px-4 pb-4">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search..."
              className="w-full h-[44px] pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 touch-manipulation"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileHeader;