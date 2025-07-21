import React, { useState, useMemo, useEffect, useContext } from 'react';
import { AlertTriangle, Clock, Package } from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import InventoryTable from '../components/InventoryTable.tsx';
import Pagination from '../components/Pagination.tsx';

const InventoryPage = ({ onEditItem, onDeleteItem, refreshKey, filters }) => {
    const { token } = useContext(AuthContext);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
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
                    filters[key].forEach(value => params.append(key, value));
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

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 mb-2">Inventory</h1>
                    <p className="text-secondary-600">Manage and track your laboratory inventory</p>
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
                        <InventoryTable groupedData={paginatedData} onEdit={onEditItem} onDelete={onDeleteItem} />
                        <div className="p-6 border-t border-secondary-200 bg-secondary-50/50">
                            <Pagination currentPage={currentPage} totalItems={Object.keys(groupedInventory).length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default InventoryPage;
