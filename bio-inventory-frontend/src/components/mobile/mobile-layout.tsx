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
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 font-sans">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.2'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3Ccircle cx='53' cy='7' r='1'/%3E%3Ccircle cx='7' cy='53' r='1'/%3E%3Ccircle cx='53' cy='53' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>
      
      {/* Top Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-xl border-b border-white/20 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {user?.first_name || user?.username || 'User'}
              </p>
              <p className="text-xs text-gray-500 font-medium">
                {user?.role === 'admin' ? 'Administrator' : 'Laboratory User'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 active:scale-95"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-y-auto pb-32 scrollbar-thin">
        <Outlet />
      </main>
      
      {/* Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-xl border-t border-white/20 shadow-2xl">
        <div className="safe-area-inset-bottom">
          <nav className="flex justify-around items-center h-16 px-2">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-full text-xs font-medium transition-all duration-300 h-full rounded-xl mx-1 ${
                    isActive 
                      ? 'text-blue-600 bg-blue-50 scale-105' 
                      : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50/50 active:scale-95'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center mb-1 transition-all duration-300 ${
                      isActive ? 'transform scale-110' : ''
                    }`}>
                      <item.icon className={`w-6 h-6 ${
                        isActive ? 'drop-shadow-sm' : ''
                      }`} />
                    </div>
                    <span className={`text-center font-medium ${
                      isActive ? 'text-blue-700' : ''
                    }`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default MobileLayout;