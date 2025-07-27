import { useState, useCallback } from 'react';
import { formatErrorMessage } from '../utils/dataValidation.ts';

interface ErrorState {
  hasError: boolean;
  error: string | null;
  errorCode?: string;
  retryCount: number;
}

interface MobileErrorHandlerOptions {
  maxRetries?: number;
  onError?: (error: string, errorCode?: string) => void;
  onRetry?: () => void;
}

export const useMobileErrorHandler = (options: MobileErrorHandlerOptions = {}) => {
  const { maxRetries = 3, onError, onRetry } = options;
  
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    retryCount: 0
  });

  const handleError = useCallback((error: any, errorCode?: string) => {
    const formattedError = formatErrorMessage(error);
    
    setErrorState(prev => ({
      hasError: true,
      error: formattedError,
      errorCode,
      retryCount: prev.retryCount
    }));

    // 调用外部错误处理函数
    if (onError) {
      onError(formattedError, errorCode);
    }

    // 在开发环境中记录详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('Mobile Error Handler:', {
        error,
        errorCode,
        formattedError,
        timestamp: new Date().toISOString()
      });
    }
  }, [onError]);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      retryCount: 0
    });
  }, []);

  const retry = useCallback(() => {
    if (errorState.retryCount >= maxRetries) {
      console.warn('Maximum retry attempts reached');
      return false;
    }

    setErrorState(prev => ({
      ...prev,
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1
    }));

    if (onRetry) {
      onRetry();
    }

    return true;
  }, [errorState.retryCount, maxRetries, onRetry]);

  const canRetry = errorState.retryCount < maxRetries;

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
    canRetry
  };
};

// Mobile network status detection Hook
export const useMobileNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkType, setNetworkType] = useState<string>('unknown');

  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect network type (if supported)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setNetworkType(connection.effectiveType || 'unknown');
      
      const handleConnectionChange = () => {
        setNetworkType(connection.effectiveType || 'unknown');
      };
      
      connection.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  return { isOnline, networkType };
};

// Mobile loading state management Hook
export const useMobileLoadingState = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }));
  }, []);

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    loadingStates
  };
};