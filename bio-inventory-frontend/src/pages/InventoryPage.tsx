import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Filter,
  Package,
  QrCode,
  Search,
  Sparkles,
  Warehouse,
} from 'lucide-react';

import { AuthContext } from '../components/AuthContext.tsx';
import InventoryDetailDrawer from '../components/InventoryDetailDrawer.tsx';
import InventoryTable from '../components/InventoryTable.tsx';
import Pagination from '../components/Pagination.tsx';
import BarcodeScanner from '../components/BarcodeScanner.tsx';
import PrintBarcodeModal from '../components/PrintBarcodeModal.tsx';
import ItemRequestHistoryModal from '../modals/ItemRequestHistoryModal.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { exportToExcel } from '../utils/excelExport.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

const itemsPerPage = 10;
const defaultVisibleColumns = {
  inStock: true,
  primaryLocation: true,
  lotExpiration: true,
  lastUsed: true,
  tracking: true,
  requestState: true,
};
const toolbarButtonClass = 'inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900';
const toolbarPrimaryButtonClass = 'inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800';

const formatQuantity = (value) => {
  const numeric = parseFloat(value || 0);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(2).replace(/\.?0+$/, '');
};

const ToolbarPopover = ({ anchorRef, isOpen, onClose, widthClass = 'w-64', children }) => {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      return undefined;
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setPosition({
        top: rect.bottom + 10,
        right: Math.max(window.innerWidth - rect.right, 16),
      });
    };

    const handlePointerDown = (event) => {
      if (anchorRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) {
        return;
      }
      onClose?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen || !position || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-40 ${widthClass} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_60px_-24px_rgba(15,23,42,0.42)]`}
      style={{ top: position.top, right: position.right, maxHeight: 'min(70vh, 560px)' }}
    >
      {children}
    </div>,
    document.body,
  );
};

const buildGroupEditItem = (group) => {
  const allocationMap = new Map();

  group.instances.forEach((instance) => {
    const summaries = Array.isArray(instance.location_summary) && instance.location_summary.length > 0
      ? instance.location_summary
      : [{
          location_id: instance.primary_location?.id || instance.location?.id,
          location_name: instance.primary_location?.name || instance.location?.name,
          full_path: instance.primary_location?.full_path || instance.location?.full_path || instance.location?.name || 'N/A',
          quantity: instance.quantity,
          note: '',
        }];

    summaries.forEach((summary) => {
      if (!summary.location_id) {
        return;
      }
      const key = String(summary.location_id);
      const existing = allocationMap.get(key);
      const quantity = parseFloat(summary.quantity) || 0;
      if (existing) {
        existing.quantity = (parseFloat(existing.quantity) + quantity).toFixed(2);
        if (summary.note && !existing.note.includes(summary.note)) {
          existing.note = existing.note ? `${existing.note}; ${summary.note}` : summary.note;
        }
      } else {
        allocationMap.set(key, {
          location_id: summary.location_id,
          location: {
            id: summary.location_id,
            name: summary.location_name,
            full_path: summary.full_path,
          },
          quantity: quantity.toFixed(2),
          note: summary.note || '',
        });
      }
    });
  });

  const primaryInstance = group.instances[0];
  return {
    ...primaryInstance,
    quantity: group.totalQuantity.toFixed(2),
    group_item_ids: group.instances.map((instance) => instance.id),
    is_group_edit: group.instances.length > 1,
    tracking_mode: primaryInstance.resolved_tracking_mode || primaryInstance.tracking_mode || '',
    label_mode: primaryInstance.resolved_label_mode || primaryInstance.label_mode || '',
    location_allocations: Array.from(allocationMap.values()),
    location_summary: Array.from(allocationMap.values()).map((allocation) => ({
      location_id: allocation.location_id,
      location_name: allocation.location.name,
      full_path: allocation.location.full_path,
      quantity: allocation.quantity,
      note: allocation.note,
    })),
    primary_location: Array.from(allocationMap.values())[0]?.location || primaryInstance.primary_location || primaryInstance.location,
    properties: {
      ...(primaryInstance.properties || {}),
      open_unit_count: group.openUnitCount,
    },
  };
};

const getStatusPriority = (requestState) => {
  switch (requestState) {
    case 'ORDERED':
      return 4;
    case 'APPROVED':
      return 3;
    case 'NEW':
      return 2;
    case 'LOW_STOCK':
      return 1;
    default:
      return 0;
  }
};

const InventoryPage = ({
  onEditItem,
  onDeleteItem,
  onAddItemClick,
  onRequestMoreItem,
  refreshKey,
  filters,
  filterOptions,
  onFilterChange,
}) => {
  const { token } = useContext(AuthContext);
  const notification = useNotification();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [savedView, setSavedView] = useState('all');
  const [activeTaskChip, setActiveTaskChip] = useState('all');
  const [selectedPrintItem, setSelectedPrintItem] = useState(null);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);
  const columnsButtonRef = useRef(null);
  const advancedFiltersButtonRef = useRef(null);

  const fetchInventory = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    Object.keys(filters).forEach((key) => {
      if (key !== 'search' && filters[key]?.length > 0) {
        if (key === 'expired' || key === 'low_stock') {
          if (filters[key].includes('true')) {
            params.append(key, 'true');
          }
        } else {
          filters[key].forEach((value) => params.append(key, value));
        }
      }
    });

    try {
      const response = await fetch(`${buildApiUrl(API_ENDPOINTS.ITEMS)}?${params.toString()}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!response.ok) {
        let detail = '';
        try {
          const payload = await response.json();
          detail = payload?.detail || payload?.error || '';
        } catch {
          // ignore parse errors
        }
        throw new Error(`Inventory API failed (${response.status})${detail ? `: ${detail}` : ''}`);
      }
      const data = await response.json();
      setInventory(Array.isArray(data) ? data : data.results || []);
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory, refreshKey, localRefreshKey]);

  const groupedInventory = useMemo(() => {
    const groups = inventory.reduce((acc, item) => {
      const groupId = `${item.name}-${item.vendor?.id || item.vendor?.name || 'vendor'}-${item.catalog_number || 'catalog'}`;
      if (!acc[groupId]) {
        acc[groupId] = {
          id: groupId,
          name: item.name,
          vendor: item.vendor,
          catalog_number: item.catalog_number,
          item_type: item.item_type,
          totalQuantity: 0,
          instances: [],
          labeledCount: 0,
          openUnitCount: 0,
          hasPackManaged: false,
          hasLowStock: false,
          hasExpired: false,
          hasExpiringSoon: false,
          requestState: 'NONE',
          requestStateLabel: 'No action',
          requestStateCount: 0,
          needsPutAway: false,
        };
      }
      const group = acc[groupId];
      group.instances.push(item);
      group.totalQuantity += parseFloat(item.quantity || 0);
      group.labeledCount += item.can_scan_consume ? 1 : 0;
      group.openUnitCount += parseInt(item.open_unit_count || 0, 10) || 0;
      group.hasPackManaged = group.hasPackManaged || item.resolved_tracking_mode === 'pack_managed';
      group.hasLowStock = group.hasLowStock || item.is_low_stock;
      group.hasExpired = group.hasExpired || item.expiration_status === 'EXPIRED';
      group.hasExpiringSoon = group.hasExpiringSoon || item.expiration_status === 'EXPIRING_SOON';
      group.needsPutAway = group.needsPutAway || !(
        item.primary_location?.id ||
        item.location?.id ||
        (Array.isArray(item.location_summary) && item.location_summary.some((summary) => summary.location_id))
      );

      if (getStatusPriority(item.request_state) > getStatusPriority(group.requestState)) {
        group.requestState = item.request_state;
        group.requestStateLabel = item.request_state_label;
      }
      group.requestStateCount = Math.max(group.requestStateCount, item.request_state_count || 0);
      return acc;
    }, {});

    return Object.values(groups).map((group) => {
      const instances = [...group.instances].sort((left, right) => {
        const leftDate = left.expiration_date ? new Date(left.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.expiration_date ? new Date(right.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      });
      const uniqueLocations = Array.from(new Set(instances.map((instance) => (
        instance.primary_location?.full_path ||
        instance.location?.full_path ||
        instance.location?.name ||
        'Unassigned'
      ))));
      const uniqueLots = Array.from(new Set(instances.map((instance) => instance.lot_number).filter(Boolean)));
      const expirationDates = instances.map((instance) => instance.expiration_date).filter(Boolean).sort();
      const latestReceivedDate = instances
        .map((instance) => instance.received_date || instance.created_at)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;
      const latestLastUsedDate = instances
        .map((instance) => instance.last_used_date)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;

      let trackingSummary = 'Instance tracked';
      if (group.hasPackManaged && group.labeledCount === 0) {
        trackingSummary = 'Pack-managed';
      } else if (group.hasPackManaged && group.labeledCount > 0) {
        trackingSummary = 'Mixed tracking';
      } else if (group.labeledCount > 0) {
        trackingSummary = 'Labeled instances';
      }

      const instanceSummaryParts = [`${instances.length} instance${instances.length !== 1 ? 's' : ''}`];
      if (group.openUnitCount > 0) {
        instanceSummaryParts.push(`${group.openUnitCount} open`);
      }
      if (uniqueLocations.length > 1) {
        instanceSummaryParts.push(`${uniqueLocations.length} locations`);
      }

      const baseQuantity = `${formatQuantity(group.totalQuantity)} ${instances[0]?.unit || ''}`.trim();
      const formattedQuantity = group.openUnitCount > 0
        ? `${baseQuantity} • ${group.openUnitCount} open`
        : baseQuantity;

      return {
        ...group,
        instances,
        primaryLocation: uniqueLocations[0] || 'Unassigned',
        locationSummary: uniqueLocations.length === 1 ? uniqueLocations[0] : `${uniqueLocations.length} locations`,
        lotSummary: uniqueLots.length ? uniqueLots.slice(0, 2).join(', ') : 'No lot tracking',
        expirationSummary: expirationDates.length ? `Nearest expiry ${formatDate(expirationDates[0])}` : 'No expiry date',
        formattedQuantity,
        trackingSummary,
        instanceSummary: instanceSummaryParts.join(' • '),
        latestReceivedDate,
        latestLastUsedDate,
        isLastUnit: group.totalQuantity <= 1,
        hasLabeledInstances: group.labeledCount > 0,
        editItem: buildGroupEditItem({ ...group, instances }),
      };
    }).sort((left, right) => left.name.localeCompare(right.name));
  }, [inventory]);

  const savedViews = useMemo(() => ([
    {
      id: 'all',
      label: 'All Inventory',
      predicate: () => true,
    },
    {
      id: 'low_stock',
      label: 'Low Stock',
      predicate: (group) => group.hasLowStock,
    },
    {
      id: 'expiring',
      label: 'Expiring Soon',
      predicate: (group) => group.hasExpired || group.hasExpiringSoon,
    },
    {
      id: 'recent',
      label: 'Recently Received',
      predicate: (group) => group.latestReceivedDate && (Date.now() - new Date(group.latestReceivedDate).getTime()) <= 1000 * 60 * 60 * 24 * 14,
    },
    {
      id: 'cell_culture',
      label: 'Cell Culture Essentials',
      predicate: (group) => {
        const haystack = `${group.name} ${group.locationSummary} ${group.item_type?.name || ''}`.toLowerCase();
        return haystack.includes('cell culture') || haystack.includes('pipette') || haystack.includes('dish') || haystack.includes('media');
      },
    },
  ]), []);

  const taskChips = useMemo(() => ([
    { id: 'all', label: 'All', count: groupedInventory.length, predicate: () => true, icon: Sparkles },
    { id: 'low_stock', label: 'Low Stock', count: groupedInventory.filter((group) => group.hasLowStock).length, predicate: (group) => group.hasLowStock, icon: AlertTriangle },
    { id: 'last_unit', label: 'Last Unit', count: groupedInventory.filter((group) => group.isLastUnit).length, predicate: (group) => group.isLastUnit, icon: Package },
    { id: 'open_box', label: 'Open Box', count: groupedInventory.filter((group) => group.openUnitCount > 0).length, predicate: (group) => group.openUnitCount > 0, icon: Warehouse },
    { id: 'need_put_away', label: 'Need Put-away', count: groupedInventory.filter((group) => group.needsPutAway).length, predicate: (group) => group.needsPutAway, icon: Package },
    { id: 'recently_used', label: 'Recently Used', count: groupedInventory.filter((group) => group.latestLastUsedDate && (Date.now() - new Date(group.latestLastUsedDate).getTime()) <= 1000 * 60 * 60 * 24 * 30).length, predicate: (group) => group.latestLastUsedDate && (Date.now() - new Date(group.latestLastUsedDate).getTime()) <= 1000 * 60 * 60 * 24 * 30, icon: Clock3 },
  ]), [groupedInventory]);

  const activeSavedView = savedViews.find((view) => view.id === savedView) || savedViews[0];
  const activeChip = taskChips.find((chip) => chip.id === activeTaskChip) || taskChips[0];

  const filteredGroups = useMemo(() => (
    groupedInventory
      .filter((group) => activeSavedView.predicate(group))
      .filter((group) => activeChip.predicate(group))
  ), [activeChip, activeSavedView, groupedInventory]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredGroups]);

  useEffect(() => {
    setCurrentPage(1);
  }, [savedView, activeTaskChip, filters]);

  const selectedGroup = useMemo(
    () => groupedInventory.find((group) => group.id === selectedGroupId) || null,
    [groupedInventory, selectedGroupId],
  );

  useEffect(() => {
    if (selectedGroupId && !selectedGroup) {
      setSelectedGroupId(null);
    }
  }, [selectedGroup, selectedGroupId]);

  useEffect(() => {
    if (!showColumnsPanel) {
      return;
    }
    setShowAdvancedFilters(false);
  }, [showColumnsPanel]);

  useEffect(() => {
    if (!showAdvancedFilters) {
      return;
    }
    setShowColumnsPanel(false);
  }, [showAdvancedFilters]);

  const handleViewRequestHistory = (item) => {
    setSelectedHistoryItem(item);
    setIsRequestHistoryOpen(true);
  };

  const exportGroups = useCallback((groupsToExport) => {
    const rows = groupsToExport.flatMap((group) => group.instances.map((item) => ({
      'Item ID': item.id,
      'Item Name': item.name,
      'Quantity': item.quantity,
      'Unit': item.unit || '',
      'Vendor': item.vendor?.name || '',
      'Catalog Number': item.catalog_number || '',
      'Location': item.primary_location?.full_path || item.location?.full_path || item.location?.name || '',
      'Lot Number': item.lot_number || '',
      'Expiration Date': item.expiration_date ? formatDate(item.expiration_date) : '',
      'Last Used': item.last_used_date ? formatDate(item.last_used_date) : '',
      'Tracking': item.tracking_summary || '',
      'Request State': item.request_state_label || '',
    })));

    exportToExcel({
      fileName: 'inventory-export',
      sheetName: 'Inventory',
      title: 'Laboratory Inventory Decision Table Export',
      data: rows,
      summary: {
        'Export Count': rows.length,
        'Group Count': groupsToExport.length,
        'Low Stock Groups': groupsToExport.filter((group) => group.hasLowStock).length,
      },
    });
  }, []);

  const handleBatchAction = async (action, selectedIds) => {
    if (selectedIds.length === 0) return;

    switch (action) {
      case 'export': {
        const selectedItems = inventory.filter((item) => selectedIds.includes(item.id));
        exportGroups(selectedItems.map((item) => ({
          id: `selected-${item.id}`,
          instances: [item],
          hasLowStock: item.is_low_stock,
        })));
        break;
      }
      case 'archive': {
        if (!window.confirm(`Mark ${selectedIds.length} selected record(s) as used?`)) {
          return;
        }
        const response = await fetch(buildApiUrl(API_ENDPOINTS.ITEMS_BATCH_ARCHIVE), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({ item_ids: selectedIds }),
        });
        if (response.ok) {
          notification.success(`Marked ${selectedIds.length} record(s) as used`);
          setLocalRefreshKey((previous) => previous + 1);
        } else {
          notification.error('Failed to update selected records');
        }
        break;
      }
      case 'delete': {
        if (!window.confirm(`Delete ${selectedIds.length} selected record(s)? This cannot be undone.`)) {
          return;
        }
        const response = await fetch(buildApiUrl(API_ENDPOINTS.ITEMS_BATCH_DELETE), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({ item_ids: selectedIds }),
        });
        if (response.ok) {
          notification.success(`Deleted ${selectedIds.length} record(s)`);
          setLocalRefreshKey((previous) => previous + 1);
        } else {
          notification.error('Failed to delete selected records');
        }
        break;
      }
      default:
        break;
    }
  };

  const performItemAction = async (url, successMessage) => {
    try {
      const response = await fetch(buildApiUrl(url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Action failed.');
      }
      notification.success(successMessage);
      setLocalRefreshKey((previous) => previous + 1);
      return payload;
    } catch (actionError) {
      notification.error(actionError.message || 'Action failed.');
      return null;
    }
  };

  const handleConsumeItem = async (item) => {
    if (!item) {
      return;
    }
    const actionLabel = item.can_scan_consume ? 'mark this labeled instance as used' : 'mark this instance as used';
    if (!window.confirm(`Do you want to ${actionLabel}?`)) {
      return;
    }

    if (item.barcode && item.can_scan_consume) {
      await fetch(buildApiUrl('/api/items/consume_by_barcode/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          barcode: item.barcode,
          notes: `Consumed from inventory detail drawer: ${item.barcode}`,
        }),
      }).then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to consume item.');
        }
        notification.success(`Marked ${item.name} as used`);
        setLocalRefreshKey((previous) => previous + 1);
      }).catch((consumeError) => {
        notification.error(consumeError.message || 'Failed to consume item.');
      });
      return;
    }

    await performItemAction(`/api/items/${item.id}/consume/`, `Marked ${item.name} as used`);
  };

  const handleMarkOpen = async (item) => {
    await performItemAction(`/api/items/${item.id}/mark_open/`, `Marked an open unit for ${item.name}`);
  };

  const handleSubtractPack = async (item) => {
    await performItemAction(`/api/items/${item.id}/subtract_pack/`, `Subtracted one pack from ${item.name}`);
  };

  const handleBarcodeScan = (barcode) => {
    notification.info(`Scanned labeled item: ${barcode}`);
  };

  const handleBarcodeConsume = async (barcode, itemData) => {
    try {
      const response = await fetch(buildApiUrl('/api/items/consume_by_barcode/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          barcode,
          notes: `Consumed via labeled item scan: ${barcode}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to consume labeled item.');
      }
      notification.success(`Consumed labeled item: ${itemData?.name || payload?.item?.name || barcode}`);
      setLocalRefreshKey((previous) => previous + 1);
    } catch (consumeError) {
      notification.error(consumeError.message || 'Failed to consume labeled item.');
    } finally {
      setIsScannerOpen(false);
    }
  };

  const filterSections = [
    { key: 'location', label: 'Location', options: filterOptions?.locations || [] },
    { key: 'item_type', label: 'Type', options: filterOptions?.itemTypes || [] },
    { key: 'vendor', label: 'Vendor', options: filterOptions?.vendors || [] },
  ];

  return (
    <main className="flex-grow bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_40%),linear-gradient(180deg,#f8fafc,#f1f5f9)] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_50px_-34px_rgba(15,23,42,0.34)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,249,255,0.88))] px-5 py-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="inline-flex h-9 items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Inventory
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-black tracking-tight text-slate-900">Inventory</h1>
                    <p className="text-xs text-slate-500">
                      {filteredGroups.length} groups · {groupedInventory.filter((group) => group.hasLowStock).length} low stock
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onAddItemClick?.()} className={toolbarButtonClass}>
                    <Package className="mr-2 h-4 w-4" />
                    Add Item
                  </button>
                  <button type="button" onClick={() => setIsScannerOpen(true)} className={toolbarPrimaryButtonClass}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Scan Labeled Item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.history.pushState(null, '', '/requests');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className={toolbarButtonClass}
                  >
                    <Warehouse className="mr-2 h-4 w-4" />
                    Receive
                  </button>
                  <button type="button" onClick={() => exportGroups(filteredGroups)} className={toolbarButtonClass}>
                    <Package className="mr-2 h-4 w-4" />
                    Export
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {savedViews.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setSavedView(view.id)}
                      className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${
                        savedView === view.id
                          ? 'bg-slate-950 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex w-full min-w-[260px] max-w-2xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={filters.search || ''}
                      onChange={(event) => onFilterChange?.('search', event.target.value)}
                      placeholder="Search item, catalog, lot, barcode, vendor, location..."
                      className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    <Filter className="h-4 w-4 text-slate-300" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      ref={columnsButtonRef}
                      type="button"
                      onClick={() => setShowColumnsPanel((previous) => !previous)}
                      className={toolbarButtonClass}
                    >
                      Columns
                      <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showColumnsPanel ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      ref={advancedFiltersButtonRef}
                      type="button"
                      onClick={() => setShowAdvancedFilters((previous) => !previous)}
                      className={toolbarButtonClass}
                    >
                      Advanced Filters
                      <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {taskChips.map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setActiveTaskChip(chip.id)}
                    className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                      activeTaskChip === chip.id
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <ChipIcon className="h-3.5 w-3.5" />
                    {chip.label}
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-500">{chip.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <ToolbarPopover
          anchorRef={columnsButtonRef}
          isOpen={showColumnsPanel}
          onClose={() => setShowColumnsPanel(false)}
          widthClass="w-64"
        >
          <div className="p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Visible Columns</p>
            {Object.entries({
              inStock: 'In Stock',
              primaryLocation: 'Primary Location',
              lotExpiration: 'Lot / Expiration',
              lastUsed: 'Last Used',
              tracking: 'Tracking',
              requestState: 'Request State',
            }).map(([key, label]) => (
              <label key={key} className="mb-2 flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50 last:mb-0">
                <input
                  type="checkbox"
                  checked={visibleColumns[key]}
                  onChange={() => setVisibleColumns((previous) => ({ ...previous, [key]: !previous[key] }))}
                />
                {label}
              </label>
            ))}
          </div>
        </ToolbarPopover>

        <ToolbarPopover
          anchorRef={advancedFiltersButtonRef}
          isOpen={showAdvancedFilters}
          onClose={() => setShowAdvancedFilters(false)}
          widthClass="w-[340px]"
        >
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filter Table</p>
              <button
                type="button"
                className="text-xs font-semibold text-sky-600"
                onClick={() => {
                  ['location', 'item_type', 'vendor', 'expired', 'low_stock'].forEach((key) => {
                    (filters[key] || []).forEach((value) => onFilterChange?.(key, value));
                  });
                }}
              >
                Clear
              </button>
            </div>
            <div className="max-h-[min(52vh,420px)] space-y-4 overflow-y-auto pr-1">
              {filterSections.map((section) => (
                <div key={section.key}>
                  <p className="mb-2 text-sm font-semibold text-slate-700">{section.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {section.options.slice(0, 8).map((option) => {
                      const optionLabel = option.full_path || option.name;
                      const optionValue = String(option.id);
                      const isActive = (filters[section.key] || []).map(String).includes(optionValue);
                      return (
                        <button
                          key={`${section.key}-${option.id || optionLabel}`}
                          type="button"
                          onClick={() => onFilterChange?.(section.key, optionValue)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            isActive
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {optionLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Status</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onFilterChange?.('low_stock', 'true')}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      (filters.low_stock || []).includes('true')
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Low Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => onFilterChange?.('expired', 'true')}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      (filters.expired || []).includes('true')
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Expiring / Expired
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ToolbarPopover>

        <section className="space-y-4">
          {loading && (
            <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-20 text-center shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)]">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
              <p className="text-sm font-medium text-slate-500">Loading inventory decision table...</p>
            </div>
          )}

          {error && (
            <div className="rounded-[28px] border border-danger-200 bg-danger-50 px-6 py-10 text-center shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)]">
              <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-danger-500" />
              <h3 className="text-lg font-semibold text-danger-800">Failed to load inventory</h3>
              <p className="mt-2 text-sm text-danger-600">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              <InventoryTable
                groups={paginatedGroups}
                selectedGroupId={selectedGroupId}
                onSelectGroup={(group) => setSelectedGroupId(group.id)}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
                onViewRequestHistory={handleViewRequestHistory}
                onBatchAction={handleBatchAction}
                onRequestMore={onRequestMoreItem}
                visibleColumns={visibleColumns}
              />

              <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)]">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredGroups.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </section>
      </div>

      <InventoryDetailDrawer
        group={selectedGroup}
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroupId(null)}
        onEdit={onEditItem}
        onDelete={onDeleteItem}
        onRequestMore={onRequestMoreItem}
        onViewRequestHistory={handleViewRequestHistory}
        onConsumeInstance={handleConsumeItem}
        onOpenScanner={() => setIsScannerOpen(true)}
        onMarkOpen={handleMarkOpen}
        onSubtractPack={handleSubtractPack}
        onMoveInstance={onEditItem}
        onEditMetadata={onEditItem}
        onPrintBarcode={(item) => setSelectedPrintItem(item)}
      />

      <ItemRequestHistoryModal
        isOpen={isRequestHistoryOpen}
        onClose={() => setIsRequestHistoryOpen(false)}
        itemName={selectedHistoryItem?.name}
        token={token}
      />

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
        onConfirm={handleBarcodeConsume}
      />

      {selectedPrintItem?.barcode && (
        <PrintBarcodeModal
          isOpen={!!selectedPrintItem}
          onClose={() => setSelectedPrintItem(null)}
          itemName={selectedPrintItem.name}
          barcode={selectedPrintItem.barcode}
          itemId={selectedPrintItem.id}
          allowTextEdit={true}
          priority="normal"
        />
      )}
    </main>
  );
};

export default InventoryPage;
