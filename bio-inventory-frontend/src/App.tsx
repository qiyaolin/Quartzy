import React from 'react';
import { AuthProvider, AuthContext } from './components/AuthContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import MainApp from './MainApp.tsx';
import LoginPage from './pages/LoginPage.tsx';

const App = () => (
  <NotificationProvider>
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  </NotificationProvider>
);

const AuthConsumer = () => {
  const context = React.useContext(AuthContext);
  if (!context) return null; // 或者渲染 loading/error
  const { token } = context;
  return token ? <MainApp /> : <LoginPage />;
};

export default App;