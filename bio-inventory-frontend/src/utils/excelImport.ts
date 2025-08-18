import * as XLSX from 'xlsx';

export interface ImportResult {
  data: any[];
  errors: string[];
  totalRows: number;
  validRows: number;
}

export interface ImportConfig {
  requiredFields: string[];
  fieldMapping?: { [key: string]: string };
  validateRow?: (row: any, index: number) => string[];
}

const normalizeHeaders = (headers: string[]): string[] => {
  return headers.map(header => 
    header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
  );
};

const mapFields = (row: any, fieldMapping?: { [key: string]: string }): any => {
  if (!fieldMapping) return row;
  
  const mappedRow: any = {};
  Object.keys(row).forEach(key => {
    const mappedKey = fieldMapping[key] || key;
    mappedRow[mappedKey] = row[key];
  });
  
  return mappedRow;
};

const validateRequiredFields = (row: any, requiredFields: string[], rowIndex: number): string[] => {
  const errors: string[] = [];
  
  requiredFields.forEach(field => {
    if (!row[field] || (typeof row[field] === 'string' && row[field].trim() === '')) {
      errors.push(`Row ${rowIndex + 1}: Missing required field '${field}'`);
    }
  });
  
  return errors;
};

export const parseFileToJSON = (file: File): Promise<ImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          raw: false 
        }) as any[][];
        
        if (jsonData.length < 2) {
          resolve({
            data: [],
            errors: ['File must contain at least a header row and one data row'],
            totalRows: 0,
            validRows: 0
          });
          return;
        }
        
        // Extract headers and normalize
        const headers = normalizeHeaders(jsonData[0] as string[]);
        const dataRows = jsonData.slice(1);
        
        // Convert rows to objects
        const parsedData = dataRows.map((row, index) => {
          const rowObj: any = {};
          headers.forEach((header, headerIndex) => {
            rowObj[header] = row[headerIndex] || '';
          });
          return rowObj;
        });
        
        resolve({
          data: parsedData,
          errors: [],
          totalRows: parsedData.length,
          validRows: parsedData.length
        });
        
      } catch (error) {
        resolve({
          data: [],
          errors: [`Failed to parse file: ${error.message}`],
          totalRows: 0,
          validRows: 0
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        data: [],
        errors: ['Failed to read file'],
        totalRows: 0,
        validRows: 0
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
};

export const validateImportData = (data: any[], config: ImportConfig): ImportResult => {
  const errors: string[] = [];
  const validData: any[] = [];
  
  data.forEach((row, index) => {
    // Map fields if mapping provided
    const mappedRow = mapFields(row, config.fieldMapping);
    
    // Validate required fields
    const fieldErrors = validateRequiredFields(mappedRow, config.requiredFields, index);
    errors.push(...fieldErrors);
    
    // Custom validation if provided
    if (config.validateRow) {
      const customErrors = config.validateRow(mappedRow, index);
      errors.push(...customErrors);
    }
    
    // If no errors for this row, add to valid data
    if (fieldErrors.length === 0 && (!config.validateRow || config.validateRow(mappedRow, index).length === 0)) {
      validData.push(mappedRow);
    }
  });
  
  return {
    data: validData,
    errors,
    totalRows: data.length,
    validRows: validData.length
  };
};

export const processImportFile = async (file: File, config: ImportConfig): Promise<ImportResult> => {
  // Parse file
  const parseResult = await parseFileToJSON(file);
  
  if (parseResult.errors.length > 0) {
    return parseResult;
  }
  
  // Validate data
  const validationResult = validateImportData(parseResult.data, config);
  
  return {
    data: validationResult.data,
    errors: [...parseResult.errors, ...validationResult.errors],
    totalRows: parseResult.totalRows,
    validRows: validationResult.validRows
  };
};

// Inventory-specific validation
export const validateInventoryRow = (row: any, index: number): string[] => {
  const errors: string[] = [];
  
  if (row.quantity && isNaN(parseFloat(row.quantity))) {
    errors.push(`Row ${index + 1}: Quantity must be a number`);
  }
  
  if (row.unit_price && isNaN(parseFloat(row.unit_price))) {
    errors.push(`Row ${index + 1}: Unit price must be a number`);
  }
  
  if (row.minimum_quantity && isNaN(parseFloat(row.minimum_quantity))) {
    errors.push(`Row ${index + 1}: Minimum quantity must be a number`);
  }
  
  return errors;
};

// Request-specific validation
export const validateRequestRow = (row: any, index: number): string[] => {
  const errors: string[] = [];
  
  if (row.quantity && isNaN(parseFloat(row.quantity))) {
    errors.push(`Row ${index + 1}: Quantity must be a number`);
  }
  
  if (row.unit_price && isNaN(parseFloat(row.unit_price))) {
    errors.push(`Row ${index + 1}: Unit price must be a number`);
  }
  
  const validUrgencyLevels = ['low', 'medium', 'high'];
  if (row.urgency && !validUrgencyLevels.includes(row.urgency.toLowerCase())) {
    errors.push(`Row ${index + 1}: Urgency must be one of: ${validUrgencyLevels.join(', ')}`);
  }
  
  return errors;
};