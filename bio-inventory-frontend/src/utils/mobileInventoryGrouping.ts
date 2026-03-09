import { safeDisplayName, type MobileInventoryItem } from './mobileInventoryFields.ts';

export type InventoryGroupStockLevel = 'out' | 'low' | 'in';

export interface MobileInventoryGroup {
  id: string;
  name: string;
  vendorName: string;
  itemTypeName: string;
  catalogNumber: string;
  locationSummary: string;
  totalQuantity: number;
  records: MobileInventoryItem[];
  fundSummary: string;
  expiringSoonCount: number;
  groupThreshold: number | null;
  stockLevel: InventoryGroupStockLevel;
  thresholdMismatch: boolean;
  trackingSummary: string;
  requestStateLabel: string;
  labeledCount: number;
  openUnitCount: number;
}

type MutableInventoryGroup = MobileInventoryGroup & {
  thresholds: Set<number>;
};

const normalizeGroupToken = (value: string | null | undefined): string => {
  return (value || '').trim().toLowerCase();
};

export const getNamedValueName = (value: MobileInventoryItem['location'], fallback = 'Unknown'): string => {
  return safeDisplayName(value, fallback);
};

const getVendorGroupToken = (vendor: MobileInventoryItem['vendor']): string => {
  if (vendor && typeof vendor === 'object' && !Array.isArray(vendor)) {
    const rawId = (vendor as { id?: unknown }).id;
    if (typeof rawId === 'number' || typeof rawId === 'string') {
      const trimmed = String(rawId).trim();
      if (trimmed) {
        return `id:${trimmed.toLowerCase()}`;
      }
    }
  }

  return `name:${normalizeGroupToken(safeDisplayName(vendor, ''))}`;
};

const getValidThreshold = (item: MobileInventoryItem): number | null => {
  if (!Number.isFinite(item.min_quantity) || item.min_quantity <= 0) {
    return null;
  }
  return item.min_quantity;
};

const isExpiringSoon = (expiryDate: string | null) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 30 && diffDays > 0;
};

const getGroupStockLevel = (totalQuantity: number, threshold: number | null): InventoryGroupStockLevel => {
  if (totalQuantity <= 0) {
    return 'out';
  }

  if (threshold == null) {
    return 'in';
  }

  return totalQuantity <= threshold ? 'low' : 'in';
};

export const buildMobileInventoryGroups = (items: MobileInventoryItem[]): MobileInventoryGroup[] => {
  const groupMap = new Map<string, MutableInventoryGroup>();

  items.forEach((item) => {
    const groupId = [
      normalizeGroupToken(item.name),
      getVendorGroupToken(item.vendor),
      normalizeGroupToken(item.catalog_number)
    ].join('|');

    const existing = groupMap.get(groupId);
    if (!existing) {
      const threshold = getValidThreshold(item);
      const thresholds = new Set<number>();
      if (threshold != null) {
        thresholds.add(threshold);
      }

      groupMap.set(groupId, {
        id: groupId,
        name: item.name,
        vendorName: getNamedValueName(item.vendor),
        itemTypeName: getNamedValueName(item.item_type),
        catalogNumber: item.catalog_number || '',
        locationSummary: getNamedValueName(item.location),
        totalQuantity: item.quantity,
        records: [item],
        fundSummary: item.fund_name || '',
        expiringSoonCount: isExpiringSoon(item.expiry_date) ? 1 : 0,
        groupThreshold: null,
        stockLevel: 'in',
        thresholdMismatch: false,
        trackingSummary: item.tracking_summary || 'Tracked item',
        requestStateLabel: item.request_state_label || 'No action',
        labeledCount: item.can_scan_consume ? 1 : 0,
        openUnitCount: item.open_unit_count || 0,
        thresholds
      });
      return;
    }

    existing.records.push(item);
    existing.totalQuantity += item.quantity;
    const threshold = getValidThreshold(item);
    if (threshold != null) {
      existing.thresholds.add(threshold);
    }

    if (isExpiringSoon(item.expiry_date)) {
      existing.expiringSoonCount += 1;
    }
    existing.labeledCount += item.can_scan_consume ? 1 : 0;
    existing.openUnitCount += item.open_unit_count || 0;
  });

  return Array.from(groupMap.values())
    .map((group) => {
      const uniqueLocations = Array.from(new Set(group.records.map((record) => getNamedValueName(record.location))));
      const uniqueTypes = Array.from(new Set(group.records.map((record) => getNamedValueName(record.item_type))));
      const uniqueFunds = Array.from(
        new Set(group.records.map((record) => record.fund_name).filter((fund): fund is string => Boolean(fund)))
      );
      const thresholdValues = Array.from(group.thresholds).sort((a, b) => a - b);
      const thresholdMismatch = thresholdValues.length > 1;
      const groupThreshold = thresholdValues.length > 0 ? thresholdValues[thresholdValues.length - 1] : null;

      if (thresholdMismatch) {
        console.warn(
          `[mobile-inventory] Inconsistent low stock thresholds for group "${group.id}": ${thresholdValues.join(', ')}`
        );
      }

      return {
        id: group.id,
        name: group.name,
        vendorName: group.vendorName,
        itemTypeName: uniqueTypes.length === 1 ? uniqueTypes[0] : 'Multiple types',
        catalogNumber: group.catalogNumber,
        locationSummary: uniqueLocations.length === 1 ? uniqueLocations[0] : 'Multiple locations',
        totalQuantity: group.totalQuantity,
        records: [...group.records].sort((a, b) => {
          const locationCompare = getNamedValueName(a.location).localeCompare(getNamedValueName(b.location));
          if (locationCompare !== 0) {
            return locationCompare;
          }
          return (a.barcode || '').localeCompare(b.barcode || '');
        }),
        fundSummary: uniqueFunds.length <= 1 ? uniqueFunds[0] || '' : 'Multiple funds',
        expiringSoonCount: group.expiringSoonCount,
        groupThreshold,
        stockLevel: getGroupStockLevel(group.totalQuantity, groupThreshold),
        thresholdMismatch,
        trackingSummary: group.trackingSummary,
        requestStateLabel: group.requestStateLabel,
        labeledCount: group.labeledCount,
        openUnitCount: group.openUnitCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};
