import React, { useState, useEffect, useContext } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import Pagination from '../components/Pagination.tsx';
import UsersTable from '../components/UsersTable.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const UserManagementPage = ({ onEditUser, onDeleteUser, refreshKey, users, setUsers }) => {
    const { token } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true); setError(null);
            try {
                const response = await fetch(buildApiUrl(API_ENDPOINTS.USERS), { 
                    headers: { 'Authorization': `Token ${token}` } 
                });
                if (!response.ok) throw new Error('Failed to load users');
                const data = await response.json();
                setUsers(data);
            } catch (e) { setError(e.message); } finally { setLoading(false); }
        };
        if (token) { fetchUsers(); }
    }, [token, refreshKey]);

    const handleToggleStatus = async (user) => {
        try {
            const response = await fetch(buildApiUrl(`/api/users/${user.id}/toggle-status/`), {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle user status');
            }
            // Refresh the user list
            const updatedResponse = await fetch(buildApiUrl(API_ENDPOINTS.USERS), { 
                headers: { 'Authorization': `Token ${token}` } 
            });
            const updatedData = await updatedResponse.json();
            setUsers(updatedData);
        } catch (e) { 
            alert(e.message); 
        }
    };

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 mb-2">User Management</h1>
                    <p className="text-secondary-600">Manage system users and permissions</p>
                </div>
            </div>
            <div className="card overflow-hidden">
                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                            <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                            <p className="text-secondary-600">Loading Users...</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="flex flex-col justify-center items-center h-64 text-danger-600 bg-danger-50 p-6 rounded-lg m-6">
                        <AlertTriangle className="w-12 h-12 mb-4 text-danger-500" />
                        <h3 className="text-lg font-semibold text-danger-800">Failed to load users</h3>
                        <p className="text-sm text-danger-600 mt-2">{error}</p>
                    </div>
                )}
                {!loading && !error && (
                    <>
                        <UsersTable 
                            users={users} 
                            onEdit={onEditUser} 
                            onDelete={onDeleteUser}
                            onToggleStatus={handleToggleStatus}
                        />
                        <div className="p-6 border-t border-secondary-200 bg-secondary-50/50">
                            <Pagination 
                                currentPage={currentPage} 
                                totalItems={users.length} 
                                itemsPerPage={itemsPerPage} 
                                onPageChange={setCurrentPage} 
                            />
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default UserManagementPage;
