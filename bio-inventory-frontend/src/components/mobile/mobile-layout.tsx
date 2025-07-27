import { useContext } from 'react';
import { Home, List, Bell, Send, LogOut, User } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { AuthContext } from '../AuthContext.tsx';

const navItems = [
  { to: '/mobile/dashboard', icon: Home, label: 'Home' },
  { to: '/mobile/inventory', icon: List, label: 'Inventory' },
  { to: '/mobile/requests', icon: Send, label: 'Requests' },
  { to: '/mobile/notifications', icon: Bell, label: 'Notifications' },
];

const MobileLayout = () => {
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    throw new Error('MobileLayout must be used within an AuthProvider');
  }
  
  const { user, logout } = authContext;

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">
              {user?.first_name || user?.username || 'User'}
            </p>
            <p className="text-xs text-gray-500">
              {user?.role === 'admin' ? 'Administrator' : 'User'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-red-500 transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <nav className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full text-sm font-medium transition-colors h-full ${
                  isActive ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'
                }`
              }
            >
              <div className="flex items-center justify-center">
                <item.icon className="w-6 h-6 mb-1" />
              </div>
              <span className="text-center">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </footer>
    </div>
  );
};

export default MobileLayout;