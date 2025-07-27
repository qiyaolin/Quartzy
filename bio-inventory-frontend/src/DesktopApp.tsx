import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './components/AuthContext.tsx';
import { useNotification } from './contexts/NotificationContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from './config/api.ts';
import { useDevice } from './hooks/useDevice.ts';
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
import FundingPage from './pages/FundingPage.tsx';

const DesktopApp = () => {
    const { token } = useContext(AuthContext);
    const notification = useNotification();
    const device = useDevice();
    const [activePage, setActivePage] = useState('inventory');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    const [inventoryFilters, setInventoryFilters] = useState({ search: '', location: [], item_type: [], vendor: [], expired: [], low_stock: [] });
    const [requestFilters, setRequestFilters] = useState({ search: '', status: 'NEW', vendor: [], requested_by: [] });
    const [userSearch, setUserSearch] = useState('');
    const [highlightRequestId, setHighlightRequestId] = useState(null);

    // Handle URL routing for email links
    useEffect(() => {
        const handleUrlRouting = () => {
            const currentPath = window.location.pathname;
            const urlParams = new URLSearchParams(window.location.search);
            const requestId = urlParams.get('request_id');
            
            if (currentPath === '/' || currentPath === '/inventory') {
                setActivePage('inventory');
            } else if (currentPath === '/requests' || currentPath.startsWith('/requests')) {
                setActivePage('requests');
                if (requestId) {
                    setHighlightRequestId(requestId);
                    if (token) {
                        fetch(buildApiUrl(`/api/requests/${requestId}/`), {
                            headers: { 'Authorization': `Token ${token}` }
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status) {
                                setRequestFilters(prev => ({ ...prev, status: data.status }));
                            }
                        })
                        .catch(err => console.error('Error fetching request:', err));
                    }
                }
            } else if (currentPath === '/reports') {
                setActivePage('reports');
            } else if (currentPath === '/funding') {
                setActivePage('funding');
            } else if (currentPath === '/users') {
                setActivePage('users');
            }
        };

        handleUrlRouting();

        const handlePopState = () => {
            handleUrlRouting();
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [token]);

    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!token) return;
            try {
                const headers = { 'Authorization': `Token ${token}` };
                const [vendorsRes, locationsRes, itemTypesRes, usersRes] = await Promise.all([
                    fetch(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.LOCATIONS), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.ITEM_TYPES), { headers }),
                    fetch(buildApiUrl(API_ENDPOINTS.USERS), { headers }),
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
    
    const navigateToPage = (page) => {
        setActivePage(page);
        setHighlightRequestId(null);
        
        let newPath = '/';
        if (page === 'inventory') newPath = '/inventory';
        else if (page === 'requests') newPath = '/requests';
        else if (page === 'reports') newPath = '/reports';
        else if (page === 'funding') newPath = '/funding';
        else if (page === 'users') newPath = '/users';
        
        window.history.pushState(null, '', newPath);
    };
    const handleDeleteConfirm = async () => {
        if (!deletingItem) return;
        try {
            await fetch(buildApiUrl(`/api/items/${deletingItem.id}/`), { method: 'DELETE', headers: { 'Authorization': `Token ${token}` } });
            handleSave();
        } catch (e) { console.error(e); } finally { setIsDeleteModalOpen(false); setDeletingItem(null); }
    };
    const handleDeleteUserConfirm = async () => {
        if (!deletingUser) return;
        try {
            await fetch(buildApiUrl(`/api/users/${deletingUser.id}/`), { method: 'DELETE', headers: { 'Authorization': `Token ${token}` } });
            handleSave();
        } catch (e) { 
            notification.error(e.message || 'Failed to delete user'); 
        } finally { setIsDeleteUserModalOpen(false); setDeletingUser(null); }
    };

    const renderPage = () => {
        switch (activePage) {
            case 'inventory': 
                return (
                    <InventoryPage 
                        onEditItem={handleOpenEditItemModal} 
                        onDeleteItem={handleOpenDeleteModal} 
                        refreshKey={refreshKey} 
                        filters={inventoryFilters} 
                    />
                );
            case 'requests': 
                return (
                    <RequestsPage 
                        onAddRequestClick={() => setIsRequestFormModalOpen(true)} 
                        refreshKey={refreshKey} 
                        filters={requestFilters} 
                        onFilterChange={handleRequestFilterChange} 
                        highlightRequestId={highlightRequestId} 
                    />
                );
            case 'reports': 
                return (
                    <ReportsPage 
                        onNavigateToInventory={() => navigateToPage('inventory')}
                        onOpenAddItemModal={handleOpenAddItemModal}
                        onOpenNewRequestModal={() => setIsRequestFormModalOpen(true)}
                        onSetInventoryFilters={setInventoryFilters}
                    />
                );
            case 'funding': return <FundingPage />;
            case 'users': 
                return (
                    <UserManagementPage 
                        onEditUser={handleOpenEditUserModal} 
                        onDeleteUser={handleOpenDeleteUserModal} 
                        refreshKey={refreshKey} 
                        users={users} 
                        setUsers={setUsers} 
                    />
                );
            default: 
                return (
                    <InventoryPage 
                        onEditItem={handleOpenEditItemModal} 
                        onDeleteItem={handleOpenDeleteModal} 
                        refreshKey={refreshKey} 
                        filters={inventoryFilters} 
                    />
                );
        }
    }

    const shouldShowSidebar = () => {
        return ['inventory', 'requests', 'users'].includes(activePage) && isSidebarOpen;
    };

    const renderSidebar = () => {
        if (!shouldShowSidebar()) return null;

        let SidebarComponent = null;
        let sidebarProps = {};

        if (activePage === 'inventory') {
            SidebarComponent = InventorySidebar;
            sidebarProps = {
                onAddItemClick: handleOpenAddItemModal,
                filters: inventoryFilters,
                onFilterChange: handleInventoryFilterChange,
                filterOptions: filterOptions,
                isMobile: false,
                onClose: () => setIsSidebarOpen(false)
            };
        } else if (activePage === 'requests') {
            SidebarComponent = RequestsSidebar;
            sidebarProps = {
                onAddRequestClick: () => setIsRequestFormModalOpen(true),
                filters: requestFilters,
                onFilterChange: handleRequestFilterChange,
                filterOptions: filterOptions,
                isMobile: false,
                onClose: () => setIsSidebarOpen(false)
            };
        } else if (activePage === 'users') {
            SidebarComponent = UserManagementSidebar;
            sidebarProps = {
                onAddUserClick: handleOpenAddUserModal,
                users: users,
                userSearch: userSearch,
                onUserSearchChange: setUserSearch,
                isMobile: false,
                onClose: () => setIsSidebarOpen(false)
            };
        }

        return (
            <div className="relative">
                {SidebarComponent && <SidebarComponent {...sidebarProps} />}
            </div>
        );
    };

    return (
        <div className="bg-secondary-50 font-sans antialiased h-screen flex flex-col">
            <Header 
                activePage={activePage} 
                onNavigate={navigateToPage}
                inventoryFilters={inventoryFilters}
                requestFilters={requestFilters}
                handleInventoryFilterChange={handleInventoryFilterChange}
                handleRequestFilterChange={handleRequestFilterChange}
                device={device}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            <AlertsBanner />
            <div className="flex flex-grow overflow-hidden relative">
                {renderSidebar()}
                <div className="flex-1 w-full">
                    {renderPage()}
                </div>
            </div>
            
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

export default DesktopApp;