/**
 * Barcode utility functions for inventory management
 */

/**
 * Generate a suggested barcode format for manual entry
 * @param itemName - Name of the item
 * @param itemType - Type of the item (optional)
 * @returns Suggested barcode string
 */
export const generateBarcodesuggestion = (itemName: string, itemType?: string): string => {
    // Remove special characters and spaces, take first 8 characters
    const cleanName = itemName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    
    // Add type prefix if available
    const typePrefix = itemType ? itemType.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3) : '';
    
    // Generate timestamp-based suffix for uniqueness
    const timestamp = Date.now().toString().slice(-4);
    
    if (typePrefix) {
        return `${typePrefix}-${cleanName}-${timestamp}`;
    }
    
    return `ITM-${cleanName}-${timestamp}`;
};

/**
 * Validate barcode format and provide suggestions
 * @param barcode - Barcode to validate
 * @returns Validation result with suggestions
 */
export const validateBarcodeFormat = (barcode: string): {
    isValid: boolean;
    suggestions: string[];
    warnings: string[];
} => {
    const suggestions: string[] = [];
    const warnings: string[] = [];
    
    if (!barcode || barcode.trim() === '') {
        suggestions.push('Leave empty for automatic generation (recommended)');
        return { isValid: true, suggestions, warnings };
    }
    
    const trimmed = barcode.trim();
    
    // Length check
    if (trimmed.length > 50) {
        warnings.push('Barcode exceeds maximum length of 50 characters');
        return { isValid: false, suggestions, warnings };
    }
    
    if (trimmed.length < 3) {
        warnings.push('Barcode should be at least 3 characters long');
        suggestions.push('Consider using a more descriptive barcode');
    }
    
    // Special characters check
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
        warnings.push('Barcode contains special characters that might cause scanning issues');
        suggestions.push('Use only letters, numbers, hyphens (-) and underscores (_)');
    }
    
    // Format suggestions
    if (!trimmed.includes('-') && trimmed.length > 6) {
        suggestions.push('Consider using hyphens for better readability (e.g., ABC-123-DEF)');
    }
    
    return {
        isValid: warnings.length === 0,
        suggestions,
        warnings
    };
};

/**
 * Common barcode format patterns
 */
export const BARCODE_PATTERNS = {
    SYSTEM_GENERATED: 'ITM-XXXXXXXX (8 random characters)',
    ITEM_TYPE: 'TYPE-ITEMNAME-#### (Type prefix + item name + number)',
    CATALOG_BASED: 'VENDOR-CATALOG (Vendor code + catalog number)',
    LOCATION_BASED: 'LOC-ITEM-### (Location + item + sequence)',
    CUSTOM: 'Your own format (letters, numbers, - and _ only)'
};

/**
 * Get barcode format examples
 */
export const getBarcodeExamples = (): string[] => [
    'ITM-A1B2C3D4 (System generated)',
    'CHM-NACL-001 (Chemical: Sodium Chloride)',
    'ABT-CD3-2024 (Antibody: CD3 marker)',
    'PLM-PUC19-V1 (Plasmid: pUC19 vector)',
    'EQP-PCR-MACHINE (Equipment: PCR Machine)'
];