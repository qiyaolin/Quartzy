import React, { useState, useEffect, useCallback, createContext, useMemo } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

interface AuthContextType {
  user: any;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(() => {
        try {
            return localStorage.getItem('authToken');
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState<boolean>(false);

    const handleLogin = useCallback((newToken: string) => {
        setToken(newToken);
        try {
            localStorage.setItem('authToken', newToken);
        } catch (e) {
            console.error('Failed to save token to localStorage:', e);
        }
    }, []);

    const handleLogout = useCallback(() => {
        setToken(null);
        setUser(null);
        try {
            localStorage.removeItem('authToken');
        } catch (e) {
            console.error('Failed to remove token from localStorage:', e);
        }
    }, []);

    useEffect(() => {
        if (token) {
            setLoading(true);
            // Fetch user details when token is available
            const fetchUser = async () => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
                    
                    const response = await fetch(buildApiUrl(API_ENDPOINTS.USER_ME), {
                        headers: { 'Authorization': `Token ${token}` },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                    } else if (response.status === 401) {
                        // Token is invalid, log out
                        console.warn('Invalid token, logging out');
                        handleLogout();
                    } else {
                        // Other errors, don't logout but log the error
                        console.error('Failed to fetch user, status:', response.status);
                        setUser(null);
                    }
                } catch (e) {
                    console.error("Failed to fetch user", e);
                    // 网络错误时不要登出，只是设置用户为null
                    // 这样用户仍然可以看到登录页面而不是白屏
                    if (e.name === 'AbortError') {
                        console.warn('User fetch request timed out');
                    }
                    setUser(null);
                } finally {
                    setLoading(false);
                }
            };
            fetchUser();
        } else {
            setUser(null);
            setLoading(false);
        }
    }, [token, handleLogout]);

    // 使用 useMemo 来稳定 context value，避免不必要的重新渲染
    const value = useMemo(() => ({
        user,
        token,
        login: handleLogin,
        logout: handleLogout,
        loading,
        isAuthenticated: !!token
    }), [user, token, handleLogin, handleLogout, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
