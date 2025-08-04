import React from 'react';
import { useDevice } from '../hooks/useDevice';

interface Column {
  key: string;
  label: string;
  render?: (value: any, item: any) => React.ReactNode;
  sortable?: boolean;
  mobileHidden?: boolean; // 移动端隐藏此列
  mobileOnly?: boolean; // 仅移动端显示
}

interface MobileOptimizedTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  mobileCardView?: boolean; // 移动端使用卡片视图
}

const MobileOptimizedTable: React.FC<MobileOptimizedTableProps> = ({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  mobileCardView = false
}) => {
  const device = useDevice();

  // 过滤移动端显示的列
  const visibleColumns = columns.filter(col => {
    if (device.isMobile) {
      return !col.mobileHidden;
    }
    return !col.mobileOnly;
  });

  // 移动端卡片视图渲染
  if (device.isMobile && mobileCardView) {
    return (
      <div className="space-y-3">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="loading-spinner" />
          </div>
        )}
        
        {!loading && data.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {emptyMessage}
          </div>
        )}
        
        {!loading && data.map((item, index) => (
          <div
            key={index}
            className={`card p-4 ${onRowClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={() => onRowClick && onRowClick(item)}
          >
            <div className="space-y-2">
              {visibleColumns.map(col => {
                const value = item[col.key];
                const displayValue = col.render ? col.render(value, item) : value;
                
                return (
                  <div key={col.key} className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600 min-w-0 flex-1">
                      {col.label}:
                    </span>
                    <span className="text-sm text-gray-900 ml-2 text-right">
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 桌面端或移动端表格视图
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead className="table-header">
          <tr>
            {visibleColumns.map(col => (
              <th key={col.key} className="table-header-cell">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table-body">
          {loading && (
            <tr>
              <td colSpan={visibleColumns.length} className="table-cell text-center py-8">
                <div className="flex justify-center">
                  <div className="loading-spinner" />
                </div>
              </td>
            </tr>
          )}
          
          {!loading && data.length === 0 && (
            <tr>
              <td colSpan={visibleColumns.length} className="table-cell text-center py-8 text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
          
          {!loading && data.map((item, index) => (
            <tr
              key={index}
              className={`table-row ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {visibleColumns.map(col => {
                const value = item[col.key];
                const displayValue = col.render ? col.render(value, item) : value;
                
                return (
                  <td key={col.key} className="table-cell">
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MobileOptimizedTable;