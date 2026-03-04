export type NamedValue = string | { id?: number; name?: unknown; [key: string]: unknown } | null;

export interface MobileInventoryItem {
  id: number;
  name: string;
  quantity: number;
  min_quantity: number;
  unit: string | null;
  catalog_number: string | null;
  location: NamedValue;
  item_type: NamedValue;
  vendor: NamedValue;
  expiry_date: string | null;
  barcode: string | null;
  fund_id?: number;
  fund_name?: string;
  created_at: string;
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeNamedValue = (value: unknown): NamedValue => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const normalizedName = toOptionalString(record.name);

  if (!normalizedName) {
    return null;
  }

  return {
    ...record,
    name: normalizedName
  };
};

export const safeDisplayName = (value: unknown, fallback = 'Unknown'): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const name = toOptionalString(record.name);
    if (name) {
      return name;
    }
  }

  return fallback;
};

export const normalizeInventoryItem = (raw: unknown): MobileInventoryItem | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = toNumber(record.id, -1);
  if (id < 0) {
    return null;
  }

  const name = safeDisplayName(record.name, 'Unnamed Item');
  const normalizedFundId = record.fund_id == null ? undefined : toNumber(record.fund_id, -1);

  return {
    id,
    name,
    quantity: toNumber(record.quantity, 0),
    min_quantity: toNumber(record.min_quantity ?? record.low_stock_threshold, 0),
    unit: toOptionalString(record.unit),
    catalog_number: toOptionalString(record.catalog_number),
    location: normalizeNamedValue(record.location),
    item_type: normalizeNamedValue(record.item_type),
    vendor: normalizeNamedValue(record.vendor),
    expiry_date: toOptionalString(record.expiry_date ?? record.expiration_date),
    barcode: toOptionalString(record.barcode),
    fund_id: normalizedFundId >= 0 ? normalizedFundId : undefined,
    fund_name: toOptionalString(record.fund_name) || undefined,
    created_at: toOptionalString(record.created_at) || ''
  };
};
