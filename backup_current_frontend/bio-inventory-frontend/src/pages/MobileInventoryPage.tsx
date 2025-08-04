import React, { useState, useEffect } from 'react';
import { useDevice } from '../hooks/useDevice';
import { useMobileErrorHandler, useMobileLoadingState } from '../hooks/useMobileErrorHandler';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { validateFilterOptions, safeApiCall, safeArrayMap, formatErrorMessage } from '../utils/dataValidation';
import { useNotification } from '../contexts/NotificationContext';
import MobileHeader from '../components/mobile/MobileHeader';
import MobileInventoryCard from '../components/mobile/MobileInventoryCard';
import { InventoryFAB } from '../components/mobile/MobileFloatingActionButton';
import { InventoryStatsCards } from '../components/mobile/MobileStatsCards';
import MobileFilterDrawer from '../components/mobile/MobileFilterDrawer';
import MobileBarcodeScanner from '../components/mobile/MobileBarcodeScanner';

interface InventoryItem {
  id: number;
  name: string;
  vendor: string;
  location: string;
  quantity: number;
  unit: string;
  expiration_date?: string;
  status: string;
  low_stock_threshold?: number;
  item_type: string;
  cost?: number;
}

interface MobileInventoryPageProps {
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  refreshKey: number;
  filters: any;
  onAddItemClick: () => void;
  onAddRequestClick?: () => void;
  onMenuToggle: () => void;
  onFilterChange?: (key: string, value: any) => void;
  onClearAllFilters?: () => void;
  onSearchChange?: (value: string) => void;
  token: string;
}

const MobileInventoryPage: React.FC<MobileInventoryPageProps> = ({
  onEditItem,
  onDeleteItem,
  refreshKey,
  filters,
  onAddItemClick,
  onAddRequestClick,
  onMenuToggle,
  onFilterChange,
  onClearAllFilters,
  onSearchChange,
  token
}) => {
  const device = useDevice();
  const notification = useNotification();
  const errorHandler = useMobileErrorHandler({
    maxRetries: 3,
    onError: (error) => console.error('Mobile Inventory Error:', error),
    onRetry: () => console.log('Retrying inventory data fetch...')
  });
  const loadingState = useMobileLoadingState();
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isBarcodePickerOpen, setIsBarcodePickerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    expiringSoon: 0,
    totalValue: '$0'
  });

  const [filterOptions, setFilterOptions] = useState({
    vendors: [],
    locations: [],
    itemTypes: []
  });

  const filterSections = [
    {
      key: 'location',
      label: 'Location',
      type: 'multiselect' as const,
      options: validateFilterOptions(filterOptions.locations),
      value: filters.location
    },
    {
      key: 'item_type',
      label: 'Type',
      type: 'multiselect' as const,
      options: validateFilterOptions(filterOptions.itemTypes),
      value: filters.item_type
    },
    {
      key: 'vendor',
      label: 'Vendor',
      type: 'multiselect' as const,
      options: validateFilterOptions(filterOptions.vendors),
      value: filters.vendor
    },
    {
      key: 'expired',
      label: 'Status',
      type: 'toggle' as const,
      options: [
        { label: 'Show expired items', value: 'true' },
        { label: 'Show low stock items', value: 'low_stock' }
      ],
      value: filters.expired
    }
  ];

  const fetchInventory = async () => {
    if (!token) return;
    
    loadingState.setLoading('inventory', true);
    errorHandler.clearError();
    
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.location?.length) {
        filters.location.forEach((loc: string) => params.append('location', loc));
      }
      if (filters.item_type?.length) {
        filters.item_type.forEach((type: string) => params.append('item_type', type));
      }
      if (filters.vendor?.length) {
        filters.vendor.forEach((vendor: string) => params.append('vendor', vendor));
      }
      if (filters.expired?.length) {
        filters.expired.forEach((exp: string) => params.append('expired', exp));
      }

      const result = await safeApiCall<InventoryItem[]>(
        buildApiUrl(`${API_ENDPOINTS.ITEMS}?${params.toString()}`),
        { headers: { 'Authorization': `Token ${token}` } }
      );
      
      if (result.success && result.data) {
        const data = result.data;
        setItems(data);
        
        // Calculate stats with safe array operations
        const totalItems = data.length;
        const lowStockItems = safeArrayMap(data, (item: InventoryItem) => 
          item.low_stock_threshold && item.quantity <= item.low_stock_threshold ? item : null
        ).filter(Boolean).length;
        
        const expiringSoon = safeArrayMap(data, (item: InventoryItem) => {
          if (!item.expiration_date) return null;
          const expDate = new Date(item.expiration_date);
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          return expDate <= thirtyDaysFromNow ? item : null;
        }).filter(Boolean).length;
        
        const totalValue = safeArrayMap(data, (item: InventoryItem) => 
          (item.cost || 0) * item.quantity
        ).reduce((sum: number, value: number) => sum + value, 0);
        
        setStats({
          totalItems,
          lowStockItems,
          expiringSoon,
          totalValue: `$${totalValue.toLocaleString()}`
        });
      } else {
        errorHandler.handleError(result.error || 'Failed to fetch inventory data', 'FETCH_INVENTORY');
      }
    } catch (error) {
      errorHandler.handleError(error, 'FETCH_INVENTORY_EXCEPTION');
    } finally {
      loadingState.setLoading('inventory', false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [refreshKey, filters, token]);

  // Fetch filter options with enhanced error handling
  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!token) return;
      
      loadingState.setLoading('filterOptions', true);
      
      try {
        const headers = { 'Authorization': `Token ${token}` };
        
        // Use safe API calls
        const [vendorsResult, locationsResult, itemTypesResult] = await Promise.all([
          safeApiCall(buildApiUrl(API_ENDPOINTS.VENDORS), { headers }),
          safeApiCall(buildApiUrl(API_ENDPOINTS.LOCATIONS), { headers }),
          safeApiCall(buildApiUrl(API_ENDPOINTS.ITEM_TYPES), { headers })
        ]);
        
        // Validate and standardize data
        const vendors = vendorsResult.success ? validateFilterOptions(vendorsResult.data || []) : [];
        const locations = locationsResult.success ? validateFilterOptions(locationsResult.data || []) : [];
        const itemTypes = itemTypesResult.success ? validateFilterOptions(itemTypesResult.data || []) : [];
        
        setFilterOptions({
          vendors,
          locations,
          itemTypes
        });
        
        // Log any failed API calls
        if (!vendorsResult.success) console.warn('Failed to fetch vendors:', vendorsResult.error);
        if (!locationsResult.success) console.warn('Failed to fetch locations:', locationsResult.error);
        if (!itemTypesResult.success) console.warn('Failed to fetch item types:', itemTypesResult.error);
        
      } catch (error) {
        console.error('Failed to fetch filter options:', formatErrorMessage(error));
        errorHandler.handleError(error, 'FETCH_FILTER_OPTIONS');
      } finally {
        loadingState.setLoading('filterOptions', false);
      }
    };
    
    fetchFilterOptions();
  }, [token]);

  const handleFilterChange = (key: string, value: any) => {
    // Connect to parent component's filter state through props
    if (typeof onFilterChange === 'function') {
      onFilterChange(key, value);
    }
  };

  const handleClearFilters = () => {
    // Clear all filters through parent component
    if (typeof onClearAllFilters === 'function') {
      onClearAllFilters();
    }
  };

  const handleLowStockClick = () => {
    // Filter to show only low stock items
    handleFilterChange('low_stock', ['true']);
  };

  const handleExpiringClick = () => {
    // Filter to show only expiring items
    handleFilterChange('expired', ['true']);
  };

  // Debounced search function
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    
    // Clear previous timeout
    if ((window as any).searchTimeout) {
      clearTimeout((window as any).searchTimeout);
    }
    
    // Set new timeout for debounced search
    (window as any).searchTimeout = setTimeout(() => {
      if (typeof onSearchChange === 'function') {
        onSearchChange(value);
      }
    }, 300);
  };

  // Barcode checkout functionality
  const handleBarcodeCheckout = () => {
    setIsBarcodePickerOpen(true);
  };

  const processBarcode = async (barcode: string) => {
    try {
      loadingState.setLoading('checkout', true);
      
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
        notification.success(`Successfully checked out item: ${result.item_name || 'Unknown item'}`);
        
        // Refresh inventory data
        fetchInventory();
      } else {
        const errorData = await response.json();
        notification.error(`Checkout failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Barcode checkout error:', error);
      notification.error(`Failed to checkout item: ${error.message}`);
    } finally {
      loadingState.setLoading('checkout', false);
    }
  };

  if (!device.isMobile) {
    return null; // This component is only for mobile
  }

  // Show error state if there's an error
  if (errorHandler.hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Inventory</h2>
          <p className="text-gray-600 mb-6 text-sm">{errorHandler.error}</p>
          <div className="space-y-3">
            {errorHandler.canRetry && (
              <button
                onClick={() => {
                  errorHandler.retry();
                  fetchInventory();
                }}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors touch-manipulation text-sm min-h-[44px]"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors touch-manipulation text-sm min-h-[44px]"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Inventory"
        showSearch={true}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        showFilter={true}
        onFilterClick={() => setIsFilterDrawerOpen(true)}
        showMenuToggle={true}
        onMenuToggle={onMenuToggle}
        notificationCount={stats.lowStockItems + stats.expiringSoon}
      />

      {/* Stats Cards */}
      <InventoryStatsCards
        totalItems={stats.totalItems}
        lowStockItems={stats.lowStockItems}
        expiringSoon={stats.expiringSoon}
        totalValue={stats.totalValue}
        onLowStockClick={handleLowStockClick}
        onExpiringClick={handleExpiringClick}
      />

      {/* Items List */}
      <div className="px-4 pb-4">
        {loadingState.isLoading('inventory') || loadingState.isLoading('checkout') ? (
          <div className="space-y-3">
            {loadingState.isLoading('checkout') && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="text-primary-700 font-medium">Processing checkout...</span>
                </div>
              </div>
            )}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg h-32 animate-pulse"></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No inventory items</div>
            <p className="text-gray-500 text-sm">Tap the button below to add inventory items</p>
          </div>
        ) : (
          <div className="space-y-0">
            {items.map((item) => (
              <MobileInventoryCard
                key={item.id}
                item={item}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <InventoryFAB
        onAddItem={onAddItemClick}
        onScanBarcode={() => {
          // Open barcode scanner for checkout
          handleBarcodeCheckout();
        }}
      />

      {/* Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Filter Inventory"
        filters={filterSections}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearFilters}
      />

      {/* Barcode Scanner */}
      <MobileBarcodeScanner
        isOpen={isBarcodePickerOpen}
        onClose={() => setIsBarcodePickerOpen(false)}
        onScan={() => {}} // This is called when barcode is detected but before confirmation
        onConfirm={processBarcode} // This is called when user confirms checkout
        title="Scan for Checkout"
        token={token}
      />
    </div>
  );
};

export default MobileInventoryPage;