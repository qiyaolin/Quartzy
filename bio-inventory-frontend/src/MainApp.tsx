import React, { useState, useMemo, useEffect, useContext } from 'react';
import { AuthContext } from './components/AuthContext.tsx';
import AlertsBanner from './components/AlertsBanner.tsx';
import Header from './components/Header.tsx';
import InventorySidebar from './components/InventorySidebar.tsx';
import RequestsSidebar from './components/RequestsSidebar.tsx';
import UserManagementSidebar from './components/UserManagementSidebar.tsx';

import ItemFormModal from './modals/ItemFormModal.tsx';
import ConfirmDeleteModal from './modals/ConfirmDeleteModal.tsx';
import RequestFormModal from './modals/RequestFormModal.tsx';
import UserFormModal from './modals/UserFormModal.tsx';
import ConfirmDeleteUserModal from './modals/ConfirmDeleteUserModal.tsx';

import InventoryPage from './pages/InventoryPage.tsx';
import RequestsPage from './pages/RequestsPage.tsx';
import ReportsPage from './pages/ReportsPage.tsx';
import UserManagementPage from './pages/UserManagementPage.tsx';

const MainApp = () => {
    const { token } = useContext(AuthContext);
    const [activePage, setActivePage] = useState('inventory');
    const [isItemFormModalOpen, setIsItemFormModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingItem, setDeletingItem] = useState(null);
    const [isRequestFormModalOpen, setIsRequestFormModalOpen] = useState(false);
    const [isUserFormModalOpen, setIsUserFormModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
    const [deletingUser, setDeletingUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [filterOptions, setFilterOptions] = useState({ vendors: [], locations: [], itemTypes: [], users: [] });
    const [inventoryFilters, setInventoryFilters] = useState({ search: '', location: [], item_type: [], vendor: [] });
    const [requestFilters, setRequestFilters] = useState({ search: '', status: 'NEW', vendor: [], requested_by: [] });
    const [userSearch, setUserSearch] = useState('');

    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!token) return;
            try {
                const headers = { 'Authorization': `Token ${token}` };
                const [vendorsRes, locationsRes, itemTypesRes, usersRes] = await Promise.all([
                    fetch('http://127.0.0.1:8000/api/vendors/', { headers }),
                    fetch('http://127.0.0.1:8000/api/locations/', { headers }),
                    fetch('http://127.0.0.1:8000/api/item-types/', { headers }),
                    fetch('http://127.0.0.1:8000/api/users/', { headers }),
                ]);
                const vendors = await vendorsRes.json();
                const locations = await locationsRes.json();
                const itemTypes = await itemTypesRes.json();
                const users = await usersRes.json();
                setFilterOptions({ vendors, locations, itemTypes, users });
            } catch (e) { console.error("Could not load filter options", e); }
        };
        fetchFilterOptions();
    }, [token]);
    
    const handleInventoryFilterChange = (key, value) => {
        if (key === 'search') {
            setInventoryFilters(prev => ({ ...prev, search: value }));
        } else {
            setInventoryFilters(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value] }));
        }
    };

    const handleRequestFilterChange = (key, value) => {
        if (key === 'search' || key === 'status') {
            setRequestFilters(prev => ({ ...prev, [key]: value }));
        } else {
            setRequestFilters(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value] }));
        }
    };

    const handleOpenAddItemModal = () => { setEditingItem(null); setIsItemFormModalOpen(true); };
    const handleOpenEditItemModal = (item) => { setEditingItem(item); setIsItemFormModalOpen(true); };
    const handleOpenDeleteModal = (item) => { setDeletingItem(item); setIsDeleteModalOpen(true); };
    const handleOpenAddUserModal = () => { setEditingUser(null); setIsUserFormModalOpen(true); };
    const handleOpenEditUserModal = (user) => { setEditingUser(user); setIsUserFormModalOpen(true); };
    const handleOpenDeleteUserModal = (user) => { setDeletingUser(user); setIsDeleteUserModalOpen(true); };
    const handleSave = () => { setRefreshKey(prev => prev + 1); }
    const handleDeleteConfirm = async () => {
        if (!deletingItem) return;
        try {
            await fetch(`http://127.0.0.1:8000/api/items/${deletingItem.id}/`, { method: 'DELETE', headers: { 'Authorization': `Token ${token}` } });
            handleSave();
        } catch (e) { console.error(e); } finally { setIsDeleteModalOpen(false); setDeletingItem(null); }
    };
    const handleDeleteUserConfirm = async () => {
        if (!deletingUser) return;
        try {
            await fetch(`http://127.0.0.1:8000/api/users/${deletingUser.id}/`, { method: 'DELETE', headers: { 'Authorization': `Token ${token}` } });
            handleSave();
        } catch (e) { 
            alert(e.message || 'Failed to delete user'); 
        } finally { setIsDeleteUserModalOpen(false); setDeletingUser(null); }
    };

    const renderPage = () => {
        switch (activePage) {
            case 'inventory': return <InventoryPage onEditItem={handleOpenEditItemModal} onDeleteItem={handleOpenDeleteModal} refreshKey={refreshKey} filters={inventoryFilters} />;
            case 'requests': return <RequestsPage onAddRequestClick={() => setIsRequestFormModalOpen(true)} refreshKey={refreshKey} filters={requestFilters} onFilterChange={handleRequestFilterChange} />;
            case 'reports': return <ReportsPage />;
            case 'users': return <UserManagementPage onEditUser={handleOpenEditUserModal} onDeleteUser={handleOpenDeleteUserModal} refreshKey={refreshKey} users={users} setUsers={setUsers} />;
            default: return <InventoryPage onEditItem={handleOpenEditItemModal} onDeleteItem={handleOpenDeleteModal} refreshKey={refreshKey} filters={inventoryFilters} />;
        }
    }

    return (
        <div className="bg-secondary-50 font-sans antialiased h-screen flex flex-col">
            <Header 
                activePage={activePage} 
                onNavigate={setActivePage}
                inventoryFilters={inventoryFilters}
                requestFilters={requestFilters}
                handleInventoryFilterChange={handleInventoryFilterChange}
                handleRequestFilterChange={handleRequestFilterChange}
            />
            <AlertsBanner />
            <div className="flex flex-grow overflow-hidden relative">
                {activePage === 'inventory' && <InventorySidebar onAddItemClick={handleOpenAddItemModal} filters={inventoryFilters} onFilterChange={handleInventoryFilterChange} filterOptions={filterOptions} />}
                {activePage === 'requests' && <RequestsSidebar onAddRequestClick={() => setIsRequestFormModalOpen(true)} filters={requestFilters} onFilterChange={handleRequestFilterChange} filterOptions={filterOptions} />}
                {activePage === 'users' && <UserManagementSidebar onAddUserClick={handleOpenAddUserModal} users={users} userSearch={userSearch} onUserSearchChange={setUserSearch} />}
                {renderPage()}
            </div>

            {/* Modals */}
            <ItemFormModal 
                isOpen={isItemFormModalOpen} 
                onClose={() => setIsItemFormModalOpen(false)} 
                onSave={handleSave} 
                token={token} 
                initialData={editingItem} 
            />
            <ConfirmDeleteModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setIsDeleteModalOpen(false)} 
                onConfirm={handleDeleteConfirm} 
                itemName={deletingItem?.name} 
            />
            <RequestFormModal 
                isOpen={isRequestFormModalOpen} 
                onClose={() => setIsRequestFormModalOpen(false)} 
                onSave={handleSave} 
                token={token} 
            />
            <UserFormModal
                isOpen={isUserFormModalOpen}
                onClose={() => setIsUserFormModalOpen(false)}
                onSave={handleSave}
                token={token}
                initialData={editingUser}
            />
            <ConfirmDeleteUserModal
                isOpen={isDeleteUserModalOpen}
                onClose={() => setIsDeleteUserModalOpen(false)}
                onConfirm={handleDeleteUserConfirm}
                userName={deletingUser?.username}
            />
        </div>
    );
};

export default MainApp; 