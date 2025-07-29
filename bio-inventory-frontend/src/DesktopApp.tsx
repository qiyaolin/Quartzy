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
import { exportToExcel } from './utils/excelExport.ts';

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

    // Export and Import handlers
    const handleInventoryExport = async () => {
        try {
            const params = new URLSearchParams();
            if (inventoryFilters.search) params.append('search', inventoryFilters.search);
            Object.keys(inventoryFilters).forEach(key => {
                if (key !== 'search' && inventoryFilters[key].length > 0) {
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
            const data = await response.json();

            const formattedData = data.map(item => ({
                'Item ID': item.id,
                'Item Name': item.name,
                'Specifications': item.specifications || '',
                'Quantity': item.quantity,
                'Unit': item.unit || '',
                'Unit Price': item.unit_price ? `$${item.unit_price}` : '',
                'Total Value': item.total_value ? `$${item.total_value}` : '',
                'Vendor': item.vendor?.name || '',
                'Catalog Number': item.catalog_number || '',
                'Location': item.location || '',
                'Item Type': item.item_type || '',
                'Expiration Date': item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('en-US') : '',
                'Minimum Stock': item.minimum_quantity || '',
                'Purchase Date': item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('en-US') : '',
                'Status': item.quantity <= (item.minimum_quantity || 0) ? 'Low Stock' : 
                         (item.expiration_date && new Date(item.expiration_date) < new Date()) ? 'Expired' : 'Normal',
                'Notes': item.notes || '',
                'Barcode': item.barcode || '',
                'Last Updated': item.updated_at ? new Date(item.updated_at).toLocaleString('en-US') : ''
            }));

            const now = new Date();
            const summary = {
                'Export Time': now.toLocaleString('en-US'),
                'Total Items': data.length,
                'Total Value': `$${data.reduce((sum, item) => sum + (parseFloat(item.total_value) || 0), 0).toFixed(2)}`,
                'Low Stock Items': data.filter(item => item.quantity <= (item.minimum_quantity || 0)).length,
                'Expired Items': data.filter(item => item.expiration_date && new Date(item.expiration_date) < now).length,
                'Expiring Soon Items': data.filter(item => {
                    if (!item.expiration_date) return false;
                    const expDate = new Date(item.expiration_date);
                    const thirtyDaysFromNow = new Date();
                    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                    return expDate > now && expDate <= thirtyDaysFromNow;
                }).length
            };

            exportToExcel({
                fileName: 'inventory-export',
                sheetName: 'Inventory Data',
                title: 'Laboratory Inventory Management Export Report',
                data: formattedData,
                summary: summary
            });

            notification.success(`Successfully exported ${data.length} inventory items`);
        } catch (error) {
            console.error('Export error:', error);
            notification.error('Failed to export inventory data');
        }
    };

    const handleRequestsExport = async () => {
        try {
            const params = new URLSearchParams();
            if (requestFilters.search) params.append('search', requestFilters.search);
            if (requestFilters.status) params.append('status', requestFilters.status);
            requestFilters.vendor?.forEach(id => params.append('vendor', id));
            requestFilters.requested_by?.forEach(id => params.append('requested_by', id));

            const response = await fetch(`${buildApiUrl('/api/requests/')}?${params.toString()}`, {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch requests data');
            const data = await response.json();

            const formattedData = data.map(request => ({
                'Request ID': request.id,
                'Item Name': request.item_name,
                'Catalog Number': request.catalog_number || '',
                'Quantity': request.quantity,
                'Unit Size': request.unit_size || '',
                'Unit Price': request.unit_price ? `$${request.unit_price}` : '',
                'Total Cost': request.quantity && request.unit_price ? `$${(request.quantity * request.unit_price).toFixed(2)}` : '',
                'Vendor': request.vendor?.name || '',
                'Requested By': request.requested_by?.username || '',
                'Status': request.status,
                'Request Date': request.created_at ? new Date(request.created_at).toLocaleDateString('en-US') : '',
                'URL': request.url || '',
                'Barcode': request.barcode || '',
                'Fund': request.fund_id || '',
                'Notes': request.notes || ''
            }));

            const now = new Date();
            const statusCounts = data.reduce((acc, request) => {
                acc[request.status] = (acc[request.status] || 0) + 1;
                return acc;
            }, {});

            const summary = {
                'Export Time': now.toLocaleString('en-US'),
                'Total Requests': data.length,
                'Total Value': `$${data.reduce((sum, request) => {
                    const cost = request.quantity && request.unit_price ? request.quantity * request.unit_price : 0;
                    return sum + cost;
                }, 0).toFixed(2)}`,
                'New Requests': statusCounts['NEW'] || 0,
                'Approved Requests': statusCounts['APPROVED'] || 0,
                'Ordered Requests': statusCounts['ORDERED'] || 0,
                'Received Requests': statusCounts['RECEIVED'] || 0,
                'Rejected Requests': statusCounts['REJECTED'] || 0
            };

            exportToExcel({
                fileName: 'requests-export',
                sheetName: 'Requests Data',
                title: 'Laboratory Requests Management Export Report',
                data: formattedData,
                summary: summary
            });

            notification.success(`Successfully exported ${data.length} requests`);
        } catch (error) {
            console.error('Export error:', error);
            notification.error('Failed to export requests data');
        }
    };

    const handleImportData = (dataType) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('data_type', dataType);

                const response = await fetch(buildApiUrl('/api/import/'), {
                    method: 'POST',
                    headers: { 'Authorization': `Token ${token}` },
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Import failed');
                }

                const result = await response.json();
                notification.success(`Successfully imported ${result.imported_count || 0} ${dataType} items`);
                handleSave(); // Refresh the data
            } catch (error) {
                console.error('Import error:', error);
                notification.error(`Failed to import ${dataType}: ${error.message}`);
            }
        };
        input.click();
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
                onClose: () => setIsSidebarOpen(false),
                onExportData: handleInventoryExport,
                onImportData: () => handleImportData('inventory')
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
                onExportData: handleRequestsExport,
                onImportData: () => handleImportData('requests')
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
            <div className="flex flex-grow relative" style={{ minHeight: 'calc(100vh - 120px)' }}>
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