import * as XLSX from 'xlsx';
import { formatDateET } from './timezone.ts';

export interface ExportConfig {
  fileName: string;
  sheetName: string;
  data: any[];
  headers?: string[];
  title?: string;
  summary?: { [key: string]: any };
}

export interface MultiSheetConfig {
  fileName: string;
  sheets: {
    name: string;
    data: any[];
    headers?: string[];
    title?: string;
  }[];
  summary?: { [key: string]: any };
}

const formatDate = (date: Date): string => {
  return formatDateET(date);
};

const applyHeaderStyle = (ws: XLSX.WorkSheet, range: XLSX.Range) => {
  if (!ws['!cols']) ws['!cols'] = [];
  
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellRef]) continue;
    
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F81BD" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { auto: 1 } },
        bottom: { style: "thin", color: { auto: 1 } },
        left: { style: "thin", color: { auto: 1 } },
        right: { style: "thin", color: { auto: 1 } }
      }
    };
    
    if (!ws['!cols'][C]) ws['!cols'][C] = {};
    ws['!cols'][C].width = Math.max(15, Math.min(50, (ws[cellRef].v?.toString().length || 10) * 1.2));
  }
};

const applyDataStyle = (ws: XLSX.WorkSheet, range: XLSX.Range) => {
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) continue;
      
      ws[cellRef].s = {
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { auto: 1 } },
          bottom: { style: "thin", color: { auto: 1 } },
          left: { style: "thin", color: { auto: 1 } },
          right: { style: "thin", color: { auto: 1 } }
        },
        fill: { fgColor: { rgb: R % 2 === 0 ? "F2F2F2" : "FFFFFF" } }
      };
    }
  }
};

const addTitleAndSummary = (ws: XLSX.WorkSheet, title?: string, summary?: { [key: string]: any }): number => {
  let startRow = 0;
  
  if (title) {
    XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: `A${startRow + 1}` });
    const titleCell = ws[`A${startRow + 1}`];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, size: 16, color: { rgb: "2F4F4F" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "E6F3FF" } }
      };
    }
    
    if (!ws['!merges']) ws['!merges'] = [];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    ws['!merges'].push({
      s: { r: startRow, c: 0 },
      e: { r: startRow, c: Math.max(3, range.e.c) }
    });
    
    startRow += 2;
  }
  
  if (summary) {
    const summaryData = Object.entries(summary).map(([key, value]) => [
      key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      value
    ]);
    
    XLSX.utils.sheet_add_aoa(ws, [['摘要信息', '']], { origin: `A${startRow + 1}` });
    XLSX.utils.sheet_add_aoa(ws, summaryData, { origin: `A${startRow + 2}` });
    
    const summaryHeaderCell = ws[`A${startRow + 1}`];
    if (summaryHeaderCell) {
      summaryHeaderCell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "8B4513" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    
    for (let i = 0; i < summaryData.length; i++) {
      const keyCell = ws[`A${startRow + 2 + i}`];
      const valueCell = ws[`B${startRow + 2 + i}`];
      
      if (keyCell) {
        keyCell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "F0F8FF" } },
          alignment: { horizontal: "right", vertical: "center" }
        };
      }
      
      if (valueCell) {
        valueCell.s = {
          alignment: { horizontal: "left", vertical: "center" },
          fill: { fgColor: { rgb: "FFFFFF" } }
        };
      }
    }
    
    startRow += summaryData.length + 3;
  }
  
  return startRow;
};

export const exportToExcel = (config: ExportConfig): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([]);
  
  let currentRow = addTitleAndSummary(ws, config.title, config.summary);
  
  if (config.data.length > 0) {
    const headers = config.headers || Object.keys(config.data[0]);
    const formattedData = config.data.map(item => {
      const row: any = {};
      headers.forEach(header => {
        let value = item[header];
        if (value instanceof Date) {
          value = formatDate(value);
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value, null, 2);
        }
        row[header] = value || '';
      });
      return row;
    });
    
    XLSX.utils.sheet_add_json(ws, formattedData, {
      origin: `A${currentRow + 1}`,
      header: headers
    });
    
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const dataRange = {
      s: { r: currentRow, c: 0 },
      e: { r: range.e.r, c: headers.length - 1 }
    };
    
    applyHeaderStyle(ws, dataRange);
    applyDataStyle(ws, dataRange);
  }
  
  ws['!rows'] = [{ hpt: 25 }];
  
  XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
  
  const fileName = `${config.fileName}-${formatDate(new Date())}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportMultiSheetExcel = (config: MultiSheetConfig): void => {
  const wb = XLSX.utils.book_new();
  
  config.sheets.forEach((sheetConfig, index) => {
    const ws = XLSX.utils.json_to_sheet([]);
    let currentRow = 0;
    
    if (index === 0 && config.summary) {
      currentRow = addTitleAndSummary(ws, sheetConfig.title, config.summary);
    } else if (sheetConfig.title) {
      currentRow = addTitleAndSummary(ws, sheetConfig.title);
    }
    
    if (sheetConfig.data.length > 0) {
      const headers = sheetConfig.headers || Object.keys(sheetConfig.data[0]);
      const formattedData = sheetConfig.data.map(item => {
        const row: any = {};
        headers.forEach(header => {
          let value = item[header];
          if (value instanceof Date) {
            value = formatDate(value);
          } else if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value, null, 2);
          }
          row[header] = value || '';
        });
        return row;
      });
      
      XLSX.utils.sheet_add_json(ws, formattedData, {
        origin: `A${currentRow + 1}`,
        header: headers
      });
      
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const dataRange = {
        s: { r: currentRow, c: 0 },
        e: { r: range.e.r, c: headers.length - 1 }
      };
      
      applyHeaderStyle(ws, dataRange);
      applyDataStyle(ws, dataRange);
    }
    
    ws['!rows'] = [{ hpt: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetConfig.name);
  });
  
  const fileName = `${config.fileName}-${formatDate(new Date())}.xlsx`;
  XLSX.writeFile(wb, fileName);
};