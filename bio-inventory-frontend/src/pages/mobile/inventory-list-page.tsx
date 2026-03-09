import { useState, useEffect, useContext, useMemo } from 'react';
import { Input } from '../../components/ui/input.tsx';
import { Button } from '../../components/ui/button.tsx';
import {
  Search,
  Filter,
  Package,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Scan,
  DollarSign,
  Printer,
  ChevronDown
} from 'lucide-react';
import SpeedDialFab from '../../components/mobile/speed-dial-fab.tsx';
import { AuthContext } from '../../components/AuthContext.tsx';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api.ts';
import MobileItemFormModal from '../../modals/MobileItemFormModal.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';
import ZBarBarcodeScanner from '../../components/ZBarBarcodeScanner.tsx';
import MobileBarcodeConfirmDialog from '../../components/mobile/MobileBarcodeConfirmDialog.tsx';
import { printingService } from '../../services/printingService.ts';
import { normalizeInventoryItem, type MobileInventoryItem } from '../../utils/mobileInventoryFields.ts';
import {
  buildMobileInventoryGroups,
  getNamedValueName,
  type MobileInventoryGroup,
  type InventoryGroupStockLevel
} from '../../utils/mobileInventoryGrouping.ts';

type InventoryItem = MobileInventoryItem;

const formatQuantity = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded}`;
  }

  return `${rounded}`.replace(/\.?0+$/, '');
};

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
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
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

  const getStockStatusFromLevel = (level: InventoryGroupStockLevel) => {
    if (level === 'out') {
      return {
        status: 'Out of Stock',
        color: 'text-red-600',
        bg: 'bg-gradient-to-r from-red-100 to-red-200',
        icon: AlertTriangle,
        dotColor: 'bg-red-500'
      };
    }

    if (level === 'low') {
      return {
        status: 'Low Stock',
        color: 'text-orange-600',
        bg: 'bg-gradient-to-r from-orange-100 to-orange-200',
        icon: AlertTriangle,
        dotColor: 'bg-orange-500'
      };
    }

    return {
      status: 'In Stock',
      color: 'text-green-600',
      bg: 'bg-gradient-to-r from-green-100 to-green-200',
      icon: CheckCircle,
      dotColor: 'bg-green-500'
    };
  };

  const getGroupStockStatus = (group: MobileInventoryGroup) => {
    return getStockStatusFromLevel(group.stockLevel);
  };

  useEffect(() => {
    const fetchItems = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(buildApiUrl(API_ENDPOINTS.ITEMS), {
          headers: { Authorization: `Token ${token}` }
        });

        if (response.ok) {
          const data: unknown = await response.json();
          const rawItems = Array.isArray(data)
            ? data
            : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
              ? (data as { results: unknown[] }).results
              : [];

          const normalizedItems = rawItems
            .map(normalizeInventoryItem)
            .filter((item): item is InventoryItem => item !== null);

          setItems(normalizedItems);
          setFilteredItems(normalizedItems);
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

    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getNamedValueName(item.location).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getNamedValueName(item.vendor).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.location) {
      filtered = filtered.filter((item) => getNamedValueName(item.location) === filters.location);
    }
    if (filters.itemType) {
      filtered = filtered.filter((item) => getNamedValueName(item.item_type) === filters.itemType);
    }
    if (filters.vendor) {
      filtered = filtered.filter((item) => getNamedValueName(item.vendor) === filters.vendor);
    }

    setFilteredItems(filtered);
  }, [items, searchTerm, filters]);

  const groupedItems = useMemo(() => {
    return buildMobileInventoryGroups(filteredItems);
  }, [filteredItems]);

  const visibleGroups = useMemo(() => {
    if (!filters.lowStock) {
      return groupedItems;
    }
    return groupedItems.filter((group) => group.stockLevel !== 'in');
  }, [filters.lowStock, groupedItems]);

  useEffect(() => {
    setExpandedGroupIds((previous) => {
      const validIds = new Set(visibleGroups.map((group) => group.id));
      let changed = false;
      const next = new Set<string>();

      previous.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [visibleGroups]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleAddItem = () => {
    setIsItemFormModalOpen(true);
  };

  const handleItemSaved = () => {
    setIsItemFormModalOpen(false);
    setRefreshKey((previous) => previous + 1);
    notification.success('Item added successfully!');
  };

  const handleScanConsume = () => {
    setShowBarcodeScanner(true);
  };

  const handleBarcodeScanned = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
  };

  const handleBarcodeConfirmed = async (barcode: string, itemData?: any) => {
    try {
      const consumeData = {
        barcode: barcode,
        notes: `Mobile consume via labeled item scan: ${barcode}`
      };

      const response = await fetch(buildApiUrl('/api/items/consume_by_barcode/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`
        },
        body: JSON.stringify(consumeData)
      });

      if (response.ok) {
        const result = await response.json();
        notification.success(`Successfully consumed: ${result.item?.name || itemData?.name || 'Item'}`);
        setRefreshKey((previous) => previous + 1);
        setShowBarcodeScanner(false);
      } else {
        const errorData = await response.json();
        notification.error(`Consume failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Barcode consume error:', error);
      notification.error(`Failed to consume item: ${error.message}`);
    }
  };

  const handleRequestMore = () => {
    window.history.pushState(null, '', '/requests');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const performInventoryAction = async (endpoint: string, successMessage: string) => {
    try {
      const response = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Inventory action failed');
      }

      notification.success(successMessage);
      setRefreshKey((previous) => previous + 1);
    } catch (actionError: any) {
      notification.error(actionError.message || 'Inventory action failed');
    }
  };

  const handleSubtractPack = (record: InventoryItem) => {
    performInventoryAction(`/api/items/${record.id}/subtract_pack/`, `Subtracted one pack from ${record.name}`);
  };

  const handleMarkOpen = (record: InventoryItem) => {
    performInventoryAction(`/api/items/${record.id}/mark_open/`, `Marked one pack open for ${record.name}`);
  };

  const handleBarcodeClick = (item: InventoryItem) => {
    if (item.barcode) {
      setSelectedItemForPrint(item);
      setShowPrintConfirmDialog(true);
    }
  };

  const handlePrintConfirm = async (printMode: 'tape' | 'label') => {
    if (selectedItemForPrint) {
      try {
        setShowPrintConfirmDialog(false);

        const result = await printingService.queuePrintJob({
          label_data: {
            itemName: selectedItemForPrint.name,
            barcode: selectedItemForPrint.barcode || '',
            customText: selectedItemForPrint.name,
            fontSize: 8,
            isBold: false,
            printMode
          },
          priority: 'normal'
        });

        notification.success(`Print job sent to server successfully! Job ID: ${result.id || 'N/A'}`);
        setSelectedItemForPrint(null);
      } catch (error: any) {
        console.error('Print job submission error:', error);
        notification.error(`Failed to send print job: ${error.message || 'Unknown error'}`);
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
            <div
              className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin mx-auto"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            ></div>
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
      <div className="absolute inset-0 opacity-40">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.2'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3Ccircle cx='53' cy='7' r='1'/%3E%3Ccircle cx='7' cy='53' r='1'/%3E%3Ccircle cx='53' cy='53' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
          }}
        ></div>
      </div>

      <div className="relative z-10 p-4 space-y-6 pb-40">
        <div className="text-center py-4">
          <div className="inline-flex items-center space-x-3 bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-lg border border-white/20">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Inventory
              </h1>
              <p className="text-gray-500 text-sm">{visibleGroups.length} item groups in active inventory</p>
            </div>
          </div>
        </div>

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
                showFilters ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

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
                  onChange={(e) => setFilters((previous) => ({ ...previous, location: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">All Locations</option>
                  {Array.from(new Set(items.map((item) => getNamedValueName(item.location)))).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Item Type</label>
                <select
                  value={filters.itemType}
                  onChange={(e) => setFilters((previous) => ({ ...previous, itemType: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">All Types</option>
                  {Array.from(new Set(items.map((item) => getNamedValueName(item.item_type)))).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl">
                <input
                  type="checkbox"
                  id="lowStock"
                  checked={filters.lowStock}
                  onChange={(e) => setFilters((previous) => ({ ...previous, lowStock: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="lowStock" className="text-sm font-medium text-gray-700">
                  Show only low stock items
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {visibleGroups.map((group) => {
            const stockStatus = getGroupStockStatus(group);
            const StockIcon = stockStatus.icon;
            const isExpanded = expandedGroupIds.has(group.id);

            return (
              <div
                key={group.id}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300"
              >
                <button type="button" onClick={() => toggleGroup(group.id)} className="w-full text-left">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg">{group.name}</h3>
                          {group.catalogNumber && (
                            <p className="text-xs text-gray-500 font-mono mt-1">Catalog: {group.catalogNumber}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      <div
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${stockStatus.bg} ${stockStatus.color} border border-white/20`}
                      >
                        <div className={`w-2 h-2 ${stockStatus.dotColor} rounded-full mr-2`}></div>
                        {stockStatus.status}
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl">
                      <div className="flex items-center space-x-2">
                        <StockIcon className={`w-4 h-4 ${stockStatus.color}`} />
                        <span className="font-semibold text-gray-800">Total Quantity: {formatQuantity(group.totalQuantity)}</span>
                      </div>
                      <span className="text-sm text-gray-500 font-medium">
                        {group.records.length} tracked record{group.records.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-gray-700">{group.locationSummary}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 rounded-full">
                        <span className="text-xs font-semibold text-purple-800">{group.itemTypeName}</span>
                      </div>
                      <span className="text-sm text-gray-500 font-medium">{group.vendorName}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="inline-flex items-center px-3 py-1.5 bg-white rounded-full border border-blue-100 text-xs font-semibold text-slate-700">
                        {group.trackingSummary}
                      </div>
                      {group.openUnitCount > 0 && (
                        <div className="inline-flex items-center px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200 text-xs font-semibold text-amber-700">
                          {group.openUnitCount} open
                        </div>
                      )}
                      <div className="inline-flex items-center px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200 text-xs font-semibold text-slate-600">
                        {group.requestStateLabel}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.records[0]?.tracking_mode === 'pack_managed' && (
                        <>
                          <Button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSubtractPack(group.records[0]);
                            }}
                            className="h-9 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600"
                          >
                            -1 Box
                          </Button>
                          <Button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleMarkOpen(group.records[0]);
                            }}
                            className="h-9 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900"
                          >
                            Mark Open
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRequestMore();
                        }}
                        className="h-9 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Request More
                      </Button>
                    </div>

                    {group.fundSummary && (
                      <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-700 font-medium">Fund: {group.fundSummary}</span>
                      </div>
                    )}

                    {group.expiringSoonCount > 0 && (
                      <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                        <Calendar className="w-4 h-4 text-orange-600" />
                        <span className="font-medium text-orange-700">
                          {group.expiringSoonCount} expiring soon
                          {group.expiringSoonCount > 1 ? ' records' : ' record'}
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-blue-100 space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Instance details</p>
                    {group.records.map((record) => {
                      const recordExpiringSoon = record.expiry_date
                        ? new Date(record.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        : false;

                      return (
                        <div key={record.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                          <div className="flex items-center">
                            <div className="flex items-center space-x-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold text-gray-800">
                                Quantity: {formatQuantity(record.quantity)}
                                {record.unit ? ` ${record.unit}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 text-sm text-gray-700">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span>{getNamedValueName(record.location)}</span>
                          </div>

                          {record.expiry_date && (
                            <div
                              className={`flex items-center space-x-2 p-2 rounded-lg ${
                                recordExpiringSoon ? 'bg-orange-50' : 'bg-gray-50'
                              }`}
                            >
                              <Calendar className={`w-4 h-4 ${recordExpiringSoon ? 'text-orange-600' : 'text-gray-600'}`} />
                              <span className={`text-sm ${recordExpiringSoon ? 'text-orange-700' : 'text-gray-700'}`}>
                                Expires: {new Date(record.expiry_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {record.barcode ? (
                            record.can_scan_consume ? (
                              <button
                                type="button"
                                className="w-full flex items-center space-x-2 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl cursor-pointer hover:from-indigo-100 hover:to-blue-100 transition-all duration-200 active:scale-[0.99]"
                                onClick={() => handleBarcodeClick(record)}
                              >
                                <Scan className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm text-indigo-700 font-mono">{record.barcode}</span>
                                <div className="ml-auto">
                                  <Printer className="w-4 h-4 text-indigo-600" />
                                </div>
                              </button>
                            ) : (
                              <div className="p-3 rounded-xl bg-gray-50 text-sm text-gray-500">Instance tracked without physical barcode</div>
                            )
                          ) : (
                            <div className="p-3 rounded-xl bg-gray-50 text-sm text-gray-500">No barcode</div>
                          )}

                          {record.tracking_mode === 'pack_managed' && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                onClick={() => handleSubtractPack(record)}
                                className="h-9 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600"
                              >
                                -1 Box
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleMarkOpen(record)}
                                className="h-9 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900"
                              >
                                Mark Open
                              </Button>
                              <Button
                                type="button"
                                onClick={handleRequestMore}
                                className="h-9 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                              >
                                Need Reorder
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visibleGroups.length === 0 && !loading && (
          <div className="text-center py-12 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
            <div className="w-20 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-2">No items found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filters</p>
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

        <SpeedDialFab onAddItem={handleAddItem} onScanConsume={handleScanConsume} />

        <MobileItemFormModal
          isOpen={isItemFormModalOpen}
          onClose={() => setIsItemFormModalOpen(false)}
          onSave={handleItemSaved}
          token={token}
        />

        <ZBarBarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
          onConfirm={handleBarcodeConfirmed}
          title="Scan Labeled Item"
          token={token}
        />

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
