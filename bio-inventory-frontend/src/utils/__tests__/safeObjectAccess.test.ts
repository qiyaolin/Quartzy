/**
 * 安全对象属性访问工具单元测试
 * 验证移动端JavaScript undefined访问错误修复效果
 */

import {
  safeGet,
  safeGetUserName,
  safeGetVendorName,
  safeGetLocationName,
  safeHasProperty,
  safeIsEmpty,
  safeToString,
  safeToNumber,
  safeFormatDate,
  createSafeProxy,
  safeBatchGet,
  safeMobileObjectName
} from '../safeObjectAccess';

// Mock console methods to avoid test output noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('safeGet', () => {
  test('应该安全地获取对象属性', () => {
    const obj = { name: 'test', nested: { value: 42 } };
    expect(safeGet(obj, 'name')).toBe('test');
    expect(safeGet(obj, 'nested.value')).toBe(42);
  });

  test('应该处理undefined和null对象', () => {
    expect(safeGet(null, 'name')).toBeUndefined();
    expect(safeGet(undefined, 'name')).toBeUndefined();
    expect(safeGet(null, 'name', 'fallback')).toBe('fallback');
  });

  test('应该处理不存在的属性路径', () => {
    const obj = { name: 'test' };
    expect(safeGet(obj, 'nonexistent')).toBeUndefined();
    expect(safeGet(obj, 'nested.value')).toBeUndefined();
    expect(safeGet(obj, 'nested.value', 'fallback')).toBe('fallback');
  });

  test('应该处理空路径', () => {
    const obj = { name: 'test' };
    expect(safeGet(obj, '')).toBe(obj);
  });

  test('应该处理深层嵌套路径', () => {
    const obj = { 
      level1: { 
        level2: { 
          level3: { 
            value: 'deep' 
          } 
        } 
      } 
    };
    expect(safeGet(obj, 'level1.level2.level3.value')).toBe('deep');
    expect(safeGet(obj, 'level1.level2.level3.nonexistent')).toBeUndefined();
  });

  test('应该处理中间路径为null的情况', () => {
    const obj = { level1: null };
    expect(safeGet(obj, 'level1.level2.value')).toBeUndefined();
    expect(safeGet(obj, 'level1.level2.value', 'fallback')).toBe('fallback');
  });
});

describe('safeGetUserName', () => {
  test('应该从字符串获取用户名', () => {
    expect(safeGetUserName('john_doe')).toBe('john_doe');
    expect(safeGetUserName('  spaced  ')).toBe('spaced');
  });

  test('应该从用户对象获取用户名', () => {
    expect(safeGetUserName({ username: 'john' })).toBe('john');
    expect(safeGetUserName({ name: 'John Doe' })).toBe('John Doe');
    expect(safeGetUserName({ first_name: 'John' })).toBe('John');
    expect(safeGetUserName({ email: 'john@example.com' })).toBe('john@example.com');
  });

  test('应该处理无效用户数据', () => {
    expect(safeGetUserName(null)).toBe('Unknown User');
    expect(safeGetUserName(undefined)).toBe('Unknown User');
    expect(safeGetUserName({})).toBe('Unknown User');
    expect(safeGetUserName('')).toBe('Unknown User');
    expect(safeGetUserName('   ')).toBe('Unknown User');
  });

  test('应该使用自定义fallback', () => {
    expect(safeGetUserName(null, 'Anonymous')).toBe('Anonymous');
    expect(safeGetUserName({}, 'No Name')).toBe('No Name');
  });

  test('应该优先选择username字段', () => {
    const user = {
      username: 'john_doe',
      name: 'John Doe',
      email: 'john@example.com'
    };
    expect(safeGetUserName(user)).toBe('john_doe');
  });
});

describe('safeGetVendorName', () => {
  test('应该从字符串获取供应商名称', () => {
    expect(safeGetVendorName('Vendor Inc')).toBe('Vendor Inc');
  });

  test('应该从供应商对象获取名称', () => {
    expect(safeGetVendorName({ name: 'Vendor Corp' })).toBe('Vendor Corp');
    expect(safeGetVendorName({ vendor_name: 'Vendor LLC' })).toBe('Vendor LLC');
    expect(safeGetVendorName({ company_name: 'Company Ltd' })).toBe('Company Ltd');
  });

  test('应该处理无效供应商数据', () => {
    expect(safeGetVendorName(null)).toBe('Unknown Vendor');
    expect(safeGetVendorName(undefined)).toBe('Unknown Vendor');
    expect(safeGetVendorName({})).toBe('Unknown Vendor');
  });

  test('应该使用自定义fallback', () => {
    expect(safeGetVendorName(null, 'No Vendor')).toBe('No Vendor');
  });
});

describe('safeGetLocationName', () => {
  test('应该从字符串获取位置名称', () => {
    expect(safeGetLocationName('Lab Room 101')).toBe('Lab Room 101');
  });

  test('应该从位置对象获取名称', () => {
    expect(safeGetLocationName({ name: 'Storage Room' })).toBe('Storage Room');
    expect(safeGetLocationName({ location_name: 'Freezer A' })).toBe('Freezer A');
    expect(safeGetLocationName({ address: '123 Main St' })).toBe('123 Main St');
  });

  test('应该处理无效位置数据', () => {
    expect(safeGetLocationName(null)).toBe('Unknown Location');
    expect(safeGetLocationName(undefined)).toBe('Unknown Location');
    expect(safeGetLocationName({})).toBe('Unknown Location');
  });
});

describe('safeHasProperty', () => {
  test('应该正确检查属性存在性', () => {
    const obj = { name: 'test', value: null, zero: 0 };
    expect(safeHasProperty(obj, 'name')).toBe(true);
    expect(safeHasProperty(obj, 'value')).toBe(true);
    expect(safeHasProperty(obj, 'zero')).toBe(true);
    expect(safeHasProperty(obj, 'nonexistent')).toBe(false);
  });

  test('应该处理无效对象', () => {
    expect(safeHasProperty(null, 'name')).toBe(false);
    expect(safeHasProperty(undefined, 'name')).toBe(false);
    expect(safeHasProperty('string', 'name')).toBe(false);
  });
});

describe('safeIsEmpty', () => {
  test('应该正确检查空值', () => {
    expect(safeIsEmpty(null)).toBe(true);
    expect(safeIsEmpty(undefined)).toBe(true);
    expect(safeIsEmpty('')).toBe(true);
    expect(safeIsEmpty('   ')).toBe(true);
    expect(safeIsEmpty([])).toBe(true);
    expect(safeIsEmpty({})).toBe(true);
  });

  test('应该正确检查非空值', () => {
    expect(safeIsEmpty('test')).toBe(false);
    expect(safeIsEmpty([1])).toBe(false);
    expect(safeIsEmpty({ name: 'test' })).toBe(false);
    expect(safeIsEmpty(0)).toBe(false);
    expect(safeIsEmpty(false)).toBe(false);
  });
});

describe('safeToString', () => {
  test('应该转换各种类型为字符串', () => {
    expect(safeToString('test')).toBe('test');
    expect(safeToString(42)).toBe('42');
    expect(safeToString(true)).toBe('true');
    expect(safeToString(false)).toBe('false');
  });

  test('应该处理null和undefined', () => {
    expect(safeToString(null)).toBe('');
    expect(safeToString(undefined)).toBe('');
    expect(safeToString(null, 'fallback')).toBe('fallback');
  });

  test('应该处理对象', () => {
    expect(safeToString({ name: 'test' })).toBe('test');
    expect(safeToString({ title: 'title' })).toBe('title');
    expect(safeToString({ label: 'label' })).toBe('label');
    expect(safeToString({ other: 'value' })).toBe('{"other":"value"}');
  });
});

describe('safeToNumber', () => {
  test('应该转换各种类型为数字', () => {
    expect(safeToNumber(42)).toBe(42);
    expect(safeToNumber('42')).toBe(42);
    expect(safeToNumber('42.5')).toBe(42.5);
    expect(safeToNumber(true)).toBe(1);
    expect(safeToNumber(false)).toBe(0);
  });

  test('应该处理无效数字', () => {
    expect(safeToNumber('not a number')).toBe(0);
    expect(safeToNumber(null)).toBe(0);
    expect(safeToNumber(undefined)).toBe(0);
    expect(safeToNumber(NaN)).toBe(0);
  });

  test('应该使用自定义fallback', () => {
    expect(safeToNumber('invalid', -1)).toBe(-1);
    expect(safeToNumber(null, 100)).toBe(100);
  });
});

describe('safeFormatDate', () => {
  test('应该格式化有效日期', () => {
    const date = new Date('2023-12-25T00:00:00.000Z');
    const expectedFormat = date.toLocaleDateString('en-US');
    expect(safeFormatDate(date)).toBe(expectedFormat);
    expect(safeFormatDate('2023-12-25')).toMatch(/12\/2[45]\/2023/); // 允许时区差异
    expect(safeFormatDate(date.getTime())).toBe(expectedFormat);
  });

  test('应该处理无效日期', () => {
    expect(safeFormatDate('invalid date')).toBe('Invalid Date');
    expect(safeFormatDate(null)).toBe('Invalid Date');
    expect(safeFormatDate(undefined)).toBe('Invalid Date');
  });

  test('应该使用自定义fallback', () => {
    expect(safeFormatDate('invalid', 'No Date')).toBe('No Date');
  });
});

describe('createSafeProxy', () => {
  test('应该创建安全的对象代理', () => {
    const obj = { name: 'test', value: 42 };
    const proxy = createSafeProxy(obj, { name: 'fallback', other: 'default' });
    
    expect(proxy.name).toBe('test');
    expect(proxy.value).toBe(42);
    expect((proxy as any).other).toBe('default');
    expect((proxy as any).nonexistent).toBeUndefined();
  });

  test('应该处理null对象', () => {
    const proxy = createSafeProxy(null, { name: 'fallback' });
    expect((proxy as any).name).toBe('fallback');
    expect((proxy as any).other).toBeUndefined();
  });
});

describe('safeBatchGet', () => {
  test('应该批量获取对象属性', () => {
    const obj = { 
      name: 'test', 
      nested: { value: 42 },
      other: 'data'
    };
    
    const paths = ['name', 'nested.value', 'nonexistent'];
    const fallbacks = ['default_name', 0, 'default_other'];
    
    const result = safeBatchGet(obj, paths, fallbacks);
    expect(result).toEqual(['test', 42, 'default_other']);
  });

  test('应该处理无fallbacks的情况', () => {
    const obj = { name: 'test' };
    const paths = ['name', 'nonexistent'];
    
    const result = safeBatchGet(obj, paths);
    expect(result).toEqual(['test', undefined]);
  });
});

describe('safeMobileObjectName', () => {
  test('应该安全地获取移动端对象名称', () => {
    const response = {
      user: { name: 'John Doe' },
      vendor: { name: 'Vendor Corp' }
    };
    
    expect(safeMobileObjectName(response, 'user')).toBe('John Doe');
    expect(safeMobileObjectName(response, 'vendor')).toBe('Vendor Corp');
  });

  test('应该处理字符串对象', () => {
    const response = {
      location: 'Lab Room 101'
    };
    
    expect(safeMobileObjectName(response, 'location')).toBe('Lab Room 101');
  });

  test('应该处理不存在的对象', () => {
    const response = {};
    
    expect(safeMobileObjectName(response, 'nonexistent')).toBe('Unknown');
    expect(safeMobileObjectName(response, 'nonexistent', 'title', 'Custom Fallback')).toBe('Custom Fallback');
  });

  test('应该使用自定义名称字段', () => {
    const response = {
      item: { title: 'Item Title', name: 'Item Name' }
    };
    
    expect(safeMobileObjectName(response, 'item', 'title')).toBe('Item Title');
    expect(safeMobileObjectName(response, 'item', 'name')).toBe('Item Name');
  });
});

// 集成测试：模拟真实的移动端错误场景
describe('移动端对象访问错误场景集成测试', () => {
  test('应该处理MobileInventoryCard中的vendor访问', () => {
    const testCases = [
      { vendor: 'String Vendor', expected: 'String Vendor' },
      { vendor: { name: 'Object Vendor' }, expected: 'Object Vendor' },
      { vendor: undefined, expected: 'Unknown Vendor' },
      { vendor: null, expected: 'Unknown Vendor' },
      { vendor: {}, expected: 'Unknown Vendor' },
      { vendor: { other_field: 'value' }, expected: 'Unknown Vendor' }
    ];

    testCases.forEach(({ vendor, expected }) => {
      expect(safeGetVendorName(vendor)).toBe(expected);
    });
  });

  test('应该处理MobileRequestCard中的用户访问', () => {
    const testCases = [
      { requested_by: 'john_doe', expected: 'john_doe' },
      { requested_by: { username: 'jane_doe' }, expected: 'jane_doe' },
      { requested_by: { name: 'John Smith' }, expected: 'John Smith' },
      { requested_by: { first_name: 'Jane' }, expected: 'Jane' },
      { requested_by: { email: 'user@example.com' }, expected: 'user@example.com' },
      { requested_by: undefined, expected: 'Unknown User' },
      { requested_by: null, expected: 'Unknown User' },
      { requested_by: {}, expected: 'Unknown User' }
    ];

    testCases.forEach(({ requested_by, expected }) => {
      expect(safeGetUserName(requested_by)).toBe(expected);
    });
  });

  test('应该处理复杂嵌套对象访问', () => {
    const complexData = {
      user: {
        profile: {
          personal: {
            name: 'Deep Name'
          }
        }
      },
      broken: {
        chain: null
      }
    };

    expect(safeGet(complexData, 'user.profile.personal.name')).toBe('Deep Name');
    expect(safeGet(complexData, 'broken.chain.value')).toBeUndefined();
    expect(safeGet(complexData, 'broken.chain.value', 'fallback')).toBe('fallback');
    expect(safeGet(complexData, 'nonexistent.path.value')).toBeUndefined();
  });

  test('应该处理API响应中的混合数据类型', () => {
    const apiResponse = {
      items: [
        { 
          name: 'Item 1', 
          vendor: { name: 'Vendor 1' },
          location: 'String Location',
          user: { username: 'user1' }
        },
        { 
          name: 'Item 2', 
          vendor: undefined,
          location: { name: 'Object Location' },
          user: null
        },
        { 
          name: 'Item 3', 
          vendor: 'String Vendor',
          location: null,
          user: { name: 'User Name' }
        }
      ]
    };

    const items = apiResponse.items;
    
    // 测试vendor访问
    expect(safeGetVendorName(items[0].vendor)).toBe('Vendor 1');
    expect(safeGetVendorName(items[1].vendor)).toBe('Unknown Vendor');
    expect(safeGetVendorName(items[2].vendor)).toBe('String Vendor');
    
    // 测试location访问
    expect(safeGetLocationName(items[0].location)).toBe('String Location');
    expect(safeGetLocationName(items[1].location)).toBe('Object Location');
    expect(safeGetLocationName(items[2].location)).toBe('Unknown Location');
    
    // 测试user访问
    expect(safeGetUserName(items[0].user)).toBe('user1');
    expect(safeGetUserName(items[1].user)).toBe('Unknown User');
    expect(safeGetUserName(items[2].user)).toBe('User Name');
  });

  test('应该处理错误抛出场景', () => {
    // 模拟访问会抛出错误的对象
    const problematicObject = {};
    Object.defineProperty(problematicObject, 'name', {
      get() {
        throw new Error('Property access error');
      }
    });

    // safeGet应该捕获错误并返回fallback
    expect(safeGet(problematicObject, 'name', 'fallback')).toBe('fallback');
    expect(console.error).toHaveBeenCalled();
  });
});