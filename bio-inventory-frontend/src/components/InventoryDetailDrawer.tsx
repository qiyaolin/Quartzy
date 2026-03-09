import React from 'react';
import {
  Calendar,
  Clock3,
  Layers3,
  MapPin,
  Package,
  Printer,
  QrCode,
  ShoppingCart,
  TestTube2,
  X,
} from 'lucide-react';

const formatDate = (value) => {
  if (!value) {
    return 'Not recorded';
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

const getStatusTone = (instance) => {
  if (instance.expiration_status === 'EXPIRED') {
    return 'bg-danger-50 text-danger-700 border-danger-200';
  }
  if (instance.expiration_status === 'EXPIRING_SOON') {
    return 'bg-warning-50 text-warning-700 border-warning-200';
  }
  if (instance.is_low_stock) {
    return 'bg-orange-50 text-orange-700 border-orange-200';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const InventoryDetailDrawer = ({
  group,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onRequestMore,
  onViewRequestHistory,
  onConsumeInstance,
  onOpenScanner,
  onMarkOpen,
  onSubtractPack,
  onMoveInstance,
  onEditMetadata,
  onPrintBarcode,
}) => {
  if (!isOpen || !group) {
    return null;
  }

  const leadInstance = group.instances[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close details"
      />

      <aside className="relative h-full w-full max-w-xl overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_46%),linear-gradient(135deg,#f8fafc,#ecfeff)] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {group.requestStateLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {group.trackingSummary}
                  </span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{group.name}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {[group.vendor?.name, group.catalog_number, group.item_type?.name].filter(Boolean).join(' · ') || 'No catalog metadata yet'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/70 bg-white/80 p-2 text-slate-500 transition hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">In Stock</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {group.formattedQuantity}
                </p>
                <p className="mt-2 text-sm text-slate-500">{group.locationSummary}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tracking</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{group.trackingSummary}</p>
                <p className="mt-2 text-sm text-slate-500">{group.instanceSummary}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onRequestMore?.(leadInstance)} className="btn btn-primary">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Request More
              </button>
              <button type="button" onClick={() => onViewRequestHistory?.(leadInstance)} className="btn btn-secondary">
                <Clock3 className="mr-2 h-4 w-4" />
                Request History
              </button>
              <button type="button" onClick={() => onEdit?.(group.editItem)} className="btn btn-secondary">
                <Package className="mr-2 h-4 w-4" />
                Edit Group
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.hasPackManaged && (
                  <>
                    <button type="button" className="btn btn-secondary justify-center" onClick={() => onSubtractPack?.(leadInstance)}>
                      <Package className="mr-2 h-4 w-4" />
                      Subtract 1 Box
                    </button>
                    <button type="button" className="btn btn-secondary justify-center" onClick={() => onMarkOpen?.(leadInstance)}>
                      <TestTube2 className="mr-2 h-4 w-4" />
                      Mark Open
                    </button>
                  </>
                )}
                {!group.hasPackManaged && leadInstance?.can_scan_consume && (
                  <button type="button" className="btn btn-secondary justify-center" onClick={() => onOpenScanner?.()}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Scan Labeled Item
                  </button>
                )}
                {!group.hasPackManaged && !leadInstance?.can_scan_consume && (
                  <button type="button" className="btn btn-secondary justify-center" onClick={() => onConsumeInstance?.(leadInstance)}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Mark Used
                  </button>
                )}
                <button type="button" className="btn btn-secondary justify-center" onClick={() => onMoveInstance?.(leadInstance)}>
                  <MapPin className="mr-2 h-4 w-4" />
                  Move
                </button>
                {!group.hasPackManaged && (
                  <button type="button" className="btn btn-secondary justify-center" onClick={() => onEditMetadata?.(leadInstance)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Edit Lot / Expiry
                  </button>
                )}
                {group.hasLabeledInstances && leadInstance?.barcode && (
                  <button type="button" className="btn btn-secondary justify-center" onClick={() => onPrintBarcode?.(leadInstance)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print / Reprint
                  </button>
                )}
                <button type="button" className="btn btn-secondary justify-center" onClick={() => onDelete?.(leadInstance)}>
                  Remove Item
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Instances</h3>
              </div>
              <div className="space-y-3">
                {group.instances.map((instance) => (
                  <div key={instance.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(instance)}`}>
                            {instance.tracking_summary || 'Tracked item'}
                          </span>
                          {instance.barcode && (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              Labeled
                            </span>
                          )}
                          {instance.open_unit_count > 0 && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              {instance.open_unit_count} open
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-base font-semibold text-slate-900">
                          {instance.quantity} {instance.unit}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!group.hasPackManaged && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onConsumeInstance?.(instance)}>
                            Mark Used
                          </button>
                        )}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onMoveInstance?.(instance)}>
                          Move
                        </button>
                        {instance.barcode && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPrintBarcode?.(instance)}>
                            Print
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span>{instance.primary_location?.full_path || instance.location?.full_path || instance.location?.name || 'No location set'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span>
                          {instance.lot_number ? `Lot ${instance.lot_number}` : 'No lot'}
                          {instance.expiration_date ? ` · Expires ${formatDate(instance.expiration_date)}` : ' · No expiry'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span>Last used {formatDate(instance.last_used_date)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <QrCode className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span className="font-mono text-xs">{instance.barcode || 'No physical barcode'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Activity</h3>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                  <span>Latest receive date: {formatDate(group.latestReceivedDate)}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                  <span>Last used date: {formatDate(group.latestLastUsedDate)}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 h-4 w-4 text-slate-400" />
                  <span>Request state: {group.requestStateLabel}{group.requestStateCount ? ` (${group.requestStateCount})` : ''}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default InventoryDetailDrawer;
