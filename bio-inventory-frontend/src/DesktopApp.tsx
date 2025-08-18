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
import ImportInventoryModal from './modals/ImportInventoryModal.tsx';
import ImportRequestsModal from './modals/ImportRequestsModal.tsx';

import InventoryPage from './pages/InventoryPage.tsx';
import RequestsPage from './pages/RequestsPage.tsx';
import ReportsPage from './pages/ReportsPage.tsx';
import UserManagementPage from './pages/UserManagementPage.tsx';
import FundingPage from './pages/FundingPage.tsx';
import SchedulePage from './pages/SchedulePage.tsx';
import { exportToExcel } from './utils/excelExport.ts';

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
    const [isImportInventoryModalOpen, setIsImportInventoryModalOpen] = useState(false);
    const [isImportRequestsModalOpen, setIsImportRequestsModalOpen] = useState(false);

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
            } else if (currentPath === '/schedule') {
                setActivePage('schedule');
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
        else if (page === 'schedule') newPath = '/schedule';
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

    // Import/Export handlers
    const handleInventoryImport = () => {
        setIsImportInventoryModalOpen(true);
    };

    const handleInventoryExport = async () => {
        try {
            const params = new URLSearchParams();
            Object.keys(inventoryFilters).forEach(key => {
                if (key === 'search' && inventoryFilters[key]) {
                    params.append('search', inventoryFilters[key]);
                } else if (key !== 'search' && inventoryFilters[key].length > 0) {
                    if (key === 'expired' || key === 'low_stock') {
                        if (inventoryFilters[key].includes('true')) {
                            params.append(key, 'true');
                        }
                    } else {
                        inventoryFilters[key].forEach(value => params.append(key, value));
                    }
                }
            });

            const response = await fetch(`${buildApiUrl(API_ENDPOINTS.ITEMS)}?${params.toString()}`, {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch inventory data');
            
            const items = await response.json();
            
            const formattedItems = items.map(item => ({
                'Item ID': item.id,
                'Item Name': item.name,
                'Specifications': item.specifications || '',
                'Quantity': item.quantity,
                'Unit': item.unit || '',
                'Unit Price': item.unit_price ? `$${item.unit_price}` : '',
                'Total Value': item.total_value ? `$${item.total_value}` : '',
                'Vendor': item.vendor?.name || '',
                'Catalog Number': item.catalog_number || '',
                'Location': item.location?.name || '',
                'Item Type': item.item_type?.name || '',
                'Expiration Date': item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('en-US') : '',
                'Minimum Stock': item.minimum_quantity || '',
                'Purchase Date': item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('en-US') : '',
                'Status': item.quantity <= (item.minimum_quantity || 0) ? 'Low Stock' : 
                         (item.expiration_date && new Date(item.expiration_date) < new Date()) ? 'Expired' : 'Normal',
                'Notes': item.notes || '',
                'Last Updated': item.updated_at ? new Date(item.updated_at).toLocaleString('en-US') : ''
            }));

            const now = new Date();
            const summary = {
                'Export Time': now.toLocaleString('en-US'),
                'Total Items': items.length,
                'Total Value': `$${items.reduce((sum, item) => sum + (parseFloat(item.total_value) || 0), 0).toFixed(2)}`,
                'Low Stock Items': items.filter(item => item.quantity <= (item.minimum_quantity || 0)).length,
                'Expired Items': items.filter(item => item.expiration_date && new Date(item.expiration_date) < now).length,
                'Expiring Soon Items': items.filter(item => {
                    if (!item.expiration_date) return false;
                    const expDate = new Date(item.expiration_date);
                    const thirtyDaysFromNow = new Date();
                    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                    return expDate > now && expDate <= thirtyDaysFromNow;
                }).length
            };

            exportToExcel({
                fileName: 'inventory-export',
                sheetName: 'Inventory List',
                title: 'Laboratory Inventory Management Export Report',
                data: formattedItems,
                summary: summary
            });

            notification.success(`Successfully exported ${items.length} inventory items`);
        } catch (error) {
            notification.error(`Export failed: ${error.message}`);
        }
    };

    const handleRequestsImport = () => {
        setIsImportRequestsModalOpen(true);
    };

    const handleRequestsExport = async () => {
        try {
            const params = new URLSearchParams();
            Object.keys(requestFilters).forEach(key => {
                if (!['search', 'status'].includes(key) && requestFilters[key].length > 0) {
                    requestFilters[key].forEach(value => params.append(key, value));
                } else if (key === 'search' && requestFilters[key]) {
                    params.append('search', requestFilters[key]);
                }
            });

            const response = await fetch(`${buildApiUrl(API_ENDPOINTS.REQUESTS)}?${params.toString()}`, {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch requests data');
            
            const requests = await response.json();
            
            const formattedRequests = requests.map(req => ({
                'Request ID': req.id,
                'Product Name': req.product_name,
                'Specifications': req.specifications,
                'Quantity': req.quantity,
                'Unit Price': req.unit_price ? `$${req.unit_price}` : '',
                'Total Price': req.total_price ? `$${req.total_price}` : '',
                'Status': req.status === 'pending' ? 'Pending' : 
                         req.status === 'approved' ? 'Approved' : 
                         req.status === 'ordered' ? 'Ordered' : 
                         req.status === 'received' ? 'Received' : 
                         req.status === 'rejected' ? 'Rejected' : req.status,
                'Requester': req.requester_name,
                'Department': req.department,
                'Laboratory': req.lab,
                'Vendor': req.vendor,
                'Product Link': req.product_link,
                'Urgency': req.urgency === 'high' ? 'High' : 
                          req.urgency === 'medium' ? 'Medium' : 
                          req.urgency === 'low' ? 'Low' : req.urgency,
                'Request Date': req.requested_date ? new Date(req.requested_date).toLocaleDateString('en-US') : '',
                'Expected Delivery': req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString('en-US') : '',
                'Notes': req.notes || ''
            }));

            const summary = {
                'Export Time': new Date().toLocaleString('en-US'),
                'Total Requests': requests.length,
                'Pending': requests.filter(r => r.status === 'pending').length,
                'Approved': requests.filter(r => r.status === 'approved').length,
                'Ordered': requests.filter(r => r.status === 'ordered').length,
                'Received': requests.filter(r => r.status === 'received').length,
                'Rejected': requests.filter(r => r.status === 'rejected').length,
                'Total Value': `$${requests.reduce((sum, req) => sum + (parseFloat(req.total_price) || 0), 0).toFixed(2)}`
            };

            exportToExcel({
                fileName: 'requests-export',
                sheetName: 'Purchase Requests',
                title: 'Laboratory Purchase Requests Export Report',
                data: formattedRequests,
                summary: summary
            });

            notification.success(`Successfully exported ${requests.length} requests`);
        } catch (error) {
            notification.error(`Export failed: ${error.message}`);
        }
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
            case 'schedule': return <SchedulePage />;
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
                onClose: () => setIsSidebarOpen(false),
                onImportData: handleInventoryImport,
                onExportData: handleInventoryExport
            };
        } else if (activePage === 'requests') {
            SidebarComponent = RequestsSidebar;
            sidebarProps = {
                onAddRequestClick: () => setIsRequestFormModalOpen(true),
                filters: requestFilters,
                onFilterChange: handleRequestFilterChange,
                filterOptions: filterOptions,
                isMobile: false,
                onClose: () => setIsSidebarOpen(false),
                onImportData: handleRequestsImport,
                onExportData: handleRequestsExport
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
            <div className="flex flex-grow relative min-h-0">
                {renderSidebar()}
                <div className="flex-1 w-full min-w-0 overflow-y-auto">
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
            <ImportInventoryModal
                isOpen={isImportInventoryModalOpen}
                onClose={() => setIsImportInventoryModalOpen(false)}
                onSuccess={handleSave}
                token={token}
            />
            <ImportRequestsModal
                isOpen={isImportRequestsModalOpen}
                onClose={() => setIsImportRequestsModalOpen(false)}
                onSuccess={handleSave}
                token={token}
            />
        </div>
    );
};

export default DesktopApp;