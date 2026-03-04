import { normalizeInventoryItem, safeDisplayName } from '../mobileInventoryFields';

describe('safeDisplayName', () => {
  test('returns fallback for nullish values', () => {
    expect(safeDisplayName(null)).toBe('Unknown');
    expect(safeDisplayName(undefined)).toBe('Unknown');
  });

  test('returns a trimmed string value when available', () => {
    expect(safeDisplayName('  Shelf A  ')).toBe('Shelf A');
    expect(safeDisplayName('   ')).toBe('Unknown');
  });

  test('returns object name when valid', () => {
    expect(safeDisplayName({ name: 'Freezer 1' })).toBe('Freezer 1');
    expect(safeDisplayName({ name: '   ' })).toBe('Unknown');
    expect(safeDisplayName({})).toBe('Unknown');
  });

  test('returns fallback for unsupported value types', () => {
    expect(safeDisplayName(123)).toBe('Unknown');
    expect(safeDisplayName([])).toBe('Unknown');
    expect(safeDisplayName(true)).toBe('Unknown');
  });
});

describe('normalizeInventoryItem', () => {
  test('returns null for non-object values', () => {
    expect(normalizeInventoryItem(null)).toBeNull();
    expect(normalizeInventoryItem(undefined)).toBeNull();
    expect(normalizeInventoryItem('bad')).toBeNull();
    expect(normalizeInventoryItem([])).toBeNull();
  });

  test('normalizes a valid raw item', () => {
    const normalized = normalizeInventoryItem({
      id: 10,
      name: 'Buffer Solution',
      quantity: '3',
      min_quantity: '1',
      unit: 'mL',
      catalog_number: 'BUF-001',
      location: { id: 7, name: 'Cold Room' },
      item_type: { id: 5, name: 'Chemical' },
      vendor: { id: 9, name: 'Lab Supplier' },
      expiry_date: '2026-12-01',
      barcode: 'ABC-123',
      fund_id: '8',
      fund_name: 'Main Grant',
      created_at: '2026-01-01T00:00:00Z'
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe(10);
    expect(normalized?.name).toBe('Buffer Solution');
    expect(normalized?.quantity).toBe(3);
    expect(normalized?.min_quantity).toBe(1);
    expect(normalized?.unit).toBe('mL');
    expect(normalized?.catalog_number).toBe('BUF-001');
    expect(normalized?.location).toEqual({ id: 7, name: 'Cold Room' });
    expect(normalized?.item_type).toEqual({ id: 5, name: 'Chemical' });
    expect(normalized?.vendor).toEqual({ id: 9, name: 'Lab Supplier' });
    expect(normalized?.expiry_date).toBe('2026-12-01');
    expect(normalized?.barcode).toBe('ABC-123');
    expect(normalized?.fund_id).toBe(8);
    expect(normalized?.fund_name).toBe('Main Grant');
  });

  test('drops invalid named objects to null and keeps page-safe defaults', () => {
    const normalized = normalizeInventoryItem({
      id: 11,
      name: null,
      quantity: null,
      min_quantity: undefined,
      location: { id: 1, name: null },
      item_type: { id: 2 },
      vendor: '   ',
      expiration_date: '2027-01-01'
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.name).toBe('Unnamed Item');
    expect(normalized?.quantity).toBe(0);
    expect(normalized?.min_quantity).toBe(0);
    expect(normalized?.location).toBeNull();
    expect(normalized?.item_type).toBeNull();
    expect(normalized?.vendor).toBeNull();
    expect(normalized?.expiry_date).toBe('2027-01-01');
  });

  test('returns null when id is missing or invalid', () => {
    expect(normalizeInventoryItem({ name: 'No Id' })).toBeNull();
    expect(normalizeInventoryItem({ id: -1, name: 'Bad Id' })).toBeNull();
    expect(normalizeInventoryItem({ id: 'abc', name: 'Bad Id' })).toBeNull();
  });
});
