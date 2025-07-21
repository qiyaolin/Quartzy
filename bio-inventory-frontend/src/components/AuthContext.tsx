import React, { useState, useEffect, useCallback, createContext } from 'react';

interface AuthContextType {
  user: any;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('authToken'));

    useEffect(() => {
        if (token) {
            localStorage.setItem('authToken', token);
            // Fetch user details when token is available
            const fetchUser = async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/users/me/', {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                    } else {
                        // Token is invalid, log out
                        handleLogout();
                    }
                } catch (e) {
                    console.error("Failed to fetch user", e);
                    handleLogout();
                }
            };
            fetchUser();
        } else {
            localStorage.removeItem('authToken');
            setUser(null);
        }
    }, [token]);

    const handleLogin = (newToken) => {
        setToken(newToken);
    };

    const handleLogout = useCallback(() => {
        setToken(null);
    }, []);

    const value = { user, token, login: handleLogin, logout: handleLogout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
