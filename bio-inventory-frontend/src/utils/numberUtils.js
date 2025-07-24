/**
 * Utility functions for handling number formatting and parsing in the funding system
 */

/**
 * Safely parse a value to float, returning 0 for invalid values
 * @param {any} value - The value to parse
 * @returns {number} - Parsed float or 0
 */
export const safeParseFloat = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format a number as currency with proper locale string formatting
 * @param {any} value - The value to format
 * @param {object} options - Formatting options
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, options = {}) => {
    const {
        currency = 'USD',
        minimumFractionDigits = 0,
        maximumFractionDigits = 2
    } = options;
    
    const numValue = safeParseFloat(value);
    
    if (currency === 'USD') {
        return `$${numValue.toLocaleString(undefined, {
            minimumFractionDigits,
            maximumFractionDigits
        })}`;
    }
    
    return numValue.toLocaleString(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits
    });
};

/**
 * Format a percentage with proper decimal places
 * @param {any} value - The percentage value (0-100)
 * @param {number} decimalPlaces - Number of decimal places
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value, decimalPlaces = 1) => {
    const numValue = safeParseFloat(value);
    return `${numValue.toFixed(decimalPlaces)}%`;
};

/**
 * Calculate budget utilization percentage
 * @param {any} spent - Amount spent
 * @param {any} total - Total budget
 * @returns {number} - Utilization percentage (0-100)
 */
export const calculateUtilization = (spent, total) => {
    const spentAmount = safeParseFloat(spent);
    const totalBudget = safeParseFloat(total);
    
    if (totalBudget === 0) return 0;
    return Math.min((spentAmount / totalBudget) * 100, 100);
};

/**
 * Calculate remaining budget
 * @param {any} total - Total budget
 * @param {any} spent - Amount spent
 * @returns {number} - Remaining amount
 */
export const calculateRemaining = (total, spent) => {
    const totalBudget = safeParseFloat(total);
    const spentAmount = safeParseFloat(spent);
    return totalBudget - spentAmount;
};

/**
 * Validate if a number is a valid positive amount
 * @param {any} value - The value to validate
 * @returns {boolean} - True if valid positive number
 */
export const isValidAmount = (value) => {
    const numValue = safeParseFloat(value);
    return numValue > 0;
};

/**
 * Get budget status based on utilization percentage
 * @param {number} utilizationPercent - Utilization percentage (0-100)
 * @returns {object} - Status object with type and message
 */
export const getBudgetStatus = (utilizationPercent) => {
    if (utilizationPercent >= 100) {
        return { type: 'danger', message: 'Over Budget', color: 'text-danger-600' };
    } else if (utilizationPercent >= 90) {
        return { type: 'danger', message: 'Critical', color: 'text-danger-600' };
    } else if (utilizationPercent >= 75) {
        return { type: 'warning', message: 'Warning', color: 'text-warning-600' };
    } else {
        return { type: 'success', message: 'Healthy', color: 'text-success-600' };
    }
};

/**
 * Get progress bar color class based on utilization
 * @param {number} utilizationPercent - Utilization percentage (0-100)
 * @returns {string} - CSS class name
 */
export const getProgressBarColor = (utilizationPercent) => {
    if (utilizationPercent >= 90) return 'bg-danger-500';
    if (utilizationPercent >= 75) return 'bg-warning-500';
    return 'bg-success-500';
};