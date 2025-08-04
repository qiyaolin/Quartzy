import { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './components/AuthContext';
import MobileLayout from './components/mobile/mobile-layout';
import MobileDashboardPage from './pages/mobile/dashboard-page';
import MobileInventoryListPage from './pages/mobile/inventory-list-page';
import MobileRequestsPage from './pages/mobile/requests-page';
import MobileNotificationsPage from './pages/mobile/notifications-page';
import MobileLoginPage from './pages/mobile/login-page';

// 移动端私有路由保护组件
const MobilePrivateRoute = ({ children }: { children: JSX.Element }) => {
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    throw new Error('MobilePrivateRoute must be used within an AuthProvider');
  }
  
  const { isAuthenticated } = authContext;
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const MobileApp = () => {
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    throw new Error('MobileApp must be used within an AuthProvider');
  }
  
  const { isAuthenticated } = authContext;

  return (
    <Routes>
      {/* 登录页面 - 如果已登录则重定向到主面板 */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? 
          <Navigate to="/mobile/dashboard" replace /> : 
          <MobileLoginPage />
        } 
      />
      
      {/* 受保护的移动端路由 */}
      <Route 
        path="/mobile" 
        element={
          <MobilePrivateRoute>
            <MobileLayout />
          </MobilePrivateRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<MobileDashboardPage />} />
        <Route path="inventory" element={<MobileInventoryListPage />} />
        <Route path="requests" element={<MobileRequestsPage />} />
        <Route path="notifications" element={<MobileNotificationsPage />} />
      </Route>
      
      {/* 默认重定向 - 根据认证状态决定 */}
      <Route 
        path="*" 
        element={
          <Navigate 
            to={isAuthenticated ? "/mobile/dashboard" : "/login"} 
            replace 
          />
        } 
      />
    </Routes>
  );
};

export default MobileApp;