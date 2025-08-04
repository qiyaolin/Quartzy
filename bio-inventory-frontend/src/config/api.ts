// API Configuration File
// Configure API base URL using environment variables

// Get API base URL from environment variables, use default if not available
const getApiBaseUrl = (): string => {
  // In browser environment, React apps can only access environment variables starting with REACT_APP_
  const envApiUrl = process.env.REACT_APP_API_BASE_URL;
  
  if (envApiUrl) {
    return envApiUrl;
  }
  
  // If no environment variable, determine based on current domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000';
    }
  }
  
  // Default to production environment URL
  return 'https://lab-inventory-467021.nn.r.appspot.com';
};

export const API_BASE_URL = getApiBaseUrl();

// API endpoint builder function - fix undefined errors
export const buildApiUrl = (endpoint: string): string => {
  // Ensure API_BASE_URL and endpoint are not undefined
  const baseUrl = API_BASE_URL || 'https://lab-inventory-467021.nn.r.appspot.com';
  const safeEndpoint = endpoint || '';
  
  // Ensure endpoint starts with /
  const cleanEndpoint = safeEndpoint.startsWith('/') ? safeEndpoint : `/${safeEndpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/login/',
  USER_ME: '/api/users/me/',
  
  // User Management
  USERS: '/api/users/',
  
  // Item Management
  ITEMS: '/api/items/',
  ITEMS_REPORTS: '/api/items/reports/',
  ITEMS_EXPIRING: '/api/items/expiring_this_month/',
  ITEMS_ALERTS: '/api/items/alerts/',
  ITEMS_BATCH_ARCHIVE: '/api/items/batch_archive/',
  ITEMS_BATCH_DELETE: '/api/items/batch_delete/',
  
  // Request Management
  REQUESTS: '/api/requests/',
  REQUESTS_BATCH_APPROVE: '/api/requests/batch_approve/',
  REQUESTS_BATCH_REJECT: '/api/requests/batch_reject/',
  REQUESTS_BATCH_REORDER: '/api/requests/batch_reorder/',
  REQUESTS_BATCH_PLACE_ORDER: '/api/requests/batch_place_order/',
  REQUESTS_BATCH_MARK_RECEIVED: '/api/requests/batch_mark_received/',
  
  // Base Data
  VENDORS: '/api/vendors/',
  LOCATIONS: '/api/locations/',
  ITEM_TYPES: '/api/item-types/',
  
  // Fund Management
  FUNDS: '/api/funds/',
  TRANSACTIONS: '/api/transactions/',
  BUDGET_SUMMARY: '/api/budget-summary/',
  
  // Notifications
  NOTIFICATIONS: '/api/notifications/',
  NOTIFICATIONS_SUMMARY: '/api/notifications/summary/',
  NOTIFICATIONS_MARK_ALL_READ: '/api/notifications/mark_all_read/',
  
  // Dashboard Statistics - Added missing endpoint
  DASHBOARD_STATS: '/api/dashboard/stats/',
  
  // Schedule Management
  SCHEDULES: '/api/schedules/',
};

console.log(`API Configuration: Using API Base URL = ${API_BASE_URL}`);