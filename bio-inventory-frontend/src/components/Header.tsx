import React, { useState, useContext } from 'react';
import { Search, MoreVertical, FileText, Package, History, Users, LogOut } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

const Header = ({ activePage, onNavigate, inventoryFilters, requestFilters, handleInventoryFilterChange, handleRequestFilterChange }) => {
    const { user, logout } = useContext(AuthContext);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    return (
        <header className="bg-white/95 backdrop-blur-sm border-b border-secondary-200 sticky top-0 z-30 shadow-soft">
            <div className="h-16 flex items-center justify-between px-4 md:px-6">
                <div className="flex items-center">
                    <div className="flex items-center space-x-3 mr-4 md:mr-8">
                        <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-soft">
                            <div className="w-5 h-5 bg-white rounded-sm opacity-90"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg text-secondary-900">Hayer Lab</span>
                            <span className="text-xs text-secondary-500 -mt-1 hidden sm:block">Bio Inventory</span>
                        </div>
                    </div>
                    
                    {/* Mobile menu button */}
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 rounded-lg hover:bg-secondary-100 transition-colors"
                    >
                        <MoreVertical className="w-5 h-5 text-secondary-600" />
                    </button>
                    
                    <nav className="hidden md:flex items-center space-x-1">
                        <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('requests')}} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'requests' ? 'text-primary-700 bg-primary-50 shadow-inner-soft' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><FileText className="w-4 h-4 mr-2"/>Requests</a>
                        <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('inventory')}} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'inventory' ? 'text-primary-700 bg-primary-50 shadow-inner-soft' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><Package className="w-4 h-4 mr-2"/>Inventory</a>
                        <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('reports')}} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'reports' ? 'text-primary-700 bg-primary-50 shadow-inner-soft' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><History className="w-4 h-4 mr-2"/>Dashboard</a>
                        {user?.is_staff && <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('users')}} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'users' ? 'text-primary-700 bg-primary-50 shadow-inner-soft' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><Users className="w-4 h-4 mr-2"/>Users</a>}
                    </nav>
                </div>
                
                <div className="hidden lg:flex items-center flex-grow max-w-md mx-6">
                    <div className="relative w-full">
                        <input 
                            type="text" 
                            placeholder="Search everything..." 
                            className="input pl-10 bg-secondary-50/50 border-secondary-200 placeholder-secondary-400"
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                    </div>
                </div>
                
                <div className="flex items-center space-x-3">
                    <div className="relative group">
                        <button className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-soft hover:shadow-medium transition-all duration-200 group-hover:scale-105" onClick={() => document.getElementById('logout-menu').classList.toggle('hidden')}>
                            {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                        </button>
                        <div id="logout-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-strong border border-secondary-200 overflow-hidden animate-slide-up">
                            <div className="px-4 py-3 border-b border-secondary-100">
                                <p className="text-sm font-medium text-secondary-900">{user?.username}</p>
                                <p className="text-xs text-secondary-500">{user?.email || 'No email'}</p>
                            </div>
                            <a href="#" onClick={(e) => {e.preventDefault(); logout();}} className="flex items-center px-4 py-3 text-sm text-secondary-700 hover:bg-secondary-50 transition-colors"><LogOut className="w-4 h-4 mr-3 text-secondary-400" /> Logout</a>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Mobile navigation menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-secondary-200 bg-white">
                    <nav className="px-4 py-4 space-y-2">
                        <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('requests'); setIsMobileMenuOpen(false);}} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'requests' ? 'text-primary-700 bg-primary-50' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><FileText className="w-4 h-4 mr-3"/>Requests</a>
                        <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('inventory'); setIsMobileMenuOpen(false);}} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'inventory' ? 'text-primary-700 bg-primary-50' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><Package className="w-4 h-4 mr-3"/>Inventory</a>
                        <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('reports'); setIsMobileMenuOpen(false);}} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'reports' ? 'text-primary-700 bg-primary-50' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><History className="w-4 h-4 mr-3"/>Dashboard</a>
                        {user?.is_staff && <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('users'); setIsMobileMenuOpen(false);}} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activePage === 'users' ? 'text-primary-700 bg-primary-50' : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'}`}><Users className="w-4 h-4 mr-3"/>Users</a>}
                        
                        <div className="pt-4 mt-4 border-t border-secondary-200">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Search everything..." 
                                    className="input pl-10 bg-secondary-50/50 border-secondary-200 placeholder-secondary-400"
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
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                            </div>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Header;
