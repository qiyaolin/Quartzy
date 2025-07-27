import React from 'react';
import { AuthProvider, AuthContext } from './components/AuthContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import MainApp from './MainApp.tsx';
import LoginPage from './pages/LoginPage.tsx';

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
  const context = React.useContext(AuthContext);
  
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