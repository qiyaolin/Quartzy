import { buildMobileInventoryGroups } from '../mobileInventoryGrouping';
import type { MobileInventoryItem } from '../mobileInventoryFields';

const createItem = (overrides: Partial<MobileInventoryItem>): MobileInventoryItem => {
  return {
    id: 1,
    name: 'Buffer',
    quantity: 1,
    min_quantity: 0,
    unit: 'mL',
    catalog_number: 'BUF-001',
    location: { id: 1, name: 'Shelf A' },
    item_type: { id: 1, name: 'Reagent' },
    vendor: { id: 1, name: 'Vendor A' },
    expiry_date: null,
    barcode: 'BC-001',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
};

describe('buildMobileInventoryGroups', () => {
  test('uses total group quantity for stock level instead of per-barcode quantity', () => {
    const groups = buildMobileInventoryGroups([
      createItem({ id: 1, quantity: 3, min_quantity: 5, barcode: 'BC-001' }),
      createItem({ id: 2, quantity: 4, min_quantity: 5, barcode: 'BC-002' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].totalQuantity).toBe(7);
    expect(groups[0].groupThreshold).toBe(5);
    expect(groups[0].stockLevel).toBe('in');
  });

  test('marks group as out when total quantity is zero', () => {
    const groups = buildMobileInventoryGroups([
      createItem({ id: 1, quantity: 0, min_quantity: 5, barcode: 'BC-001' }),
      createItem({ id: 2, quantity: 0, min_quantity: 5, barcode: 'BC-002' })
    ]);

    expect(groups[0].stockLevel).toBe('out');
  });

  test('does not mark low stock when threshold is missing', () => {
    const groups = buildMobileInventoryGroups([
      createItem({ id: 1, quantity: 1, min_quantity: 0, barcode: 'BC-001' }),
      createItem({ id: 2, quantity: 1, min_quantity: 0, barcode: 'BC-002' })
    ]);

    expect(groups[0].groupThreshold).toBeNull();
    expect(groups[0].stockLevel).toBe('in');
  });

  test('uses max threshold and warns when thresholds mismatch in same group', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const groups = buildMobileInventoryGroups([
      createItem({ id: 1, quantity: 3, min_quantity: 2, barcode: 'BC-001' }),
      createItem({ id: 2, quantity: 4, min_quantity: 8, barcode: 'BC-002' })
    ]);

    expect(groups[0].thresholdMismatch).toBe(true);
    expect(groups[0].groupThreshold).toBe(8);
    expect(groups[0].stockLevel).toBe('low');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  test('groups by vendor id even if vendor display names differ', () => {
    const groups = buildMobileInventoryGroups([
      createItem({
        id: 1,
        vendor: { id: 11, name: 'Vendor Alias 1' },
        barcode: 'BC-001'
      }),
      createItem({
        id: 2,
        vendor: { id: 11, name: 'Vendor Alias 2' },
        barcode: 'BC-002'
      })
    ]);

    expect(groups).toHaveLength(1);
  });
});
