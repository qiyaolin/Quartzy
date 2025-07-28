import { useState, useEffect, useContext } from 'react';
import { Input } from '../../components/ui/input.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Search, Filter, Package, MapPin, Calendar, AlertTriangle, CheckCircle, Scan, DollarSign, Printer } from 'lucide-react';
import SpeedDialFab from '../../components/mobile/speed-dial-fab.tsx';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import MobileItemFormModal from '../../modals/MobileItemFormModal.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';
import ZBarBarcodeScanner from '../../components/ZBarBarcodeScanner.tsx';
import MobileBarcodeConfirmDialog from '../../components/mobile/MobileBarcodeConfirmDialog.tsx';

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
  fund_id?: number;
  fund_name?: string;
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
  const [showPrintConfirmDialog, setShowPrintConfirmDialog] = useState(false);
  const [selectedItemForPrint, setSelectedItemForPrint] = useState<InventoryItem | null>(null);
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

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getLocationName(item.location).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getVendorName(item.vendor).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Other filters
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
    if (item.quantity === 0) return { 
      status: 'Out of Stock', 
      color: 'text-red-600', 
      bg: 'bg-gradient-to-r from-red-100 to-red-200',
      icon: AlertTriangle,
      dotColor: 'bg-red-500'
    };
    if (item.quantity <= minQty) return { 
      status: 'Low Stock', 
      color: 'text-orange-600', 
      bg: 'bg-gradient-to-r from-orange-100 to-orange-200',
      icon: AlertTriangle,
      dotColor: 'bg-orange-500'
    };
    return { 
      status: 'In Stock', 
      color: 'text-green-600', 
      bg: 'bg-gradient-to-r from-green-100 to-green-200',
      icon: CheckCircle,
      dotColor: 'bg-green-500'
    };
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
    } catch (error: any) {
      console.error('Barcode checkout error:', error);
      notification.error(`Failed to checkout item: ${error.message}`);
    }
  };

  const handleBarcodeClick = (item: InventoryItem) => {
    if (item.barcode) {
      setSelectedItemForPrint(item);
      setShowPrintConfirmDialog(true);
    }
  };

  // Centralized print function - sends print job to server
  const handlePrintConfirm = async () => {
    if (selectedItemForPrint) {
      try {
        setShowPrintConfirmDialog(false);
        
        // Send print job to centralized print server
        const response = await fetch(buildApiUrl('/api/printing/api/jobs/'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          },
          body: JSON.stringify({
            label_data: {
              itemName: selectedItemForPrint.name,
              barcode: selectedItemForPrint.barcode || '',
              customText: selectedItemForPrint.name,
              fontSize: 8,
              isBold: false
            },
            priority: 'normal',
            item_id: selectedItemForPrint.id
          })
        });

        if (response.ok) {
          const result = await response.json();
          notification.success(`Print job sent to server successfully! Job ID: ${result.id || 'N/A'}`);
          setSelectedItemForPrint(null);
        } else {
          const errorData = await response.json();
          notification.error(`Failed to send print job: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        console.error('Print job submission error:', error);
        notification.error(`Failed to send print job: ${error.message}`);
      }
    }
  };

  const handleClosePrintDialog = () => {
    setShowPrintConfirmDialog(false);
    setSelectedItemForPrint(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="text-center bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.2'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3Ccircle cx='53' cy='7' r='1'/%3E%3Ccircle cx='7' cy='53' r='1'/%3E%3Ccircle cx='53' cy='53' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>
      
      <div className="relative z-10 p-4 space-y-6 pb-40">
        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center space-x-3 bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-lg border border-white/20">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Inventory
              </h1>
              <p className="text-gray-500 text-sm">{filteredItems.length} items found</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-white/20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search items, locations, vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-14 h-12 bg-white/70 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 h-8 w-8 rounded-lg transition-all duration-200 ${
                showFilters 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20 animate-fade-in-up">
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Filter className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Filters</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">All Locations</option>
                  {Array.from(new Set(items.map(item => getLocationName(item.location)))).map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Item Type</label>
                <select
                  value={filters.itemType}
                  onChange={(e) => setFilters(prev => ({ ...prev, itemType: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">All Types</option>
                  {Array.from(new Set(items.map(item => getItemTypeName(item.item_type)))).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl">
                <input
                  type="checkbox"
                  id="lowStock"
                  checked={filters.lowStock}
                  onChange={(e) => setFilters(prev => ({ ...prev, lowStock: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="lowStock" className="text-sm font-medium text-gray-700">
                  Show only low stock items
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const stockStatus = getStockStatus(item);
            const expiringSoon = isExpiringSoon(item.expiry_date);
            const StockIcon = stockStatus.icon;
            
            return (
              <div key={item.id} className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                    </div>
                  </div>
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${stockStatus.bg} ${stockStatus.color} border border-white/20`}>
                    <div className={`w-2 h-2 ${stockStatus.dotColor} rounded-full mr-2`}></div>
                    {stockStatus.status}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <StockIcon className={`w-4 h-4 ${stockStatus.color}`} />
                      <span className="font-semibold text-gray-800">Quantity: {item.quantity}</span>
                    </div>
                    {item.min_quantity && (
                      <span className="text-sm text-gray-500 font-medium">
                        Min: {item.min_quantity}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-gray-700">{getLocationName(item.location)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 rounded-full">
                      <span className="text-xs font-semibold text-purple-800">
                        {getItemTypeName(item.item_type)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 font-medium">
                      {getVendorName(item.vendor)}
                    </span>
                  </div>

                  {/* Fund Information */}
                  {item.fund_name && (
                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700 font-medium">
                        Fund: {item.fund_name}
                      </span>
                    </div>
                  )}
                  
                  {item.expiry_date && (
                    <div className={`flex items-center space-x-2 p-3 rounded-xl ${
                      expiringSoon 
                        ? 'bg-gradient-to-r from-orange-50 to-red-50' 
                        : 'bg-gradient-to-r from-gray-50 to-slate-50'
                    }`}>
                      <Calendar className={`w-4 h-4 ${expiringSoon ? 'text-orange-600' : 'text-gray-600'}`} />
                      <span className={`font-medium ${expiringSoon ? 'text-orange-700' : 'text-gray-700'}`}>
                        Expires: {new Date(item.expiry_date).toLocaleDateString()}
                        {expiringSoon && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-bold rounded-full">
                            SOON
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  
                  {item.barcode && (
                    <div 
                      className="flex items-center space-x-2 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl cursor-pointer hover:from-indigo-100 hover:to-blue-100 transition-all duration-200 active:scale-95"
                      onClick={() => handleBarcodeClick(item)}
                    >
                      <Scan className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm text-indigo-700 font-mono">
                        {item.barcode}
                      </span>
                      <div className="ml-auto">
                        <Printer className="w-4 h-4 text-indigo-600" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-12 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
            <div className="w-20 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-2">No items found</h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search or filters
            </p>
            <Button
              onClick={() => {
                setSearchTerm('');
                setFilters({ location: '', itemType: '', vendor: '', lowStock: false });
                setShowFilters(false);
              }}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Clear Filters
            </Button>
          </div>
        )}

        {/* Speed Dial FAB */}
        <SpeedDialFab
          onAddItem={handleAddItem}
          onScanCheckout={handleScanCheckout}
        />

        {/* Modals */}
        <MobileItemFormModal
          isOpen={isItemFormModalOpen}
          onClose={() => setIsItemFormModalOpen(false)}
          onSave={handleItemSaved}
          token={token}
        />

        {/* ZBar WASM Scanner */}
        <ZBarBarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
          onConfirm={handleBarcodeConfirmed}
          title="ZBar WASM Scanner"
          token={token}
        />

        {/* Barcode Print Confirmation Dialog - Now uses centralized printing */}
        <MobileBarcodeConfirmDialog
          isOpen={showPrintConfirmDialog}
          onClose={handleClosePrintDialog}
          onConfirm={handlePrintConfirm}
          itemName={selectedItemForPrint?.name || ''}
          barcode={selectedItemForPrint?.barcode || ''}
        />
      </div>
    </div>
  );
};

export default MobileInventoryListPage;