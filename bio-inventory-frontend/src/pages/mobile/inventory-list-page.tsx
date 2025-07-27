import { useState, useEffect, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Search, Filter, Package, MapPin, Calendar } from 'lucide-react';
import SpeedDialFab from '../../components/mobile/speed-dial-fab.tsx';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import ItemFormModal from '../../modals/ItemFormModal.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';
import MobileBarcodeScanner from '../../components/mobile/MobileBarcodeScanner.tsx';

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  min_quantity: number;
  location: string | { id: number; name: string; parent?: any; description?: string };
  item_type: string | { id: number; name: string; custom_fields_schema?: any };
  vendor: string | { id: number; name: string; website?: string };
  expiry_date: string | null;
  barcode: string | null;
  created_at: string;
}

const MobileInventoryListPage = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isItemFormModalOpen, setIsItemFormModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [filters, setFilters] = useState({
    location: '',
    itemType: '',
    vendor: '',
    lowStock: false
  });

  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('MobileInventoryListPage must be used within an AuthProvider');
  }
  const { token } = authContext;
  const notification = useNotification();

  // Helper functions to safely extract string values
  const getLocationName = (location: string | { id: number; name: string; parent?: any; description?: string }): string => {
    return typeof location === 'string' ? location : location.name;
  };

  const getItemTypeName = (item_type: string | { id: number; name: string; custom_fields_schema?: any }): string => {
    return typeof item_type === 'string' ? item_type : item_type.name;
  };

  const getVendorName = (vendor: string | { id: number; name: string; website?: string }): string => {
    return typeof vendor === 'string' ? vendor : vendor.name;
  };

  useEffect(() => {
    const fetchItems = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(buildApiUrl(API_ENDPOINTS.ITEMS), {
          headers: { 'Authorization': `Token ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setItems(data);
          setFilteredItems(data);
        } else {
          setError('Failed to fetch inventory items');
        }
      } catch (err) {
        console.error('Error fetching items:', err);
        setError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [token, refreshKey]);

  useEffect(() => {
    let filtered = items;

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getLocationName(item.location).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getVendorName(item.vendor).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 其他过滤条件
    if (filters.location) {
      filtered = filtered.filter(item => getLocationName(item.location) === filters.location);
    }
    if (filters.itemType) {
      filtered = filtered.filter(item => getItemTypeName(item.item_type) === filters.itemType);
    }
    if (filters.vendor) {
      filtered = filtered.filter(item => getVendorName(item.vendor) === filters.vendor);
    }
    if (filters.lowStock) {
      filtered = filtered.filter(item => item.quantity <= (item.min_quantity || 5));
    }

    setFilteredItems(filtered);
  }, [items, searchTerm, filters]);

  const getStockStatus = (item: InventoryItem) => {
    const minQty = item.min_quantity || 5;
    if (item.quantity === 0) return { status: 'Out of Stock', color: 'text-red-600' };
    if (item.quantity <= minQty) return { status: 'Low Stock', color: 'text-orange-600' };
    return { status: 'In Stock', color: 'text-green-600' };
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const handleAddItem = () => {
    setIsItemFormModalOpen(true);
  };

  const handleItemSaved = () => {
    setIsItemFormModalOpen(false);
    setRefreshKey(prev => prev + 1);
    notification.success('Item added successfully!');
  };

  const handleScanCheckout = () => {
    setShowBarcodeScanner(true);
  };

  const handleBarcodeScanned = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
  };

  const handleBarcodeConfirmed = async (barcode: string, itemData?: any) => {
    try {
      const checkoutData = {
        barcode: barcode,
        checkout_date: new Date().toISOString(),
        notes: `Mobile checkout via barcode scan: ${barcode}`
      };

      const response = await fetch(buildApiUrl('/api/items/checkout_by_barcode/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify(checkoutData)
      });

      if (response.ok) {
        const result = await response.json();
        notification.success(`Successfully checked out: ${result.item_name || itemData?.name || 'Item'}`);
        setRefreshKey(prev => prev + 1);
        setShowBarcodeScanner(false);
      } else {
        const errorData = await response.json();
        notification.error(`Checkout failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Barcode checkout error:', error);
      notification.error(`Failed to checkout item: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-500 hover:bg-blue-600"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen pb-20">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
        <p className="text-gray-600">{filteredItems.length} items found</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search items, locations, vendors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-12"
        />
        <Button
          onClick={() => setShowFilters(!showFilters)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-8 w-8 bg-gray-200 hover:bg-gray-300"
        >
          <Filter className="w-4 h-4 text-gray-600" />
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Locations</option>
                {Array.from(new Set(items.map(item => getLocationName(item.location)))).map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
              <select
                value={filters.itemType}
                onChange={(e) => setFilters(prev => ({ ...prev, itemType: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Types</option>
                {Array.from(new Set(items.map(item => getItemTypeName(item.item_type)))).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="lowStock"
                checked={filters.lowStock}
                onChange={(e) => setFilters(prev => ({ ...prev, lowStock: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="lowStock" className="text-sm text-gray-700">Show only low stock items</label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const stockStatus = getStockStatus(item);
          const expiringSoon = isExpiringSoon(item.expiry_date);
          
          return (
            <Card key={item.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800 text-lg">{item.name}</h3>
                  <span className={`text-sm font-medium ${stockStatus.color}`}>
                    {stockStatus.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Package className="w-4 h-4 mr-2" />
                    <span>Quantity: {item.quantity}</span>
                    {item.min_quantity && (
                      <span className="ml-2 text-gray-500">(Min: {item.min_quantity})</span>
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{getLocationName(item.location)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {getItemTypeName(item.item_type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getVendorName(item.vendor)}
                    </span>
                  </div>
                  
                  {item.expiry_date && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span className={expiringSoon ? 'text-orange-600 font-medium' : ''}>
                        Expires: {new Date(item.expiry_date).toLocaleDateString()}
                        {expiringSoon && ' (Soon)'}
                      </span>
                    </div>
                  )}
                  
                  {item.barcode && (
                    <div className="text-xs text-gray-500">
                      Barcode: {item.barcode}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredItems.length === 0 && !loading && (
        <div className="text-center py-8">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No items found</p>
          <p className="text-sm text-gray-400 mt-2">
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* Speed Dial FAB */}
      <SpeedDialFab
        onAddItem={handleAddItem}
        onScanCheckout={handleScanCheckout}
      />

      {/* Modals */}
      <ItemFormModal
        isOpen={isItemFormModalOpen}
        onClose={() => setIsItemFormModalOpen(false)}
        onSave={handleItemSaved}
        token={token}
      />
      
      {/* Barcode Scanner */}
      <MobileBarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        onConfirm={handleBarcodeConfirmed}
        title="Scan Item for Checkout"
        token={token}
      />
    </div>
  );
};

export default MobileInventoryListPage;