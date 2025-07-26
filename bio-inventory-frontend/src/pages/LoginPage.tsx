import React, { useState, useContext } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';
import { AuthContext } from '../components/AuthContext.tsx';

const LoginPage = () => {
    const auth = useContext(AuthContext);
    if (!auth) {
        throw new Error('LoginPage must be used within an AuthProvider');
    }
    const { login } = auth;
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setError('');
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.LOGIN), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (response.ok) {
                const data = await response.json();
                login(data.token); // The login function from context will handle the rest
            } else {
                setError('Invalid username or password.');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="card p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft">
                            <div className="w-8 h-8 bg-white rounded-lg opacity-90"></div>
                        </div>
                        <h2 className="text-3xl font-bold text-secondary-900 mb-2">Welcome Back</h2>
                        <p className="text-secondary-600">Sign in to access Hayer Lab Bio Inventory</p>
                    </div>
                    
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-secondary-700 mb-2">Username</label>
                                <input 
                                    id="username" 
                                    name="username" 
                                    type="text" 
                                    required 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    className="input" 
                                    placeholder="Enter your username" 
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">Password</label>
                                <input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    required 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    className="input" 
                                    placeholder="Enter your password" 
                                />
                            </div>
                        </div>
                        
                        {error && (
                            <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            disabled={isLoggingIn} 
                            className="btn btn-primary w-full py-3 text-base font-semibold shadow-soft hover:shadow-medium transition-all duration-200 hover:-translate-y-0.5"
                        >
                            {isLoggingIn && <div className="loading-spinner w-4 h-4 mr-2"></div>}
                            {isLoggingIn ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>
                </div>
                
                <div className="text-center mt-6">
                    <p className="text-sm text-secondary-500">
                        Powered by Hayer Lab Bio Inventory System
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
