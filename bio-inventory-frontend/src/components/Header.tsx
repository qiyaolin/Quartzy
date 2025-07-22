import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
    Search, 
    MoreVertical, 
    FileText, 
    Package, 
    History, 
    Users, 
    LogOut, 
    DollarSign, 
    Bell,
    Settings,
    ChevronDown,
    Menu,
    X,
    Zap
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

const Header = ({ activePage, onNavigate, inventoryFilters, requestFilters, handleInventoryFilterChange, handleRequestFilterChange }) => {
    const { user, logout } = useContext(AuthContext);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const userMenuRef = useRef(null);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navigationItems = [
        { key: 'requests', label: 'Requests', icon: FileText, adminOnly: false },
        { key: 'inventory', label: 'Inventory', icon: Package, adminOnly: false },
        { key: 'reports', label: 'Dashboard', icon: History, adminOnly: false },
        { key: 'funding', label: 'Funding', icon: DollarSign, adminOnly: true },
        { key: 'users', label: 'Users', icon: Users, adminOnly: true },
    ];

    const visibleNavItems = navigationItems.filter(item => 
        !item.adminOnly || user?.is_staff
    );

    return (
        <header className="bg-white/95 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div className="h-16 flex items-center justify-between px-4 lg:px-6">
                {/* Logo and Brand */}
                <div className="flex items-center">
                    <div className="flex items-center space-x-4 mr-6 lg:mr-8">
                        <div className="relative">
                            <div className="w-10 h-10 gradient-ocean rounded-2xl flex items-center justify-center shadow-lg">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-xl text-gray-900 tracking-tight">Hayer Lab</span>
                            <span className="text-xs text-gray-500 -mt-1 hidden sm:block font-medium">Bio Inventory System</span>
                        </div>
                    </div>
                    
                    {/* Mobile menu button */}
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95"
                        aria-label="Toggle mobile menu"
                    >
                        {isMobileMenuOpen ? (
                            <X className="w-5 h-5 text-gray-600" />
                        ) : (
                            <Menu className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                    
                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-2">
                        {visibleNavItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activePage === item.key;
                            
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => onNavigate(item.key)}
                                    className={`relative flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 group ${
                                        isActive 
                                            ? 'text-white bg-gradient-to-r from-primary-600 to-primary-700 shadow-lg shadow-primary-500/25' 
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 mr-2 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                                    {item.label}
                                    {isActive && (
                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 opacity-20 animate-pulse"></div>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                
                {/* Enhanced Search Bar */}
                <div className="hidden xl:flex items-center flex-grow max-w-lg mx-8">
                    <div className={`relative w-full transition-all duration-300 ${searchFocused ? 'transform scale-105' : ''}`}>
                        <input 
                            type="text" 
                            placeholder="Search inventory, requests, and more..." 
                            className={`w-full h-11 pl-11 pr-4 bg-gray-50/80 border border-gray-200 rounded-2xl text-sm placeholder-gray-400 
                                     transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                                     hover:bg-gray-100/80 hover:border-gray-300 ${searchFocused ? 'shadow-lg bg-white' : ''}`}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            onChange={(e) => {
                                if (activePage === 'inventory') {
                                    handleInventoryFilterChange('search', e.target.value);
                                } else if (activePage === 'requests') {
                                    handleRequestFilterChange('search', e.target.value);
                                }
                            }}
                            value={activePage === 'inventory' ? inventoryFilters.search : 
                                   activePage === 'requests' ? requestFilters.search : ''}
                        />
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                            searchFocused ? 'text-primary-500' : 'text-gray-400'
                        }`} />
                        {searchFocused && (
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-primary-600/10 pointer-events-none"></div>
                        )}
                    </div>
                </div>
                
                {/* Right Side Actions */}
                <div className="flex items-center space-x-3">
                    {/* Notifications */}
                    <button className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 group">
                        <Bell className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                        <div className="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full animate-pulse"></div>
                    </button>

                    {/* User Menu */}
                    <div className="relative" ref={userMenuRef}>
                        <button 
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className={`flex items-center space-x-3 p-2 pr-3 rounded-2xl transition-all duration-300 group ${
                                isUserMenuOpen 
                                    ? 'bg-gray-100 shadow-md' 
                                    : 'hover:bg-gray-100/80 hover:shadow-sm'
                            }`}
                        >
                            <div className="relative">
                                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md">
                                    {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-semibold text-gray-900">{user?.username}</p>
                                <p className="text-xs text-gray-500">{user?.is_staff ? 'Administrator' : 'User'}</p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                isUserMenuOpen ? 'rotate-180' : ''
                            }`} />
                        </button>

                        {/* User Dropdown */}
                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-in z-50">
                                {/* User Info Header */}
                                <div className="px-4 py-4 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-md">
                                            {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{user?.username}</p>
                                            <p className="text-sm text-gray-600">{user?.email || 'No email'}</p>
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-medium ${
                                                user?.is_staff 
                                                    ? 'bg-primary-100 text-primary-700' 
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {user?.is_staff ? 'Administrator' : 'User'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="p-2">
                                    <button className="w-full flex items-center px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors duration-200 group">
                                        <Settings className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-600" />
                                        Settings
                                    </button>
                                    <div className="h-px bg-gray-100 my-2"></div>
                                    <button 
                                        onClick={() => {
                                            setIsUserMenuOpen(false);
                                            logout();
                                        }}
                                        className="w-full flex items-center px-3 py-2.5 text-sm text-danger-600 hover:bg-danger-50 rounded-xl transition-colors duration-200 group"
                                    >
                                        <LogOut className="w-4 h-4 mr-3 text-danger-500 group-hover:text-danger-600" />
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Enhanced Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md animate-slide-down">
                    <nav className="px-4 py-6 space-y-3">
                        {/* Mobile Search */}
                        <div className="relative mb-6">
                            <input 
                                type="text" 
                                placeholder="Search inventory, requests..." 
                                className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm placeholder-gray-400 
                                         focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
                                onChange={(e) => {
                                    if (activePage === 'inventory') {
                                        handleInventoryFilterChange('search', e.target.value);
                                    } else if (activePage === 'requests') {
                                        handleRequestFilterChange('search', e.target.value);
                                    }
                                }}
                                value={activePage === 'inventory' ? inventoryFilters.search : 
                                       activePage === 'requests' ? requestFilters.search : ''}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        {/* Mobile Navigation Items */}
                        {visibleNavItems.map((item, index) => {
                            const Icon = item.icon;
                            const isActive = activePage === item.key;
                            
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => {
                                        onNavigate(item.key);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center px-4 py-4 text-sm font-medium rounded-2xl transition-all duration-300 animate-slide-in-right ${
                                        isActive 
                                            ? 'text-white bg-gradient-to-r from-primary-600 to-primary-700 shadow-lg shadow-primary-500/25' 
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    <div className={`p-2 rounded-xl mr-4 ${
                                        isActive 
                                            ? 'bg-white/20' 
                                            : 'bg-gray-100 group-hover:bg-gray-200'
                                    }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold">{item.label}</div>
                                        <div className={`text-xs ${
                                            isActive ? 'text-white/70' : 'text-gray-500'
                                        }`}>
                                            {item.key === 'requests' && 'Manage lab requests'}
                                            {item.key === 'inventory' && 'Browse lab inventory'}
                                            {item.key === 'reports' && 'View analytics'}
                                            {item.key === 'funding' && 'Financial management'}
                                            {item.key === 'users' && 'User administration'}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                    )}
                                </button>
                            );
                        })}

                        {/* Mobile User Info */}
                        <div className="pt-6 mt-6 border-t border-gray-200">
                            <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl">
                                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">
                                    {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{user?.username}</p>
                                    <p className="text-sm text-gray-600">{user?.is_staff ? 'Administrator' : 'User'}</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        logout();
                                    }}
                                    className="p-2.5 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 group"
                                >
                                    <LogOut className="w-4 h-4 text-gray-600 group-hover:text-danger-600" />
                                </button>
                            </div>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Header;
