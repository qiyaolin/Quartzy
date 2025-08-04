import React, { useContext } from 'react';
import { AuthProvider, AuthContext } from './components/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import MainApp from './MainApp';
import LoginPage from './pages/LoginPage';

const App = () => (
  <ErrorBoundary>
    <NotificationProvider>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </NotificationProvider>
  </ErrorBoundary>
);

const AuthConsumer = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  const { token, loading } = context;
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  return token ? <MainApp /> : <LoginPage />;
};

export default App;