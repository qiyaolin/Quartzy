import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, PlusCircle, Filter, Upload, Download, Settings, MoreVertical, Archive, Edit, Trash2, AlertTriangle, Loader, X } from 'lucide-react';

// --- Helper Components (No major changes) ---
const SidebarFilter = ({ title, options, showToggle = false }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isToggled, setIsToggled] = useState(false);
    return (
        <div className="py-4 border-b border-gray-200">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <h4 className="font-semibold text-gray-700">{title}</h4>
                <div className="flex items-center space-x-2">
                    {showToggle && (
                        <div onClick={(e) => { e.stopPropagation(); setIsToggled(!isToggled); }} className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isToggled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${isToggled ? 'translate-x-5' : ''}`} />
                        </div>
                    )}
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="mt-3">
                    {options.map(option => (
                        <div key={option} className="flex items-center my-2">
                            <input type="checkbox" id={option} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor={option} className="ml-2 text-gray-600">{option}</label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Header = () => (
    <header className="bg-white h-16 flex items-center justify-between px-6 border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center">
            <div className="flex items-center space-x-2 mr-6">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md"></div>
                <span className="font-bold text-lg text-gray-800">Hayer Lab</span>
                <ChevronDown className="w-5 h-5 text-gray-500" />
            </div>
            <nav className="flex items-center space-x-1">
                <a href="#" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">Requests</a>
                <a href="#" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">Orders</a>
                <a href="#" className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">Inventory</a>
            </nav>
        </div>
        <div className="flex items-center flex-grow max-w-md mx-4">
            <div className="relative w-full">
                <input type="text" placeholder="Search Quartzy" className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
        </div>
        <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-700 font-bold text-sm">AH</div>
        </div>
    </header>
);

// --- UPGRADED COMPONENT: ItemFormModal (Handles both Add and Edit) ---
const ItemFormModal = ({ isOpen, onClose, onSave, token, initialData = null }) => {
    const [formData, setFormData] = useState({});
    const [dropdownData, setDropdownData] = useState({ vendors: [], locations: [], itemTypes: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isEditMode = initialData !== null;

    useEffect(() => {
        // Set form data when modal opens or initialData changes
        const emptyForm = {
            name: '', item_type_id: '', vendor_id: '', owner_id: '1', catalog_number: '',
            quantity: '1.00', unit: '', location_id: '', price: '',
        };
        
        if (isEditMode) {
            setFormData({
                name: initialData.name || '',
                item_type_id: initialData.item_type?.id || '',
                vendor_id: initialData.vendor?.id || '',
                owner_id: initialData.owner?.id || '1',
                catalog_number: initialData.catalog_number || '',
                quantity: initialData.quantity || '1.00',
                unit: initialData.unit || '',
                location_id: initialData.location?.id || '',
                price: initialData.price || '',
            });
        } else {
            setFormData(emptyForm);
        }

    }, [initialData, isEditMode]);

    // Fetch data for dropdowns when the modal opens
    useEffect(() => {
        if (isOpen) {
            const fetchDropdownData = async () => {
                try {
                    const headers = { 'Authorization': `Token ${token}` };
                    const [vendorsRes, locationsRes, itemTypesRes] = await Promise.all([
                        fetch('http://127.0.0.1:8000/api/vendors/', { headers }),
                        fetch('http://127.0.0.1:8000/api/locations/', { headers }),
                        fetch('http://127.0.0.1:8000/api/item-types/', { headers }),
                    ]);
                    const vendors = await vendorsRes.json();
                    const locations = await locationsRes.json();
                    const itemTypes = await itemTypesRes.json();
                    setDropdownData({ vendors, locations, itemTypes });
                } catch (e) {
                    setError('Could not load form data.');
                }
            };
            fetchDropdownData();
        }
    }, [isOpen, token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        const url = isEditMode 
            ? `http://127.0.0.1:8000/api/items/${initialData.id}/` 
            : 'http://127.0.0.1:8000/api/items/';
        
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }
            onSave(); // Callback to refresh parent list
            onClose(); // Close modal on success
        } catch (e) {
            setError(`Submission failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                        <div className="col-span-2">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Item Name *</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="item_type_id" className="block text-sm font-medium text-gray-700">Type *</label>
                            <select name="item_type_id" id="item_type_id" value={formData.item_type_id} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                <option value="">Select...</option>
                                {dropdownData.itemTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">Vendor</label>
                            <select name="vendor_id" id="vendor_id" value={formData.vendor_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                <option value="">Select...</option>
                                {dropdownData.vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="location_id" className="block text-sm font-medium text-gray-700">Location</label>
                            <select name="location_id" id="location_id" value={formData.location_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                <option value="">Select...</option>
                                {dropdownData.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity</label>
                            <input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit</label>
                            <input type="text" name="unit" id="unit" placeholder="e.g., box, kg, mL" value={formData.unit} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Unit Price</label>
                            <input type="number" name="price" id="price" placeholder="0.00" value={formData.price} onChange={handleChange} step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                        </div>
                    </div>
                    {error && <div className="px-6 pb-4 text-red-600 text-sm">{error}</div>}
                    <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
                            {isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                            Save Item
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: ConfirmDeleteModal ---
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, itemName }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-800">Confirm Deletion</h2>
                <p className="mt-4 text-gray-600">Are you sure you want to delete the item: <strong>{itemName}</strong>? This action cannot be undone.</p>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-red-700">Delete</button>
                </div>
            </div>
        </div>
    );
};

const Sidebar = ({ onAddItemClick }) => (
    <aside className="w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col fixed top-16 h-[calc(100vh-4rem)]">
        <div className="flex-grow overflow-y-auto -mr-6 pr-6">
            <button onClick={onAddItemClick} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-colors">
                <PlusCircle className="w-5 h-5" />
                <span>Add Item</span>
            </button>
            <div className="relative my-4">
                <input type="text" placeholder="Search inventory" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Filters</h3>
            <SidebarFilter title="Low Stock" options={[]} showToggle={true} />
            <SidebarFilter title="Location" options={['-20° C', '4° C Fridge', '-80° C Freezer']} />
            <SidebarFilter title="Type" options={['General Supply', 'Reagent', 'Antibody']} />
            <SidebarFilter title="Vendor" options={['Invivogen', 'Abcam', 'Addgene']} />
            <SidebarFilter title="Owner" options={['Arnold Hayer', 'Rodrigo Migueles']} />
            <SidebarFilter title="Archived" options={[]} showToggle={true} />
        </div>
        <div className="pt-4 border-t border-gray-200">
            <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1 transition-colors">
                <Upload className="w-5 h-5" />
                <span>Import Inventory</span>
            </button>
            <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1 transition-colors">
                <Download className="w-5 h-5" />
                <span>Export Inventory</span>
            </button>
        </div>
    </aside>
);

const InventoryTable = ({ data, page, itemsPerPage, onEdit, onDelete }) => {
    const paginatedData = useMemo(() => data.slice((page - 1) * itemsPerPage, page * itemsPerPage), [data, page, itemsPerPage]);
    const [openMenuId, setOpenMenuId] = useState(null);

    return (
        <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
                <tr>
                    <th className="p-4 w-8"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                    <th className="p-4 w-24"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {paginatedData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 group">
                        <td className="p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
                        <td className="p-4 text-sm text-gray-900 font-medium">{item.name}</td>
                        <td className="p-4 text-sm text-gray-500">{item.vendor?.name || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500">{parseFloat(item.quantity).toFixed(2)} {item.unit}</td>
                        <td className="p-4 text-sm text-gray-500">{item.location?.name || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500">{item.item_type?.name || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500">{item.owner?.username || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500">{new Date(item.updated_at).toLocaleDateString()}</td>
                        <td className="p-4 text-sm text-gray-500 text-right relative">
                            <button onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} className="p-1 rounded-full hover:bg-gray-200">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {openMenuId === item.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                    <a href="#" onClick={(e) => { e.preventDefault(); onEdit(item); setOpenMenuId(null); }} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                    </a>
                                    <a href="#" onClick={(e) => { e.preventDefault(); onDelete(item); setOpenMenuId(null); }} className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </a>
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
            </div>
            <div className="flex items-center space-x-2">
                <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronsLeft className="w-5 h-5" /></button>
                <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
                <span className="px-2">Page {currentPage} of {totalPages}</span>
                <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
                <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronsRight className="w-5 h-5" /></button>
            </div>
        </div>
    );
}

const InventoryPage = ({ token }) => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingItem, setDeletingItem] = useState(null);
    const itemsPerPage = 10;

    const fetchInventory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/items/', { headers: { 'Authorization': `Token ${token}` } });
            if (!response.ok) throw new Error(`Authentication failed (status: ${response.status}). Is the token correct?`);
            const data = await response.json();
            setInventory(data);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [token]);

    useEffect(() => { if (token) { fetchInventory(); } }, [fetchInventory, token]);

    const handleOpenAddItemModal = () => {
        setEditingItem(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditItemModal = (item) => {
        setEditingItem(item);
        setIsFormModalOpen(true);
    };

    const handleOpenDeleteModal = (item) => {
        setDeletingItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingItem) return;
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/items/${deletingItem.id}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` },
            });
            if (!response.ok) { throw new Error('Failed to delete item.'); }
            fetchInventory(); // Refresh list
        } catch (e) {
            setError(e.message);
        } finally {
            setIsDeleteModalOpen(false);
            setDeletingItem(null);
        }
    };

    return (
        <>
            <Sidebar onAddItemClick={handleOpenAddItemModal} />
            <main className="flex-grow ml-72 p-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {loading && <div className="flex justify-center items-center h-64"><Loader className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-4 text-gray-500">Loading Inventory...</span></div>}
                    {error && <div className="flex flex-col justify-center items-center h-64 text-red-600 bg-red-50 p-4"><AlertTriangle className="w-12 h-12 mb-4" /><h3 className="text-lg font-semibold">Failed to load data</h3><p className="text-sm">{error}</p></div>}
                    {!loading && !error && (
                        <>
                            <InventoryTable data={inventory} page={currentPage} itemsPerPage={itemsPerPage} onEdit={handleOpenEditItemModal} onDelete={handleOpenDeleteModal} />
                            <div className="p-4">
                                <Pagination currentPage={currentPage} totalItems={inventory.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                            </div>
                        </>
                    )}
                </div>
            </main>
            <ItemFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSave={fetchInventory} token={token} initialData={editingItem} />
            <ConfirmDeleteModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} itemName={deletingItem?.name} />
        </>
    );
};

export default function App() {
    const TOKEN = "97fc97800ef97ba680c207e26e1993f330d62d79"; 
    if (TOKEN === "PASTE_YOUR_TOKEN_HERE") {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-center p-8 bg-white rounded-lg shadow-md">
                    <AlertTriangle className="w-12 h-12 mb-4 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-gray-800">Configuration Error</h1>
                    <p className="text-gray-600 mt-2">Please set your API Authentication Token in the App.tsx file.</p>
                </div>
            </div>
        );
    }
    return (
        <div className="bg-gray-100 font-sans antialiased">
            <Header />
            <div className="flex">
                <InventoryPage token={TOKEN} />
            </div>
        </div>
    );
}
