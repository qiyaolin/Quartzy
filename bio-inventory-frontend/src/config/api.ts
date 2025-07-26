// API 配置文件
// 使用环境变量来配置 API 基础 URL

// 从环境变量获取 API 基础 URL，如果没有则使用默认值
const getApiBaseUrl = (): string => {
  // 在浏览器环境中，React 应用只能访问以 REACT_APP_ 开头的环境变量
  const envApiUrl = process.env.REACT_APP_API_BASE_URL;
  
  if (envApiUrl) {
    return envApiUrl;
  }
  
  // 如果没有环境变量，根据当前域名判断
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000';
    }
  }
  
  // 默认使用生产环境 URL
  return 'https://lab-inventory-467021.nn.r.appspot.com';
};

export const API_BASE_URL = getApiBaseUrl();

// API 端点构建函数
export const buildApiUrl = (endpoint: string): string => {
  // 确保端点以 / 开头
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

// 常用的 API 端点
export const API_ENDPOINTS = {
  // 认证相关
  LOGIN: '/api/login/',
  USER_ME: '/api/users/me/',
  
  // 用户管理
  USERS: '/api/users/',
  
  // 物品管理
  ITEMS: '/api/items/',
  ITEMS_REPORTS: '/api/items/reports/',
  ITEMS_EXPIRING: '/api/items/expiring_this_month/',
  ITEMS_ALERTS: '/api/items/alerts/',
  ITEMS_BATCH_ARCHIVE: '/api/items/batch_archive/',
  ITEMS_BATCH_DELETE: '/api/items/batch_delete/',
  
  // 请求管理
  REQUESTS: '/api/requests/',
  REQUESTS_BATCH_APPROVE: '/api/requests/batch_approve/',
  REQUESTS_BATCH_REJECT: '/api/requests/batch_reject/',
  REQUESTS_BATCH_REORDER: '/api/requests/batch_reorder/',
  REQUESTS_BATCH_PLACE_ORDER: '/api/requests/batch_place_order/',
  REQUESTS_BATCH_MARK_RECEIVED: '/api/requests/batch_mark_received/',
  
  // 基础数据
  VENDORS: '/api/vendors/',
  LOCATIONS: '/api/locations/',
  ITEM_TYPES: '/api/item-types/',
  
  // 资金管理
  FUNDS: '/api/funds/',
  TRANSACTIONS: '/api/transactions/',
  BUDGET_SUMMARY: '/api/budget-summary/',
  
  // 通知
  NOTIFICATIONS: '/api/notifications/',
  NOTIFICATIONS_SUMMARY: '/api/notifications/summary/',
  NOTIFICATIONS_MARK_ALL_READ: '/api/notifications/mark_all_read/',
};

console.log(`API 配置: 使用 API 基础 URL = ${API_BASE_URL}`);