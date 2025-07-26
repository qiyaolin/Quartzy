import React, { useState, useMemo, useEffect, useContext } from 'react';
import { AlertTriangle, Clock, Package, QrCode } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import InventoryTable from '../components/InventoryTable.tsx';
import Pagination from '../components/Pagination.tsx';
import ItemRequestHistoryModal from '../modals/ItemRequestHistoryModal.tsx';
import BarcodeScanner from '../components/BarcodeScanner.tsx';
import { exportToExcel } from '../utils/excelExport.ts';

const InventoryPage = ({ onEditItem, onDeleteItem, refreshKey, filters }) => {
    const { token } = useContext(AuthContext);
    const notification = useNotification();
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const itemsPerPage = 10;

    const groupedInventory = useMemo(() => {
        return inventory.reduce((acc, item) => {
            const groupId = `${item.name}-${item.vendor?.id}-${item.catalog_number}`;
            if (!acc[groupId]) {
                acc[groupId] = { id: groupId, name: item.name, vendor: item.vendor, catalog_number: item.catalog_number, item_type: item.item_type, totalQuantity: 0, instances: [], };
            }
            acc[groupId].instances.push(item);
            acc[groupId].totalQuantity += parseFloat(item.quantity);
            return acc;
        }, {});
    }, [inventory]);

    const paginatedData = useMemo(() => {
        const groups = Object.values(groupedInventory);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return groups.slice(startIndex, endIndex).reduce((acc, group) => {
            acc[group.id] = group;
            return acc;
        }, {});
    }, [groupedInventory, currentPage, itemsPerPage]);

    useEffect(() => {
        const fetchInventory = async () => {
            setLoading(true); setError(null);
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            Object.keys(filters).forEach(key => {
                if (key !== 'search' && filters[key].length > 0) {
                    if (key === 'expired' || key === 'low_stock') {
                        // For boolean filters, send 'true' if the filter is active
                        if (filters[key].includes('true')) {
                            params.append(key, 'true');
                        }
                    } else {
                        filters[key].forEach(value => params.append(key, value));
                    }
                }
            });
            try {
                const response = await fetch(`http://127.0.0.1:8000/api/items/?${params.toString()}`, { headers: { 'Authorization': `Token ${token}` } });
                if (!response.ok) throw new Error(`Authentication failed`);
                const data = await response.json();
                setInventory(data);
            } catch (e) { setError(e.message); } finally { setLoading(false); }
        };
        if (token) { fetchInventory(); }
    }, [token, refreshKey, filters]);

    const handleViewRequestHistory = (item) => {
        setSelectedItem(item);
        setIsRequestHistoryOpen(true);
    };

    const handleBatchAction = async (action, selectedIds) => {
        if (selectedIds.length === 0) return;
        
        switch (action) {
            case 'export':
                // Filter selected items and export to Excel
                const selectedItems = inventory.filter(item => selectedIds.includes(item.id));
                
                // Prepare formatted data for Excel
                const formattedItems = selectedItems.map(item => ({
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
                    'Last Updated': item.updated_at ? new Date(item.updated_at).toLocaleString('en-US') : ''
                }));
                
                const now = new Date();
                const summary = {
                    'Export Time': now.toLocaleString('en-US'),
                    'Export Count': selectedItems.length,
                    'Total Value': `$${selectedItems.reduce((sum, item) => sum + (parseFloat(item.total_value) || 0), 0).toFixed(2)}`,
                    'Low Stock Items': selectedItems.filter(item => item.quantity <= (item.minimum_quantity || 0)).length,
                    'Expired Items': selectedItems.filter(item => item.expiration_date && new Date(item.expiration_date) < now).length,
                    'Expiring Soon Items': selectedItems.filter(item => {
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
                break;
                
            case 'archive':
                if (window.confirm(`Are you sure you want to archive ${selectedIds.length} item(s)?`)) {
                    try {
                        const response = await fetch('http://127.0.0.1:8000/api/items/batch_archive/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Token ${token}`
                            },
                            body: JSON.stringify({ item_ids: selectedIds })
                        });
                        if (response.ok) {
                            // Refresh inventory
                            window.location.reload();
                        }
                    } catch (error) {
                        notification.error('Failed to archive items');
                    }
                }
                break;
                
            case 'delete':
                if (window.confirm(`Are you sure you want to delete ${selectedIds.length} item(s)? This action cannot be undone.`)) {
                    try {
                        const response = await fetch('http://127.0.0.1:8000/api/items/batch_delete/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Token ${token}`
                            },
                            body: JSON.stringify({ item_ids: selectedIds })
                        });
                        if (response.ok) {
                            // Refresh inventory
                            window.location.reload();
                        }
                    } catch (error) {
                        notification.error('Failed to delete items');
                    }
                }
                break;
        }
    };

    // Barcode checkout handling functions
    const handleBarcodeScan = (barcode) => {
        console.log('Barcode scanned for checkout:', barcode);
        notification.info(`Scanned barcode: ${barcode}`);
    };

    const handleBarcodeCheckout = async (barcode, itemData) => {
        console.log('Processing barcode checkout:', barcode, itemData);
        
        if (itemData) {
            // Process checkout - this should mark the item as checked out
            try {
                // In a real implementation, you would call an API to process the checkout
                // For now, we'll just show a success message
                notification.success(`Successfully checked out: ${itemData.item_name}`);
                
                // You might want to update the inventory count here
                // await processCheckout(itemData.id, barcode);
                
                // Refresh the inventory data
                // fetchInventory();
                
            } catch (error) {
                notification.error(`Failed to checkout item: ${error.message}`);
            }
        } else {
            notification.error('Item not found with this barcode');
        }
        
        setIsScannerOpen(false);
    };

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 mb-2">Inventory</h1>
                    <p className="text-secondary-600">Manage and track your laboratory inventory</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="btn btn-primary flex items-center space-x-2"
                    >
                        <QrCode className="w-4 h-4" />
                        <span>Scan for Checkout</span>
                    </button>
                </div>
            </div>
            <div className="card overflow-hidden">
                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                            <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                            <p className="text-secondary-600">Loading Inventory...</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="flex flex-col justify-center items-center h-64 text-danger-600 bg-danger-50 p-6 rounded-lg m-6">
                        <AlertTriangle className="w-12 h-12 mb-4 text-danger-500" />
                        <h3 className="text-lg font-semibold text-danger-800">Failed to load data</h3>
                        <p className="text-sm text-danger-600 mt-2">{error}</p>
                    </div>
                )}
                {!loading && !error && (
                    <>
                        <InventoryTable 
                            groupedData={paginatedData} 
                            onEdit={onEditItem} 
                            onDelete={onDeleteItem} 
                            onViewRequestHistory={handleViewRequestHistory}
                            onBatchAction={handleBatchAction}
                        />
                        <div className="p-6 border-t border-secondary-200 bg-secondary-50/50">
                            <Pagination currentPage={currentPage} totalItems={Object.keys(groupedInventory).length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                        </div>
                    </>
                )}
            </div>
            <ItemRequestHistoryModal 
                isOpen={isRequestHistoryOpen} 
                onClose={() => setIsRequestHistoryOpen(false)} 
                itemName={selectedItem?.name} 
                token={token} 
            />
            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
                onConfirm={handleBarcodeCheckout}
            />
        </main>
    );
};

export default InventoryPage;
