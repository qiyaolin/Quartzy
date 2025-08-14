/**
 * Timezone utility functions for consistent Eastern Time handling
 */

// Eastern Time timezone identifier
export const EASTERN_TIME_ZONE = 'America/New_York';

/**
 * Convert a date to Eastern Time and format as YYYY-MM-DD
 */
export const formatDateET = (date: Date | string): string => {
  let d: Date;
  if (typeof date === 'string') {
    // Handle date strings properly - interpret as ET timezone noon to avoid timezone shifting
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // For YYYY-MM-DD format, create date at noon ET to avoid timezone issues
      d = new Date(date + 'T12:00:00');
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

/**
 * Convert a date to Eastern Time and format as readable date string
 */
export const formatDateTimeET = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
};

/**
 * Convert a date to Eastern Time and format time only
 */
export const formatTimeET = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
};

/**
 * Get current date in Eastern Time as YYYY-MM-DD
 */
export const getCurrentDateET = (): string => {
  return formatDateET(new Date());
};

/**
 * Get current datetime in Eastern Time
 */
export const getCurrentDateTimeET = (): Date => {
  return new Date();
};

/**
 * Convert a date string (YYYY-MM-DD) to a Date object in Eastern Time
 */
export const parseDateET = (dateString: string): Date => {
  // Create date at noon to avoid timezone shifting issues
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateString + 'T12:00:00');
  }
  // For other formats, try to parse as ET timezone
  const etDateString = `${dateString}T00:00:00-05:00`;
  return new Date(etDateString);
};

/**
 * Check if a date is today in Eastern Time
 */
export const isTodayET = (date: Date | string): boolean => {
  const today = getCurrentDateET();
  const targetDate = formatDateET(date);
  return today === targetDate;
};

/**
 * Get relative time string in Eastern Time (e.g., "2 hours ago", "in 3 days")
 */
export const getRelativeTimeET = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // Convert to Eastern Time for comparison
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
  
  const targetET = new Date(etFormatter.format(d));
  const nowET = new Date(etFormatter.format(now));
  
  const diffMs = targetET.getTime() - nowET.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (Math.abs(diffMins) < 1) return 'just now';
  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `in ${diffMins} min${diffMins !== 1 ? 's' : ''}` : `${Math.abs(diffMins)} min${Math.abs(diffMins) !== 1 ? 's' : ''} ago`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}` : `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ago`;
  }
  
  return diffDays > 0 ? `in ${diffDays} day${diffDays !== 1 ? 's' : ''}` : `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
};

/**
 * Format date for HTML date inputs (YYYY-MM-DD) in Eastern Time
 */
export const formatDateForInput = (date?: Date | string): string => {
  if (!date) return getCurrentDateET();
  return formatDateET(date);
};