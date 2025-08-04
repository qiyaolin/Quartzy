import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 记录错误信息到state
    this.setState({ errorInfo });
    
    // 调用外部错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // 发送错误报告到服务器（可选）
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // 在生产环境中发送错误报告
    if (process.env.NODE_ENV === 'production') {
      try {
        // 这里可以集成错误监控服务，如Sentry
        console.log('Error reported:', {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 检测是否为移动端
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 safe-area-inset">
          <div className={`w-full bg-white rounded-xl shadow-lg p-6 text-center ${
            isMobile ? 'max-w-sm mx-4' : 'max-w-md'
          }`}>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className={`font-semibold text-gray-900 mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
              Application Error
            </h2>
            
            <p className={`text-gray-600 mb-6 ${isMobile ? 'text-sm' : 'text-base'}`}>
              Sorry, the application encountered an error. This may be due to network issues or data loading problems.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className={`w-full bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-manipulation ${
                  isMobile ? 'py-3 px-4 text-sm min-h-[44px]' : 'py-2 px-4'
                }`}
              >
                Refresh Page
              </button>
              
              <button
                onClick={this.handleRetry}
                className={`w-full bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors touch-manipulation ${
                  isMobile ? 'py-3 px-4 text-sm min-h-[44px]' : 'py-2 px-4'
                }`}
              >
                Retry
              </button>
              
              {isMobile && (
                <button
                  onClick={() => window.history.back()}
                  className="w-full bg-blue-100 text-blue-800 py-3 px-4 rounded-lg hover:bg-blue-200 transition-colors touch-manipulation text-sm min-h-[44px]"
                >
                  Go Back
                </button>
              )}
            </div>
            
            {/* Show error details in development environment */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development Mode)
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
                    <strong>Error Message:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{this.state.error.message}</pre>
                  </div>
                  
                  {this.state.error.stack && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{this.state.error.stack}</pre>
                    </div>
                  )}
                  
                  {this.state.errorInfo?.componentStack && (
                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded overflow-auto max-h-32">
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            {/* Mobile tips */}
            {isMobile && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 Tip: If the problem persists, try clearing your browser cache or using a different browser.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;