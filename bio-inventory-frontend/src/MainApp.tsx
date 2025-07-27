import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './components/AuthContext.tsx';
import { useNotification } from './contexts/NotificationContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from './config/api.ts';
import { useDevice } from './hooks/useDevice.ts';
import AlertsBanner from './components/AlertsBanner.tsx';
import Header from './components/Header.tsx';
import MobileSidebarDrawer from './components/mobile/MobileSidebarDrawer.tsx';
import InventorySidebar from './components/InventorySidebar.tsx';
import RequestsSidebar from './components/RequestsSidebar.tsx';
import UserManagementSidebar from './components/UserManagementSidebar.tsx';

import ItemFormModal from './modals/ItemFormModal.tsx';
import ConfirmDeleteModal from './modals/ConfirmDeleteModal.tsx';
import RequestFormModal from './modals/RequestFormModal.tsx';
import UserFormModal from './modals/UserFormModal.tsx';
import ConfirmDeleteUserModal from './modals/ConfirmDeleteUserModal.tsx';

import InventoryPage from './pages/InventoryPage.tsx';
import MobileInventoryPage from './pages/MobileInventoryPage.tsx';
import RequestsPage from './pages/RequestsPage.tsx';
import MobileRequestsPage from './pages/MobileRequestsPage.tsx';
import ReportsPage from './pages/ReportsPage.tsx';
import MobileDashboardPage from './pages/MobileDashboardPage.tsx';
import UserManagementPage from './pages/UserManagementPage.tsx';
import MobileUsersPage from './pages/MobileUsersPage.tsx';
import FundingPage from './pages/FundingPage.tsx';

const MainApp = () => {
    const { token, user, logout } = useContext(AuthContext);
    const notification = useNotification();
    const device = useDevice();
    const [activePage, setActivePage] = useState('inventory');
    const [isSidebarOpen, setIsSidebarOpen] = useState(!device.isMobile);
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
                    // Update the request filters to show the specific request's status if needed
                    // We'll fetch the request to determine its status and set appropriate filter
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

        // Listen for browser back/forward navigation
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
    
    // Update URL when navigating programmatically
    const navigateToPage = (page) => {
        setActivePage(page);
        setHighlightRequestId(null); // Clear highlight when navigating away
        
        // Update URL without page refresh
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
                return device.isMobile ? (
                    <MobileInventoryPage 
                        onEditItem={handleOpenEditItemModal} 
                        onDeleteItem={handleOpenDeleteModal} 
                        refreshKey={refreshKey} 
                        filters={inventoryFilters}
                        onAddItemClick={handleOpenAddItemModal}
                        onAddRequestClick={() => setIsRequestFormModalOpen(true)}
                        onMenuToggle={() => setIsSidebarOpen(true)}
                        token={token}
                    />
                ) : (
                    <InventoryPage 
                        onEditItem={handleOpenEditItemModal} 
                        onDeleteItem={handleOpenDeleteModal} 
                        refreshKey={refreshKey} 
                        filters={inventoryFilters} 
                    />
                );
            case 'requests': 
                return device.isMobile ? (
                    <MobileRequestsPage 
                        onAddRequestClick={() => setIsRequestFormModalOpen(true)}
                        refreshKey={refreshKey} 
                        filters={requestFilters} 
                        onFilterChange={handleRequestFilterChange}
                        highlightRequestId={highlightRequestId}
                        onMenuToggle={() => setIsSidebarOpen(true)}
                        token={token}
                    />
                ) : (
                    <RequestsPage 
                        onAddRequestClick={() => setIsRequestFormModalOpen(true)} 
                        refreshKey={refreshKey} 
                        filters={requestFilters} 
                        onFilterChange={handleRequestFilterChange} 
                        highlightRequestId={highlightRequestId} 
                    />
                );
            case 'reports': 
                return device.isMobile ? (
                    <MobileDashboardPage 
                        onNavigateToInventory={() => navigateToPage('inventory')}
                        onOpenAddItemModal={handleOpenAddItemModal}
                        onOpenNewRequestModal={() => setIsRequestFormModalOpen(true)}
                        onSetInventoryFilters={setInventoryFilters}
                        onMenuToggle={() => setIsSidebarOpen(true)}
                        token={token}
                    />
                ) : (
                    <ReportsPage 
                        onNavigateToInventory={() => navigateToPage('inventory')}
                        onOpenAddItemModal={handleOpenAddItemModal}
                        onOpenNewRequestModal={() => setIsRequestFormModalOpen(true)}
                        onSetInventoryFilters={setInventoryFilters}
                    />
                );
            case 'funding': return <FundingPage />;
            case 'users': 
                return device.isMobile ? (
                    <MobileUsersPage 
                        onEditUser={handleOpenEditUserModal}
                        onDeleteUser={handleOpenDeleteUserModal}
                        refreshKey={refreshKey}
                        users={users}
                        setUsers={setUsers}
                        onMenuToggle={() => setIsSidebarOpen(true)}
                        onAddUserClick={handleOpenAddUserModal}
                        token={token}
                    />
                ) : (
                    <UserManagementPage 
                        onEditUser={handleOpenEditUserModal} 
                        onDeleteUser={handleOpenDeleteUserModal} 
                        refreshKey={refreshKey} 
                        users={users} 
                        setUsers={setUsers} 
                    />
                );
            default: 
                return device.isMobile ? (
                    <MobileInventoryPage 
                        onEditItem={handleOpenEditItemModal} 
                        onDeleteItem={handleOpenDeleteModal} 
                        refreshKey={refreshKey} 
                        filters={inventoryFilters}
                        onAddItemClick={handleOpenAddItemModal}
                        onAddRequestClick={() => setIsRequestFormModalOpen(true)}
                        onMenuToggle={() => setIsSidebarOpen(true)}
                        token={token}
                    />
                ) : (
                    <InventoryPage 
                        onEditItem={handleOpenEditItemModal} 
                        onDeleteItem={handleOpenDeleteModal} 
                        refreshKey={refreshKey} 
                        filters={inventoryFilters} 
                    />
                );
        }
    }

    // 移动端自动关闭侧边栏
    useEffect(() => {
        if (device.isMobile) {
            setIsSidebarOpen(false);
        } else {
            setIsSidebarOpen(true);
        }
    }, [device.isMobile]);

    const shouldShowSidebar = () => {
        return ['inventory', 'requests', 'users'].includes(activePage) && (!device.isMobile || isSidebarOpen);
    };

    const renderSidebar = () => {
        if (!shouldShowSidebar()) return null;

        const sidebarClasses = `
            ${device.isMobile 
                ? 'fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out'
                : 'relative'
            }
            ${device.isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `;

        let SidebarComponent = null;
        let sidebarProps = {};

        if (activePage === 'inventory') {
            SidebarComponent = InventorySidebar;
            sidebarProps = {
                onAddItemClick: handleOpenAddItemModal,
                filters: inventoryFilters,
                onFilterChange: handleInventoryFilterChange,
                filterOptions: filterOptions,
                isMobile: device.isMobile,
                onClose: () => setIsSidebarOpen(false)
            };
        } else if (activePage === 'requests') {
            SidebarComponent = RequestsSidebar;
            sidebarProps = {
                onAddRequestClick: () => setIsRequestFormModalOpen(true),
                filters: requestFilters,
                onFilterChange: handleRequestFilterChange,
                filterOptions: filterOptions,
                isMobile: device.isMobile,
                onClose: () => setIsSidebarOpen(false)
            };
        } else if (activePage === 'users') {
            SidebarComponent = UserManagementSidebar;
            sidebarProps = {
                onAddUserClick: handleOpenAddUserModal,
                users: users,
                userSearch: userSearch,
                onUserSearchChange: setUserSearch,
                isMobile: device.isMobile,
                onClose: () => setIsSidebarOpen(false)
            };
        }

        return (
            <>
                <div className={sidebarClasses}>
                    {SidebarComponent && <SidebarComponent {...sidebarProps} />}
                </div>
                {/* 移动端遮罩层 */}
                {device.isMobile && isSidebarOpen && (
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-40"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </>
        );
    };

    return (
        <div className="bg-secondary-50 font-sans antialiased h-screen flex flex-col">
            {/* Desktop Header */}
            {!device.isMobile && (
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
            )}
            <AlertsBanner />
            <div className="flex flex-grow overflow-hidden relative">
                {!device.isMobile && renderSidebar()}
                <div className={`flex-1 ${device.isMobile ? 'w-full' : ''}`}>
                    {renderPage()}
                </div>
            </div>
            
            {/* Mobile Sidebar Drawer */}
            {device.isMobile && (
                <MobileSidebarDrawer
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    activePage={activePage}
                    onNavigate={navigateToPage}
                    user={user}
                    onLogout={logout}
                />
            )}

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