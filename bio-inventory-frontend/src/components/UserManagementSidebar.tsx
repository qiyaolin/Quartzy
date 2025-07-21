import React from 'react';
import { PlusCircle, Search, Upload, Download, Users, Shield, UserPlus } from 'lucide-react';

const UserManagementSidebar = ({ onAddUserClick, users = [], userSearch, onUserSearchChange }) => {
    const activeUsers = users.filter(user => user.is_active).length;
    const adminUsers = users.filter(user => user.is_staff).length;
    
    return (
        <aside className="sidebar w-72 p-4 md:p-6 flex flex-col h-full animate-fade-in hidden lg:flex">
            <div className="flex-grow overflow-y-auto space-y-6">
                <div className="space-y-4">
                    <button onClick={onAddUserClick} className="btn btn-primary w-full py-3 text-base font-semibold shadow-soft hover:shadow-medium transition-all duration-200 hover:-translate-y-0.5">
                        <UserPlus className="w-5 h-5 mr-2" />
                        <span>Add New User</span>
                    </button>
                    
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            className="input pl-10 bg-secondary-50/50 border-secondary-200"
                            value={userSearch}
                            onChange={(e) => onUserSearchChange(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                    </div>
                </div>
                
                <div>
                    <h3 className="text-xs font-bold uppercase text-secondary-400 tracking-wider mb-4">Statistics</h3>
                    <div className="grid gap-3">
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-secondary-900">{activeUsers}</div>
                                    <div className="text-xs text-secondary-500 font-medium">Active Users</div>
                                </div>
                                <div className="w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-success-600" />
                                </div>
                            </div>
                        </div>
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-secondary-900">{adminUsers}</div>
                                    <div className="text-xs text-secondary-500 font-medium">Administrators</div>
                                </div>
                                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-primary-600" />
                                </div>
                            </div>
                        </div>
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-secondary-900">{users.length}</div>
                                    <div className="text-xs text-secondary-500 font-medium">Total Users</div>
                                </div>
                                <div className="w-10 h-10 bg-secondary-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-secondary-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-6 border-t border-secondary-200 space-y-2">
                <button className="btn btn-secondary w-full justify-center py-2.5 hover:bg-secondary-100 transition-all duration-200">
                    <Upload className="w-4 h-4 mr-2" />
                    <span>Import Users</span>
                </button>
                <button className="btn btn-secondary w-full justify-center py-2.5 hover:bg-secondary-100 transition-all duration-200">
                    <Download className="w-4 h-4 mr-2" />
                    <span>Export Users</span>
                </button>
            </div>
        </aside>
    );
};

export default UserManagementSidebar;
