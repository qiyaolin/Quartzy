import { QueryClient } from 'react-query';

// Configure React Query client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      cacheTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Refetch on mount if data is stale
      refetchOnMount: true,
      // Don't refetch on reconnect
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

// API base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Enhanced fetch function with error handling
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Token ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${url}`, config);

  if (!response.ok) {
    if (response.status === 401) {
      // Handle authentication error
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication failed');
    }
    throw new Error(`HTTP Error: ${response.status}`);
  }

  return response.json();
};

// Query keys factory
export const queryKeys = {
  all: ['api'] as const,
  items: () => [...queryKeys.all, 'items'] as const,
  itemsList: (filters?: any) => [...queryKeys.items(), 'list', filters] as const,
  itemsDetail: (id: number) => [...queryKeys.items(), 'detail', id] as const,
  requests: () => [...queryKeys.all, 'requests'] as const,
  requestsList: (filters?: any) => [...queryKeys.requests(), 'list', filters] as const,
  requestsDetail: (id: number) => [...queryKeys.requests(), 'detail', id] as const,
  funding: () => [...queryKeys.all, 'funding'] as const,
  fundingList: (filters?: any) => [...queryKeys.funding(), 'list', filters] as const,
  notifications: () => [...queryKeys.all, 'notifications'] as const,
  settings: () => [...queryKeys.all, 'settings'] as const,
  users: () => [...queryKeys.all, 'users'] as const,
};

// Prefetch utilities
export const prefetchQueries = {
  items: (filters?: any) => {
    return queryClient.prefetchQuery(
      queryKeys.itemsList(filters),
      () => fetchWithAuth('/items/', { method: 'GET' })
    );
  },
  requests: (filters?: any) => {
    return queryClient.prefetchQuery(
      queryKeys.requestsList(filters),
      () => fetchWithAuth('/requests/', { method: 'GET' })
    );
  },
};

// Cache invalidation utilities
export const invalidateQueries = {
  items: () => queryClient.invalidateQueries(queryKeys.items()),
  requests: () => queryClient.invalidateQueries(queryKeys.requests()),
  funding: () => queryClient.invalidateQueries(queryKeys.funding()),
  all: () => queryClient.invalidateQueries(queryKeys.all),
};