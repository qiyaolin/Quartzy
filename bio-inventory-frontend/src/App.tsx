import React, { useState, useMemo, useEffect, useCallback, useContext, createContext } from 'react';
import { Search, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, PlusCircle, Filter, Upload, Download, Settings, MoreVertical, Archive, Edit, Trash2, AlertTriangle, Loader, X, FileText, ShoppingCart, Inbox, CheckCircle, Clock, Package, History, RefreshCw, LogOut, Users, UserPlus, Shield, ShieldOff } from 'lucide-react';

// --- AUTHENTICATION CONTEXT ---
interface AuthContextType {
  user: any;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('authToken'));

    useEffect(() => {
        if (token) {
            localStorage.setItem('authToken', token);
            // Fetch user details when token is available
            const fetchUser = async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/users/me/', {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                    } else {
                        // Token is invalid, log out
                        handleLogout();
                    }
                } catch (e) {
                    console.error("Failed to fetch user", e);
                    handleLogout();
                }
            };
            fetchUser();
        } else {
            localStorage.removeItem('authToken');
            setUser(null);
        }
    }, [token]);

    const handleLogin = (newToken) => {
        setToken(newToken);
    };

    const handleLogout = useCallback(() => {
        setToken(null);
    }, []);

    const value = { user, token, login: handleLogin, logout: handleLogout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- HELPER & MODAL COMPONENTS ---
const SidebarFilter = ({ title, options, selected, onFilterChange }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="py-4 border-b border-gray-200">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <h4 className="font-semibold text-gray-700">{title}</h4>
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="mt-3 max-h-48 overflow-y-auto">
                    {options.map(option => (
                        <div key={option.id} className="flex items-center my-2">
                            <input 
                                type="checkbox" 
                                id={`${title}-${option.id}`} 
                                checked={selected.includes(option.id)}
                                onChange={() => onFilterChange(option.id)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor={`${title}-${option.id}`} className="ml-2 text-gray-600">{option.name}</label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
const ItemFormModal = ({ isOpen, onClose, onSave, token, initialData = null }) => {
    const [formData, setFormData] = useState<any>({});
    const [dropdownData, setDropdownData] = useState<any>({ vendors: [], locations: [], itemTypes: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditMode = initialData !== null;

    useEffect(() => {
        const emptyForm = { name: '', item_type_id: '', vendor_id: '', owner_id: '1', catalog_number: '', quantity: '1.00', unit: '', location_id: '', price: '', };
        if (isEditMode) {
            setFormData({
                name: initialData.name || '', item_type_id: initialData.item_type?.id || '', vendor_id: initialData.vendor?.id || '',
                owner_id: initialData.owner?.id || '1', catalog_number: initialData.catalog_number || '', quantity: initialData.quantity || '1.00',
                unit: initialData.unit || '', location_id: initialData.location?.id || '', price: initialData.price || '',
            });
        } else { setFormData(emptyForm); }
    }, [initialData, isEditMode]);

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
                    const vendors = await vendorsRes.json(); const locations = await locationsRes.json(); const itemTypes = await itemTypesRes.json();
                    setDropdownData({ vendors, locations, itemTypes });
                } catch (e) { setError('Could not load form data.'); }
            };
            fetchDropdownData();
        }
    }, [isOpen, token]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        const url = isEditMode ? `http://127.0.0.1:8000/api/items/${initialData.id}/` : 'http://127.0.0.1:8000/api/items/';
        const method = isEditMode ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` }, body: JSON.stringify(formData) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(JSON.stringify(errorData)); }
            onSave(); onClose();
        } catch (e) { setError(`Submission failed: ${e.message}`); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button></div>
            <form onSubmit={handleSubmit}><div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                <div className="col-span-2"><label htmlFor="name" className="block text-sm font-medium text-gray-700">Item Name *</label><input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                <div><label htmlFor="item_type_id" className="block text-sm font-medium text-gray-700">Type *</label><select name="item_type_id" id="item_type_id" value={formData.item_type_id} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"><option value="">Select...</option>{dropdownData.itemTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
                <div><label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">Vendor</label><select name="vendor_id" id="vendor_id" value={formData.vendor_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"><option value="">Select...</option>{dropdownData.vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></div>
                <div><label htmlFor="location_id" className="block text-sm font-medium text-gray-700">Location</label><select name="location_id" id="location_id" value={formData.location_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"><option value="">Select...</option>{dropdownData.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></div>
                <div><label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity</label><input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                <div><label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit</label><input type="text" name="unit" id="unit" placeholder="e.g., box, kg, mL" value={formData.unit} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                <div><label htmlFor="price" className="block text-sm font-medium text-gray-700">Unit Price</label><input type="number" name="price" id="price" placeholder="0.00" value={formData.price} onChange={handleChange} step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
            </div>{error && <div className="px-6 pb-4 text-red-600 text-sm">{error}</div>}<div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center">{isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}Save Item</button></div></form>
        </div></div>
    );
};
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, itemName }) => {
    if (!isOpen) return null;
    return <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"><h2 className="text-xl font-bold text-gray-800">Confirm Deletion</h2><p className="mt-4 text-gray-600">Are you sure you want to delete the item: <strong>{itemName}</strong>? This action cannot be undone.</p><div className="mt-6 flex justify-end space-x-4"><button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button onClick={onConfirm} className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-red-700">Delete</button></div></div></div>;
};
const MarkReceivedModal = ({ isOpen, onClose, onSave, token, request }) => {
    const [locationId, setLocationId] = useState('');
    const [quantityReceived, setQuantityReceived] = useState(request?.quantity || 1);
    const [locations, setLocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        if (isOpen) {
            const fetchLocations = async () => {
                const response = await fetch('http://127.0.0.1:8000/api/locations/', { headers: { 'Authorization': `Token ${token}` } });
                const data = await response.json();
                setLocations(data);
            };
            fetchLocations();
            setQuantityReceived(request?.quantity || 1);
        }
    }, [isOpen, request, token]);
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true);
        await onSave(request.id, { location_id: locationId, quantity_received: quantityReceived });
        setIsSubmitting(false);
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <form onSubmit={handleSubmit}>
                <div className="p-6"><h2 className="text-xl font-bold text-gray-800">Mark as Received</h2><p className="mt-2 text-gray-600">Receiving: <strong>{request.item_name}</strong></p></div>
                <div className="p-6 space-y-4">
                    <div><label htmlFor="quantityReceived" className="block text-sm font-medium text-gray-700">Quantity Received *</label><input type="number" id="quantityReceived" value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} required max={request.quantity} min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                    <div><label htmlFor="locationId" className="block text-sm font-medium text-gray-700">Storage Location *</label><select id="locationId" value={locationId} onChange={(e) => setLocationId(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="">Select a location...</option>{locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></div>
                </div>
                <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">{isSubmitting ? 'Saving...' : 'Confirm & Update Inventory'}</button></div>
            </form>
        </div></div>
    );
};
const RequestHistoryModal = ({ isOpen, onClose, history }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Request History</h2>
            <ul className="space-y-2">
                {history.map(entry => (
                    <li key={entry.id} className="p-2 bg-gray-50 rounded-md text-sm">
                        Status changed from <strong>{entry.old_status}</strong> to <strong>{entry.new_status}</strong> by {entry.user?.username || 'system'} on {new Date(entry.timestamp).toLocaleString()}
                    </li>
                ))}
            </ul>
            <div className="mt-6 flex justify-end"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold text-gray-800 hover:bg-gray-300">Close</button></div>
        </div></div>
    );
};
const RequestFormModal = ({ isOpen, onClose, onSave, token }) => {
    const [formData, setFormData] = useState({ item_name: '', vendor_id: '', catalog_number: '', quantity: 1, unit_size: '', unit_price: '', url: '', notes: '' });
    const [vendors, setVendors] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const fetchVendors = async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/vendors/', { headers: { 'Authorization': `Token ${token}` } });
                    const data = await response.json();
                    setVendors(data);
                } catch (e) { setError('Could not load vendors.'); }
            };
            fetchVendors();
        }
    }, [isOpen, token]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/requests/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ ...formData, requested_by_id: 1 }) // Use requested_by_id and a default user
            });
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(JSON.stringify(errorData)); 
            }
            onSave(); onClose();
        } catch (e) { setError(`Submission failed: ${e.message}`); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Add New Request</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button></div>
            <form onSubmit={handleSubmit}><div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                <div className="col-span-2"><label htmlFor="item_name" className="block text-sm font-medium text-gray-700">Item Name *</label><input type="text" name="item_name" id="item_name" value={formData.item_name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">Vendor</label><select name="vendor_id" id="vendor_id" value={formData.vendor_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="">Select...</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                <div><label htmlFor="catalog_number" className="block text-sm font-medium text-gray-700">Catalog #</label><input type="text" name="catalog_number" id="catalog_number" value={formData.catalog_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity *</label><input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label htmlFor="unit_size" className="block text-sm font-medium text-gray-700">Unit Size</label><input type="text" name="unit_size" id="unit_size" value={formData.unit_size} onChange={handleChange} placeholder="e.g., 100 uL, 500 g" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div className="col-span-2"><label htmlFor="unit_price" className="block text-sm font-medium text-gray-700">Unit Price *</label><input type="number" name="unit_price" id="unit_price" value={formData.unit_price} onChange={handleChange} required step="0.01" placeholder="0.00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div className="col-span-2"><label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label><input type="url" name="url" id="url" value={formData.url} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div className="col-span-2"><label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
            </div>{error && <div className="px-6 pb-4 text-red-600 text-sm">{error}</div>}<div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center">{isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}Save Request</button></div></form>
        </div></div>
    );
};

const UserFormModal = ({ isOpen, onClose, onSave, token, initialData = null }) => {
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const isEditMode = initialData !== null;

    useEffect(() => {
        const emptyForm = { username: '', email: '', first_name: '', last_name: '', password: '', confirm_password: '', is_staff: false, is_active: true };
        if (isEditMode) {
            setFormData({
                username: initialData.username || '', email: initialData.email || '', first_name: initialData.first_name || '',
                last_name: initialData.last_name || '', is_staff: initialData.is_staff || false, is_active: initialData.is_active !== false,
                password: '', confirm_password: ''
            });
        } else { setFormData(emptyForm); }
    }, [initialData, isEditMode]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        
        if (!isEditMode && (!formData.password || formData.password.length < 8)) {
            setError('Password must be at least 8 characters long.');
            setIsSubmitting(false);
            return;
        }
        
        if (formData.password && formData.password !== formData.confirm_password) {
            setError('Passwords do not match.');
            setIsSubmitting(false);
            return;
        }

        const submitData = { ...formData };
        if (isEditMode && !submitData.password) {
            delete submitData.password;
            delete submitData.confirm_password;
        }

        const url = isEditMode ? `http://127.0.0.1:8000/api/users/${initialData.id}/` : 'http://127.0.0.1:8000/api/users/';
        const method = isEditMode ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(url, { 
                method, 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` }, 
                body: JSON.stringify(submitData) 
            });
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(Object.values(errorData).flat().join(', ')); 
            }
            onSave(); onClose();
        } catch (e) { setError(`Submission failed: ${e.message}`); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit User' : 'Add New User'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                        <div><label className="block text-sm font-medium text-gray-700">Username *</label><input type="text" name="username" value={formData.username || ''} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">First Name</label><input type="text" name="first_name" value={formData.first_name || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Last Name</label><input type="text" name="last_name" value={formData.last_name || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Password {!isEditMode && '*'}</label><input type="password" name="password" value={formData.password || ''} onChange={handleChange} required={!isEditMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder={isEditMode ? 'Leave blank to keep current password' : ''} /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Confirm Password {!isEditMode && '*'}</label><input type="password" name="confirm_password" value={formData.confirm_password || ''} onChange={handleChange} required={!isEditMode || !!formData.password} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div className="flex items-center">
                            <input type="checkbox" name="is_staff" id="is_staff" checked={formData.is_staff || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="is_staff" className="ml-2 text-sm font-medium text-gray-700">Admin Privileges</label>
                        </div>
                        <div className="flex items-center">
                            <input type="checkbox" name="is_active" id="is_active" checked={formData.is_active !== false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">Active</label>
                        </div>
                    </div>
                    {error && <div className="px-6 pb-4 text-red-600 text-sm">{error}</div>}
                    <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
                            {isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}{isEditMode ? 'Update User' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ConfirmDeleteUserModal = ({ isOpen, onClose, onConfirm, userName }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-800">Confirm Deletion</h2>
                <p className="mt-4 text-gray-600">Are you sure you want to delete user: <strong>{userName}</strong>? This action cannot be undone.</p>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-red-700">Delete User</button>
                </div>
            </div>
        </div>
    );
};
const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;
    return <div className="flex items-center justify-between text-sm text-gray-600"><div>Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results</div><div className="flex items-center space-x-2"><button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronsLeft className="w-5 h-5" /></button><button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button><span className="px-2">Page {currentPage} of {totalPages}</span><button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button><button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronsRight className="w-5 h-5" /></button></div></div>;
};

// --- SHARED & LAYOUT COMPONENTS ---
const Header = ({ activePage, onNavigate }) => {
    const { user, logout } = useContext(AuthContext);
    return (
        <header className="bg-white h-16 flex items-center justify-between px-6 border-b border-gray-200 sticky top-0 z-30">
            <div className="flex items-center">
                <div className="flex items-center space-x-2 mr-6"><div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md"></div><span className="font-bold text-lg text-gray-800">Hayer Lab</span><ChevronDown className="w-5 h-5 text-gray-500" /></div>
                <nav className="flex items-center space-x-1">
                    <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('requests')}} className={`flex items-center px-3 py-2 text-sm font-medium ${activePage === 'requests' ? 'text-gray-900 bg-gray-100 rounded-md' : 'text-gray-500 hover:text-gray-900'}`}><FileText className="w-4 h-4 mr-2"/>Requests</a>
                    <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('orders')}} className={`flex items-center px-3 py-2 text-sm font-medium ${activePage === 'orders' ? 'text-gray-900 bg-gray-100 rounded-md' : 'text-gray-500 hover:text-gray-900'}`}><ShoppingCart className="w-4 h-4 mr-2"/>Orders</a>
                    <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('inventory')}} className={`flex items-center px-3 py-2 text-sm font-medium ${activePage === 'inventory' ? 'text-gray-900 bg-gray-100 rounded-md' : 'text-gray-500 hover:text-gray-900'}`}><Inbox className="w-4 h-4 mr-2"/>Inventory</a>
                    {user?.is_staff && <a href="#" onClick={(e) => {e.preventDefault(); onNavigate('users')}} className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900"><Users className="w-4 h-4 mr-2"/>Manage Users</a>}
                </nav>
            </div>
            <div className="flex items-center flex-grow max-w-md mx-4"><div className="relative w-full"><input type="text" placeholder="Search Quartzy" className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md" /><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /></div></div>
            <div className="flex items-center space-x-4">
                <div className="relative">
                    <button className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-700 font-bold text-sm" onClick={() => document.getElementById('logout-menu').classList.toggle('hidden')}>
                        {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                    </button>
                    <div id="logout-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
                        <a href="#" onClick={(e) => {e.preventDefault(); logout();}} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><LogOut className="w-4 h-4 mr-2" /> Logout</a>
                    </div>
                </div>
            </div>
        </header>
    );
};


// --- INVENTORY PAGE COMPONENTS ---
const InventorySidebar = ({ onAddItemClick, filters, onFilterChange, filterOptions }) => (
    <aside className="w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col h-full">
        <div className="flex-grow overflow-y-auto -mr-6 pr-6">
            <button onClick={onAddItemClick} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-colors"><PlusCircle className="w-5 h-5" /><span>Add Item</span></button>
            <div className="relative my-4">
                <form onSubmit={(e) => { e.preventDefault(); onFilterChange('search', e.target.elements.search.value); }}>
                    <input type="text" name="search" placeholder="Search inventory" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </form>
            </div>
            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Filters</h3>
            <SidebarFilter title="Location" options={filterOptions.locations} selected={filters.location} onFilterChange={(id) => onFilterChange('location', id)} />
            <SidebarFilter title="Type" options={filterOptions.itemTypes} selected={filters.item_type} onFilterChange={(id) => onFilterChange('item_type', id)} />
            <SidebarFilter title="Vendor" options={filterOptions.vendors} selected={filters.vendor} onFilterChange={(id) => onFilterChange('vendor', id)} />
        </div>
        <div className="pt-4 border-t border-gray-200">
            <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1"><Upload className="w-5 h-5" /><span>Import Inventory</span></button>
            <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1"><Download className="w-5 h-5" /><span>Export Inventory</span></button>
        </div>
    </aside>
);
const InventoryTable = ({ groupedData, onEdit, onDelete }) => {
    const [expandedGroups, setExpandedGroups] = useState({});
    const toggleGroup = (groupId) => { setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] })); };
    return (
        <table className="min-w-full bg-white">
            <thead className="bg-gray-50"><tr>
                <th className="p-4 w-12"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" /></th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="p-4 w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
                {Object.values(groupedData).map(group => (
                    <React.Fragment key={group.id}>
                        <tr className="bg-gray-50 hover:bg-gray-100">
                            <td className="p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" /></td>
                            <td className="p-4 text-sm text-gray-900 font-medium"><button onClick={() => toggleGroup(group.id)} className="flex items-center"><ChevronDown className={`w-4 h-4 mr-2 transition-transform ${expandedGroups[group.id] ? 'rotate-180' : ''}`} />{group.name}</button></td>
                            <td className="p-4 text-sm text-gray-500">{group.vendor.name}</td>
                            <td className="p-4 text-sm text-gray-500">{group.totalQuantity.toFixed(2)} {group.instances[0].unit}</td>
                            <td className="p-4 text-sm text-gray-500">{group.item_type.name}</td>
                            <td></td>
                        </tr>
                        {expandedGroups[group.id] && group.instances.map(instance => (
                            <tr key={instance.id} className="bg-white hover:bg-gray-50">
                                <td></td>
                                <td className="pl-16 pr-4 py-2 text-sm text-gray-700">In: {instance.location?.name || 'N/A'}</td>
                                <td className="p-2 text-sm text-gray-500">Owner: {instance.owner?.username || 'N/A'}</td>
                                <td className="p-2 text-sm text-gray-500">{parseFloat(instance.quantity).toFixed(2)} {instance.unit}</td>
                                <td className="p-2 text-sm text-gray-500">Updated: {new Date(instance.updated_at).toLocaleDateString()}</td>
                                <td className="p-2 text-sm text-right pr-4">
                                    <button onClick={() => onEdit(instance)} className="p-1 hover:bg-gray-200 rounded-full"><Edit className="w-4 h-4 text-gray-600" /></button>
                                    <button onClick={() => onDelete(instance)} className="p-1 hover:bg-gray-200 rounded-full"><Trash2 className="w-4 h-4 text-red-600" /></button>
                                </td>
                            </tr>
                        ))}
                    </React.Fragment>
                ))}
            </tbody>
        </table>
    );
};
const InventoryPage = ({ onEditItem, onDeleteItem, refreshKey, filters, filterOptions }) => {
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
        <main className="flex-grow p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h1 className="text-3xl font-bold text-gray-900">Inventory</h1></div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {loading && <div className="flex justify-center items-center h-64"><Loader className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-4 text-gray-500">Loading Inventory...</span></div>}
                {error && <div className="flex flex-col justify-center items-center h-64 text-red-600 bg-red-50 p-4"><AlertTriangle className="w-12 h-12 mb-4" /><h3 className="text-lg font-semibold">Failed to load data</h3><p className="text-sm">{error}</p></div>}
                {!loading && !error && (
                    <>
                        <InventoryTable groupedData={groupedInventory} onEdit={onEditItem} onDelete={onDeleteItem} />
                        <div className="p-4"><Pagination currentPage={currentPage} totalItems={Object.keys(groupedInventory).length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} /></div>
                    </>
                )}
            </div>
        </main>
    );
};


// --- REQUESTS PAGE COMPONENTS ---
const RequestsSidebar = ({ onAddRequestClick, filters, onFilterChange, filterOptions }) => (
    <aside className="w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col h-full">
        <div className="flex-grow overflow-y-auto -mr-6 pr-6">
            <button onClick={onAddRequestClick} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-colors">
                <PlusCircle className="w-5 h-5" /><span>Add Request</span>
            </button>
            <div className="relative my-4">
                <form onSubmit={(e) => { e.preventDefault(); onFilterChange('search', e.target.elements.search.value); }}>
                    <input type="text" name="search" placeholder="Search requests" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </form>
            </div>
            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Filters</h3>
            <SidebarFilter title="Vendor" options={filterOptions.vendors} selected={filters.vendor} onFilterChange={(id) => onFilterChange('vendor', id)} />
            <SidebarFilter title="Requested By" options={filterOptions.users} selected={filters.requested_by} onFilterChange={(id) => onFilterChange('requested_by', id)} />
        </div>
        <div className="pt-4 border-t border-gray-200">
            <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1"><Upload className="w-5 h-5" /><span>Import Requests</span></button>
            <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1"><Download className="w-5 h-5" /><span>Export Requests</span></button>
        </div>
    </aside>
);
const RequestsTable = ({ requests, onApprove, onPlaceOrder, onMarkReceived, onReorder, onShowHistory }) => {
    const { user } = useContext(AuthContext); // Get user from context
    return (
        <table className="min-w-full bg-white">
            <thead className="bg-gray-50"><tr>
                <th className="p-4 w-8"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" /></th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">From</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
                {requests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50">
                        <td className="p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" /></td>
                        <td className="p-4 text-sm text-gray-900 font-medium">{req.item_name}{req.notes && <p className="text-xs text-gray-500 mt-1">{req.notes}</p>}</td>
                        <td className="p-4 text-sm text-gray-500">{req.vendor?.name || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500">${req.unit_price}</td>
                        <td className="p-4 text-sm text-gray-500">{req.requested_by?.username || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500">{new Date(req.updated_at).toLocaleDateString()}</td>
                        <td className="p-4 text-sm text-gray-500 space-x-2">
                            {user?.is_staff && req.status === 'NEW' && <button onClick={() => onApprove(req.id)} className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full hover:bg-green-200">Approve</button>}
                            {req.status === 'APPROVED' && <button onClick={() => onPlaceOrder(req.id)} className="px-3 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full hover:bg-yellow-200">Place Order</button>}
                            {req.status === 'ORDERED' && <button onClick={() => onMarkReceived(req)} className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200">Mark Received</button>}
                            {req.status === 'RECEIVED' && <button onClick={() => onReorder(req.id)} className="px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full hover:bg-purple-200">Reorder</button>}
                            <button onClick={() => onShowHistory(req.id)} className="p-1 hover:bg-gray-200 rounded-full"><History className="w-4 h-4 text-gray-600" /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
const RequestsPage = ({ onAddRequestClick, refreshKey, filters, onFilterChange }) => {
    const { token } = useContext(AuthContext);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [historyData, setHistoryData] = useState([]);

    const fetchRequests = useCallback(async () => {
        setLoading(true); setError(null);
        const params = new URLSearchParams();
        // Remove status from params to fetch all requests for accurate badge counts
        if (filters.search) params.append('search', filters.search);
        Object.keys(filters).forEach(key => {
            if (!['search', 'status'].includes(key) && filters[key].length > 0) {
                filters[key].forEach(value => params.append(key, value));
            }
        });
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/requests/?${params.toString()}`, { headers: { 'Authorization': `Token ${token}` } });
            if (!response.ok) throw new Error(`Authentication failed.`);
            const data = await response.json();
            setRequests(data);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [token, filters]);

    useEffect(() => {
        if (token) { fetchRequests(); }
    }, [token, refreshKey, fetchRequests]);

    const handleAction = async (url, options = {}) => {
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }, ...options });
            if (!response.ok) throw new Error('Action failed.');
            fetchRequests(); // Refresh list on success
        } catch (e) { alert(e.message); }
    };

    const handleApprove = (id) => handleAction(`http://127.0.0.1:8000/api/requests/${id}/approve/`);
    const handlePlaceOrder = (id) => handleAction(`http://127.0.0.1:8000/api/requests/${id}/place_order/`);
    const handleReorder = (id) => handleAction(`http://127.0.0.1:8000/api/requests/${id}/reorder/`);
    const handleMarkReceived = (req) => { setSelectedRequest(req); setIsReceivedModalOpen(true); };
    const handleSaveReceived = async (id, data) => {
        await handleAction(`http://127.0.0.1:8000/api/requests/${id}/mark_received/`, { body: JSON.stringify(data) });
        setIsReceivedModalOpen(false);
    };
    const handleShowHistory = async (id) => {
        const response = await fetch(`http://127.0.0.1:8000/api/requests/${id}/history/`, { headers: { 'Authorization': `Token ${token}` } });
        const data = await response.json();
        setHistoryData(data);
        setIsHistoryModalOpen(true);
    };

    const statusTabs = [ { key: 'NEW', label: 'New' }, { key: 'APPROVED', label: 'Approved' }, { key: 'ORDERED', label: 'Ordered' }, { key: 'RECEIVED', label: 'Received' } ];

    return (
        <>
            <main className="flex-grow p-8 overflow-y-auto">
                <div className="flex justify-between items-center mb-6"><h1 className="text-3xl font-bold text-gray-900">Requests</h1></div>
                <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-6">
                    {statusTabs.map(tab => {
                        const count = requests.filter(r => r.status === tab.key).length;
                        return (<button key={tab.key} onClick={() => onFilterChange('status', tab.key)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${filters.status === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            {tab.label} <span className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${filters.status === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-900'}`}>{count}</span>
                        </button>);
                    })}
                </nav></div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
                    {loading && <div className="flex justify-center items-center h-64"><Loader className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-4 text-gray-500">Loading Requests...</span></div>}
                    {error && <div className="flex flex-col justify-center items-center h-64 text-red-600 bg-red-50 p-4"><AlertTriangle className="w-12 h-12 mb-4" /><h3 className="text-lg font-semibold">Failed to load data</h3><p className="text-sm">{error}</p></div>}
                    {!loading && !error && <RequestsTable requests={requests.filter(r => r.status === filters.status)} onApprove={handleApprove} onPlaceOrder={handlePlaceOrder} onMarkReceived={handleMarkReceived} onReorder={handleReorder} onShowHistory={handleShowHistory} />}
                </div>
            </main>
            <MarkReceivedModal isOpen={isReceivedModalOpen} onClose={() => setIsReceivedModalOpen(false)} onSave={handleSaveReceived} token={token} request={selectedRequest} />
            <RequestHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={historyData} />
        </>
    );
};

const LoginPage = () => {
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setError('');
        try {
            const response = await fetch('http://127.0.0.1:8000/api/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (response.ok) {
                const data = await response.json();
                login(data.token); // The login function from context will handle the rest
            } else {
                setError('Invalid username or password.');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <div className="text-center"><h2 className="text-3xl font-bold text-gray-900">Sign in to your account</h2></div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div><input id="username" name="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Username" /></div>
                        <div><input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Password" /></div>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div><button type="submit" disabled={isLoggingIn} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">{isLoggingIn ? 'Signing in...' : 'Sign in'}</button></div>
                </form>
            </div>
        </div>
    );
};

// --- USER MANAGEMENT PAGE COMPONENTS ---
const UserManagementSidebar = ({ onAddUserClick, users = [] }) => {
    const activeUsers = users.filter(user => user.is_active).length;
    const adminUsers = users.filter(user => user.is_staff).length;
    
    return (
        <aside className="w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col h-full">
            <div className="flex-grow overflow-y-auto -mr-6 pr-6">
                <button onClick={onAddUserClick} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-colors">
                    <UserPlus className="w-5 h-5" /><span>Add User</span>
                </button>
                <div className="relative my-4">
                    <input type="text" placeholder="Search users" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">User Statistics</h3>
                <div className="mt-4 space-y-3">
                    <div className="p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-gray-900">{activeUsers}</div>
                        <div className="text-xs text-gray-500">Active Users</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-gray-900">{adminUsers}</div>
                        <div className="text-xs text-gray-500">Administrators</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-gray-900">{users.length}</div>
                        <div className="text-xs text-gray-500">Total Users</div>
                    </div>
                </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
                <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1">
                    <Upload className="w-5 h-5" /><span>Import Users</span>
                </button>
                <button className="w-full text-gray-600 hover:bg-gray-200 font-medium py-2 px-4 rounded-md flex items-center justify-center space-x-2 my-1">
                    <Download className="w-5 h-5" /><span>Export Users</span>
                </button>
            </div>
        </aside>
    );
};

const UsersTable = ({ users, onEdit, onDelete, onToggleStatus }) => (
    <table className="min-w-full bg-white">
        <thead className="bg-gray-50">
            <tr>
                <th className="p-4 w-12"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" /></th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="p-4 w-32 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
            {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" /></td>
                    <td className="p-4">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm mr-3">
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-900">{user.username}</div>
                                {(user.first_name || user.last_name) && (
                                    <div className="text-sm text-gray-500">{user.first_name} {user.last_name}</div>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{user.email || 'No email'}</td>
                    <td className="p-4">
                        {user.is_staff ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Shield className="w-3 h-3 mr-1" />Administrator
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                User
                            </span>
                        )}
                    </td>
                    <td className="p-4">
                        {user.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Inactive
                            </span>
                        )}
                    </td>
                    <td className="p-4 text-sm text-gray-500">{new Date(user.date_joined).toLocaleDateString()}</td>
                    <td className="p-4 text-center">
                        <div className="flex justify-center space-x-2">
                            <button onClick={() => onToggleStatus(user)} className={`p-1 hover:bg-gray-200 rounded-full ${user.is_active ? 'text-red-600' : 'text-green-600'}`} title={user.is_active ? 'Deactivate user' : 'Activate user'}>
                                {user.is_active ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            </button>
                            <button onClick={() => onEdit(user)} className="p-1 hover:bg-gray-200 rounded-full text-gray-600" title="Edit user">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(user)} className="p-1 hover:bg-gray-200 rounded-full text-red-600" title="Delete user">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

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
                const response = await fetch('http://127.0.0.1:8000/api/users/', { 
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
            const response = await fetch(`http://127.0.0.1:8000/api/users/${user.id}/toggle-status/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle user status');
            }
            // Refresh the user list
            const updatedResponse = await fetch('http://127.0.0.1:8000/api/users/', { 
                headers: { 'Authorization': `Token ${token}` } 
            });
            const updatedData = await updatedResponse.json();
            setUsers(updatedData);
        } catch (e) { 
            alert(e.message); 
        }
    };

    return (
        <main className="flex-grow p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <Loader className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-4 text-gray-500">Loading Users...</span>
                    </div>
                )}
                {error && (
                    <div className="flex flex-col justify-center items-center h-64 text-red-600 bg-red-50 p-4">
                        <AlertTriangle className="w-12 h-12 mb-4" />
                        <h3 className="text-lg font-semibold">Failed to load users</h3>
                        <p className="text-sm">{error}</p>
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
                        <div className="p-4">
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

// --- MAIN APP COMPONENT ---
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

    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!token) return;
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
                setFilterOptions({ vendors, locations, itemTypes, users: [] }); // Users can be populated later
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
            case 'orders': return <main className="flex-grow p-8"><h1>Orders Page Coming Soon...</h1></main>;
            case 'users': return <UserManagementPage onEditUser={handleOpenEditUserModal} onDeleteUser={handleOpenDeleteUserModal} refreshKey={refreshKey} users={users} setUsers={setUsers} />;
            default: return <InventoryPage onEditItem={handleOpenEditItemModal} onDeleteItem={handleOpenDeleteModal} refreshKey={refreshKey} filters={inventoryFilters} />;
        }
    }

    return (
        <div className="bg-gray-100 font-sans antialiased h-screen flex flex-col">
            <Header activePage={activePage} onNavigate={setActivePage} />
            <div className="flex flex-grow overflow-hidden">
                {activePage === 'inventory' && <InventorySidebar onAddItemClick={handleOpenAddItemModal} filters={inventoryFilters} onFilterChange={handleInventoryFilterChange} filterOptions={filterOptions} />}
                {activePage === 'requests' && <RequestsSidebar onAddRequestClick={() => setIsRequestFormModalOpen(true)} filters={requestFilters} onFilterChange={handleRequestFilterChange} filterOptions={filterOptions} />}
                {activePage === 'users' && <UserManagementSidebar onAddUserClick={handleOpenAddUserModal} users={users} />}
                {renderPage()}
            </div>
            <ItemFormModal isOpen={isItemFormModalOpen} onClose={() => setIsItemFormModalOpen(false)} onSave={handleSave} token={token} initialData={editingItem} />
            <RequestFormModal isOpen={isRequestFormModalOpen} onClose={() => setIsRequestFormModalOpen(false)} onSave={handleSave} token={token} />
            <UserFormModal isOpen={isUserFormModalOpen} onClose={() => setIsUserFormModalOpen(false)} onSave={handleSave} token={token} initialData={editingUser} />
            <ConfirmDeleteModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} itemName={deletingItem?.name} />
            <ConfirmDeleteUserModal isOpen={isDeleteUserModalOpen} onClose={() => setIsDeleteUserModalOpen(false)} onConfirm={handleDeleteUserConfirm} userName={deletingUser?.username} />
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

function AppContent() {
    const { token } = useContext(AuthContext);
    if (!token) {
        return <LoginPage />;
    }
    return <MainApp />;
}
