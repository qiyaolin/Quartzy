import React from 'react';
import { X, Package, FileText, BarChart3, DollarSign, Users, LogOut, User } from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: string;
  onNavigate: (page: string) => void;
  user: any;
  onLogout: () => void;
}

const MobileSidebarDrawer: React.FC<MobileSidebarDrawerProps> = ({
  isOpen,
  onClose,
  activePage,
  onNavigate,
  user,
  onLogout
}) => {
  const navigationItems: NavigationItem[] = [
    { id: 'inventory', label: 'Inventory', icon: Package, adminOnly: false },
    { id: 'requests', label: 'Requests', icon: FileText, adminOnly: false },
    { id: 'reports', label: 'Reports', icon: BarChart3, adminOnly: false },
    { id: 'funding', label: 'Funding', icon: DollarSign, adminOnly: true },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  ];

  const visibleNavItems = navigationItems.filter(item => 
    !item.adminOnly || user?.is_staff
  );

  const handleNavigate = (page: string) => {
    onNavigate(page);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-50 transform transition-transform duration-300 ease-out shadow-xl safe-area-inset-left">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 safe-area-inset-top">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bio Inventory</h2>
              <p className="text-sm text-gray-500">Management System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors duration-200 touch-manipulation"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-semibold">
              {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.username || 'Unknown User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || 'No email'}
              </p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                user?.is_staff 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {user?.is_staff ? 'Administrator' : 'User'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center px-4 py-4 text-left rounded-xl transition-all duration-200 touch-manipulation ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg mr-4 ${
                  isActive 
                    ? 'bg-primary-100 text-primary-600' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">
                    {item.id === 'inventory' && 'Manage lab inventory'}
                    {item.id === 'requests' && 'View and manage requests'}
                    {item.id === 'reports' && 'Analytics and insights'}
                    {item.id === 'funding' && 'Financial management'}
                    {item.id === 'users' && 'User administration'}
                  </div>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 safe-area-inset-bottom">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center px-4 py-4 text-left text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200 touch-manipulation"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-100 text-red-600 mr-4">
              <LogOut size={20} />
            </div>
            <div className="flex-1">
              <div className="font-medium">Sign Out</div>
              <div className="text-xs text-red-500">Exit the application</div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileSidebarDrawer;