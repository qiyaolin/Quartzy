import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Clock3,
  MoreHorizontal,
  Package,
  Printer,
  QrCode,
  ShoppingCart,
} from 'lucide-react';
import PrintBarcodeModal from './PrintBarcodeModal.tsx';

const formatDate = (value) => {
  if (!value) {
    return 'No expiry';
  }

  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const getRequestTone = (requestState) => {
  switch (requestState) {
    case 'ORDERED':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'APPROVED':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'NEW':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'LOW_STOCK':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const StatusPill = ({ children, tone }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold leading-none ${tone}`}>{children}</span>
);

const InventoryTable = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  onEdit,
  onDelete,
  onViewRequestHistory,
  onBatchAction,
  onRequestMore,
  visibleColumns,
}) => {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedItemForPrint, setSelectedItemForPrint] = useState(null);

  const allInstanceIds = useMemo(
    () => groups.flatMap((group) => group.instances.map((instance) => instance.id)),
    [groups],
  );

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups((previous) => ({ ...previous, [groupId]: !previous[groupId] }));
  };

  const handleSelectAll = (checked) => {
    setSelectedItems(checked ? new Set(allInstanceIds) : new Set());
  };

  const handleGroupSelection = (group, checked) => {
    setSelectedItems((previous) => {
      const next = new Set(previous);
      group.instances.forEach((instance) => {
        if (checked) {
          next.add(instance.id);
        } else {
          next.delete(instance.id);
        }
      });
      return next;
    });
  };

  const handleInstanceSelection = (instanceId, checked) => {
    setSelectedItems((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(instanceId);
      } else {
        next.delete(instanceId);
      }
      return next;
    });
  };

  const isGroupSelected = (group) => group.instances.every((instance) => selectedItems.has(instance.id));
  const isGroupPartiallySelected = (group) => group.instances.some((instance) => selectedItems.has(instance.id)) && !isGroupSelected(group);
  const allSelected = allInstanceIds.length > 0 && allInstanceIds.every((instanceId) => selectedItems.has(instanceId));

  const renderStatusPills = (group) => {
    const pills = [];
    if (group.hasExpired) {
      pills.push(<StatusPill key="expired" tone="bg-danger-50 text-danger-700 border-danger-200">Expired</StatusPill>);
    }
    if (group.hasExpiringSoon) {
      pills.push(<StatusPill key="expiring" tone="bg-warning-50 text-warning-700 border-warning-200">Expiring Soon</StatusPill>);
    }
    if (group.hasLowStock) {
      pills.push(<StatusPill key="low" tone="bg-orange-50 text-orange-700 border-orange-200">Low Stock</StatusPill>);
    }
    if (group.openUnitCount > 0) {
      pills.push(<StatusPill key="open" tone="bg-amber-50 text-amber-700 border-amber-200">{group.openUnitCount} Open</StatusPill>);
    }
    if (group.isLastUnit) {
      pills.push(<StatusPill key="last" tone="bg-slate-100 text-slate-700 border-slate-200">Last Unit</StatusPill>);
    }
    if (pills.length === 0) {
      pills.push(<StatusPill key="ok" tone="bg-emerald-50 text-emerald-700 border-emerald-200">Ready</StatusPill>);
    }
    return pills;
  };

  return (
    <div className="card overflow-hidden border border-slate-200 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)]">
      {selectedItems.size > 0 && (
        <div className="border-b border-sky-200 bg-[linear-gradient(135deg,#ecfeff,#eff6ff)] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">Batch actions</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{selectedItems.size} labeled records selected</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => onBatchAction?.('archive', Array.from(selectedItems))}>
                Mark Used
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => onBatchAction?.('export', Array.from(selectedItems))}>
                Export
              </button>
              <button type="button" className="btn btn-danger" onClick={() => onBatchAction?.('delete', Array.from(selectedItems))}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-slate-950 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            <tr>
              <th className="px-5 py-4">
                <input type="checkbox" className="checkbox" checked={allSelected} onChange={(event) => handleSelectAll(event.target.checked)} />
              </th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Item</th>
              {visibleColumns?.inStock !== false && <th className="px-5 py-4">In Stock</th>}
              {visibleColumns?.primaryLocation !== false && <th className="px-5 py-4">Primary Location</th>}
              {visibleColumns?.lotExpiration !== false && <th className="px-5 py-4">Lot / Expiration</th>}
              {visibleColumns?.lastUsed !== false && <th className="px-5 py-4">Last Used</th>}
              {visibleColumns?.tracking !== false && <th className="px-5 py-4">Tracking</th>}
              {visibleColumns?.requestState !== false && <th className="px-5 py-4">Request State</th>}
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {groups.map((group) => {
              const isExpanded = !!expandedGroups[group.id];
              const isSelected = selectedGroupId === group.id;
              const groupChecked = isGroupSelected(group);
              const groupPartial = isGroupPartiallySelected(group);

              return (
                <React.Fragment key={group.id}>
                  <tr className={`transition ${isSelected ? 'bg-sky-50/80' : 'hover:bg-slate-50'}`}>
                    <td className="px-5 py-4 align-top">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={groupChecked}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate = groupPartial;
                          }
                        }}
                        onChange={(event) => handleGroupSelection(group, event.target.checked)}
                      />
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex max-w-[220px] flex-wrap gap-2">{renderStatusPills(group)}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleGroupExpansion(group.id)}
                          className="mt-0.5 rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button type="button" className="min-w-0 text-left" onClick={() => onSelectGroup?.(group)}>
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                              <Package className="h-4 w-4 shrink-0 text-sky-600" />
                            </span>
                            <span className="font-semibold text-slate-900">{group.name}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {[group.vendor?.name, group.catalog_number, group.item_type?.name].filter(Boolean).join(' · ') || 'No catalog metadata'}
                          </p>
                        </button>
                      </div>
                    </td>
                    {visibleColumns?.inStock !== false && (
                      <td className="px-5 py-4 align-top">
                        <div className="text-sm font-semibold text-slate-900">{group.formattedQuantity}</div>
                        <p className="mt-2 text-sm text-slate-500">{group.instanceSummary}</p>
                      </td>
                    )}
                    {visibleColumns?.primaryLocation !== false && (
                      <td className="px-5 py-4 align-top">
                        <div className="flex max-w-[220px] items-start gap-2 text-sm text-slate-600">
                          <Package className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>{group.primaryLocation}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns?.lotExpiration !== false && (
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-semibold text-slate-900">{group.lotSummary}</p>
                        <p className="mt-2 text-sm text-slate-500">{group.expirationSummary}</p>
                      </td>
                    )}
                    {visibleColumns?.lastUsed !== false && (
                      <td className="px-5 py-4 align-top">
                        <div className="min-w-[150px]">
                          <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                            {group.latestLastUsedDate ? formatDate(group.latestLastUsedDate) : 'Not used yet'}
                          </p>
                          <p className="mt-2 whitespace-nowrap text-sm text-slate-500">
                            {group.latestReceivedDate ? `Received ${formatDate(group.latestReceivedDate)}` : 'No receive history'}
                          </p>
                        </div>
                      </td>
                    )}
                    {visibleColumns?.tracking !== false && (
                      <td className="px-5 py-4 align-top">
                        <div className="min-w-[128px] space-y-2">
                          <StatusPill tone="bg-slate-50 text-slate-700 border-slate-200">{group.trackingSummary}</StatusPill>
                          {group.hasLabeledInstances && (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <QrCode className="h-4 w-4 text-slate-400" />
                              {group.labeledCount} labeled
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns?.requestState !== false && (
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRequestTone(group.requestState)}`}>
                          {group.requestStateLabel}
                        </span>
                        {group.requestStateCount > 0 && (
                          <p className="mt-2 text-sm text-slate-500">{group.requestStateCount} linked request{group.requestStateCount > 1 ? 's' : ''}</p>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelectGroup?.(group)}>
                          Details
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRequestMore?.(group.instances[0])}>
                          <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                          Request
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                            onClick={() => setOpenMenuId((previous) => (previous === group.id ? null : group.id))}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenuId === group.id && (
                            <div className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setOpenMenuId(null); onEdit?.(group.editItem); }}>
                                Edit group
                              </button>
                              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setOpenMenuId(null); onViewRequestHistory?.(group.instances[0]); }}>
                                View request history
                              </button>
                              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50" onClick={() => { setOpenMenuId(null); onDelete?.(group.instances[0]); }}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && group.instances.map((instance) => (
                    <tr key={instance.id} className="bg-slate-50/70">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedItems.has(instance.id)}
                          onChange={(event) => handleInstanceSelection(instance.id, event.target.checked)}
                        />
                      </td>
                      <td className="px-5 py-3" colSpan={2}>
                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="bg-slate-50 text-slate-700 border-slate-200">{instance.tracking_summary || 'Tracked item'}</StatusPill>
                            {instance.expiration_status === 'EXPIRING_SOON' && (
                              <StatusPill tone="bg-warning-50 text-warning-700 border-warning-200">
                                <Clock3 className="mr-1 inline h-3 w-3" />
                                Expiring soon
                              </StatusPill>
                            )}
                            {instance.barcode && (
                              <StatusPill tone="bg-sky-50 text-sky-700 border-sky-200">
                                <QrCode className="mr-1 inline h-3 w-3" />
                                Labeled
                              </StatusPill>
                            )}
                          </div>
                          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                            <div>
                              <p className="font-semibold text-slate-900">{instance.quantity} {instance.unit}</p>
                              <p className="mt-1">{instance.primary_location?.full_path || instance.location?.full_path || instance.location?.name || 'No location set'}</p>
                            </div>
                            <div>
                              <p>{instance.lot_number ? `Lot ${instance.lot_number}` : 'No lot recorded'}</p>
                              <p className="mt-1">{instance.expiration_date ? `Expires ${formatDate(instance.expiration_date)}` : 'No expiry date'}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      {visibleColumns?.inStock !== false && (
                        <td className="px-5 py-3 align-top">
                          <span className="text-sm font-medium text-slate-900">{instance.quantity} {instance.unit}</span>
                        </td>
                      )}
                      {visibleColumns?.primaryLocation !== false && (
                        <td className="px-5 py-3 align-top text-sm text-slate-600">
                          {instance.primary_location?.full_path || instance.location?.full_path || instance.location?.name || 'No location'}
                        </td>
                      )}
                      {visibleColumns?.lotExpiration !== false && (
                        <td className="px-5 py-3 align-top text-sm text-slate-600">
                          {instance.lot_number ? `Lot ${instance.lot_number}` : 'No lot'}
                          <div className="mt-2">{instance.expiration_date ? formatDate(instance.expiration_date) : 'No expiry'}</div>
                        </td>
                      )}
                      {visibleColumns?.lastUsed !== false && (
                        <td className="px-5 py-3 align-top text-sm text-slate-600">
                          {instance.last_used_date ? formatDate(instance.last_used_date) : 'Not used yet'}
                        </td>
                      )}
                      {visibleColumns?.tracking !== false && (
                        <td className="px-5 py-3 align-top text-sm text-slate-600">
                          {instance.tracking_summary || 'Tracked item'}
                          <div className="mt-2 font-mono text-xs text-slate-500">{instance.barcode || 'No physical barcode'}</div>
                        </td>
                      )}
                      {visibleColumns?.requestState !== false && (
                        <td className="px-5 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRequestTone(instance.request_state)}`}>
                            {instance.request_state_label}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {instance.barcode && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedItemForPrint(instance);
                                setShowPrintModal(true);
                              }}
                            >
                              <Printer className="mr-1 h-3.5 w-3.5" />
                              Print
                            </button>
                          )}
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onViewRequestHistory?.(instance)}>
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedItemForPrint?.barcode && (
        <PrintBarcodeModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setSelectedItemForPrint(null);
          }}
          itemName={selectedItemForPrint.name}
          barcode={selectedItemForPrint.barcode}
          itemId={selectedItemForPrint.id}
          allowTextEdit={true}
          priority="normal"
        />
      )}
    </div>
  );
};

export default InventoryTable;
