// 数据验证和容错工具函数

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

/**
 * 验证并标准化过滤选项数据
 */
export const validateFilterOptions = (data: any[]): FilterOption[] => {
  if (!Array.isArray(data)) {
    console.warn('Filter options data is not an array:', data);
    return [];
  }

  return data
    .filter(item => item && typeof item === 'object')
    .map(item => {
      // 尝试多种可能的字段名组合
      const label = item.name || item.label || item.title || item.username || String(item.id || '');
      const value = item.id || item.value || item.name || item.label;

      if (!label || (value === undefined || value === null)) {
        console.warn('Invalid filter option item:', item);
        return null;
      }

      // Ensure label and value are not objects
      if (typeof label === 'object' || typeof value === 'object') {
        console.warn('Filter option label or value is an object, which is not allowed:', item);
        return null;
      }

      return {
        label: String(label),
        value: String(value)
      };
    })
    .filter(Boolean) as FilterOption[];
};

/**
 * 安全的API数据获取
 */
export const safeApiCall = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { data, success: true };
  } catch (error) {
    console.error('API call failed:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    };
  }
};

/**
 * 验证对象是否具有必需的属性
 */
export const validateObjectStructure = (
  obj: any,
  requiredFields: string[],
  objectName = 'Object'
): boolean => {
  if (!obj || typeof obj !== 'object') {
    console.error(`${objectName} is not a valid object:`, obj);
    return false;
  }

  const missingFields = requiredFields.filter(field => !(field in obj));
  if (missingFields.length > 0) {
    console.error(`${objectName} missing required fields:`, missingFields, obj);
    return false;
  }

  return true;
};

/**
 * 安全的数组映射，处理可能的null/undefined值
 */
export const safeArrayMap = <T, R>(
  array: T[] | null | undefined,
  mapFn: (item: T, index: number) => R,
  fallback: R[] = []
): R[] => {
  if (!Array.isArray(array)) {
    console.warn('Expected array but got:', typeof array, array);
    return fallback;
  }

  try {
    return array
      .filter(item => item !== null && item !== undefined)
      .map(mapFn);
  } catch (error) {
    console.error('Error in array mapping:', error);
    return fallback;
  }
};

/**
 * 深度克隆对象，避免引用问题
 */
export const deepClone = <T>(obj: T): T => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('Deep clone failed:', error);
    return obj;
  }
};

/**
 * 检查是否为移动端设备
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.innerWidth < 768 || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * 安全的本地存储操作
 */
export const safeLocalStorage = {
  get: (key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('LocalStorage get error:', error);
      return defaultValue;
    }
  },
  
  set: (key: string, value: any): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('LocalStorage set error:', error);
      return false;
    }
  },
  
  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('LocalStorage remove error:', error);
      return false;
    }
  }
};

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

/**
 * Format error messages to be more user-friendly
 */
export const formatErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  
  if (error?.message) {
    // Handle common network errors
    if (error.message.includes('Failed to fetch')) {
      return 'Network connection failed. Please check your connection and try again.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again later.';
    }
    if (error.message.includes('401')) {
      return 'Authentication failed. Please log in again.';
    }
    if (error.message.includes('403')) {
      return 'Insufficient permissions to perform this action.';
    }
    if (error.message.includes('404')) {
      return 'The requested resource was not found.';
    }
    if (error.message.includes('500')) {
      return 'Server internal error. Please try again later.';
    }
    
    return error.message;
  }
  
  return 'An unknown error occurred. Please try again later.';
};
