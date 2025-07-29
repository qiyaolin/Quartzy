import React from 'react';
import { PlusCircle, Search, Upload, Download, X } from 'lucide-react';
import SidebarFilter from './SidebarFilter.tsx';

const RequestsSidebar = ({ onAddRequestClick, filters, onFilterChange, filterOptions, isMobile = false, onClose, onExportData, onImportData }) => (
    <aside className={`sidebar ${isMobile ? 'w-80' : 'w-72'} p-4 md:p-6 flex flex-col h-full animate-fade-in bg-white shadow-xl`}>
        {/* 移动端关闭按钮 */}
        {isMobile && (
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Request Filters</h2>
                <button 
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Close sidebar"
                >
                    <X className="w-5 h-5 text-gray-600" />
                </button>
            </div>
        )}
        
        <div className="flex-grow overflow-y-auto space-y-6">
            <div className="space-y-4">
                <button onClick={onAddRequestClick} className="btn btn-primary w-full py-3 text-base font-semibold shadow-soft hover:shadow-medium transition-all duration-200 hover:-translate-y-0.5">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    <span>New Request</span>
                </button>
                
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search requests..." 
                        className="input pl-10 bg-secondary-50/50 border-secondary-200"
                        onChange={(e) => onFilterChange('search', e.target.value)}
                        value={filters.search || ''}
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                </div>
            </div>
            
            <div>
                <h3 className="text-xs font-bold uppercase text-secondary-400 tracking-wider mb-4">Filters</h3>
                <div className="space-y-1">
                    <SidebarFilter title="Vendor" options={filterOptions.vendors} selected={filters.vendor} onFilterChange={(id) => onFilterChange('vendor', id)} />
                    <SidebarFilter title="Requested By" options={filterOptions.users} selected={filters.requested_by} onFilterChange={(id) => onFilterChange('requested_by', id)} />
                </div>
            </div>
        </div>
        
        <div className="pt-6 border-t border-secondary-200 space-y-2">
            <button 
                onClick={onImportData}
                className="btn btn-secondary w-full justify-center py-2.5 hover:bg-secondary-100 transition-all duration-200"
            >
                <Upload className="w-4 h-4 mr-2" />
                <span>Import Data</span>
            </button>
            <button 
                onClick={onExportData}
                className="btn btn-secondary w-full justify-center py-2.5 hover:bg-secondary-100 transition-all duration-200"
            >
                <Download className="w-4 h-4 mr-2" />
                <span>Export Data</span>
            </button>
        </div>
    </aside>
);

export default RequestsSidebar;
