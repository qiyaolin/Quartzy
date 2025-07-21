import React from 'react';
import { Shield, ShieldOff, Edit, Trash2 } from 'lucide-react';

const UsersTable = ({ users, onEdit, onDelete, onToggleStatus }) => (
    <div className="overflow-hidden">
        <table className="table">
            <thead className="table-header">
                <tr>
                    <th className="table-header-cell w-12"><input type="checkbox" className="checkbox" /></th>
                    <th className="table-header-cell">User</th>
                    <th className="table-header-cell">Email</th>
                    <th className="table-header-cell">Role</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Joined</th>
                    <th className="table-header-cell text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="table-body">
                {users.map(user => (
                    <tr key={user.id} className="table-row">
                        <td className="table-cell"><input type="checkbox" className="checkbox" /></td>
                        <td className="table-cell">
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm mr-3 shadow-soft">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-medium text-secondary-900">{user.username}</div>
                                    {(user.first_name || user.last_name) && (
                                        <div className="text-sm text-secondary-500">{user.first_name} {user.last_name}</div>
                                    )}
                                </div>
                            </div>
                        </td>
                        <td className="table-cell text-secondary-600">{user.email || <span className="text-secondary-400 italic">No email</span>}</td>
                        <td className="table-cell">
                            {user.is_staff ? (
                                <span className="badge badge-primary">
                                    <Shield className="w-3 h-3 mr-1" />Administrator
                                </span>
                            ) : (
                                <span className="badge badge-secondary">
                                    User
                                </span>
                            )}
                        </td>
                        <td className="table-cell">
                            {user.is_active ? (
                                <span className="badge badge-success">
                                    Active
                                </span>
                            ) : (
                                <span className="badge badge-danger">
                                    Inactive
                                </span>
                            )}
                        </td>
                        <td className="table-cell text-secondary-600">{new Date(user.date_joined).toLocaleDateString()}</td>
                        <td className="table-cell">
                            <div className="flex justify-center space-x-1">
                                <button 
                                    onClick={() => onToggleStatus(user)} 
                                    className={`p-2 rounded-lg transition-colors ${user.is_active ? 'hover:bg-danger-50 text-secondary-400 hover:text-danger-600' : 'hover:bg-success-50 text-secondary-400 hover:text-success-600'}`} 
                                    title={user.is_active ? 'Deactivate user' : 'Activate user'}
                                >
                                    {user.is_active ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={() => onEdit(user)} 
                                    className="p-2 hover:bg-primary-50 rounded-lg transition-colors text-secondary-400 hover:text-primary-600" 
                                    title="Edit user"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onDelete(user)} 
                                    className="p-2 hover:bg-danger-50 rounded-lg transition-colors text-secondary-400 hover:text-danger-600" 
                                    title="Delete user"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default UsersTable;
