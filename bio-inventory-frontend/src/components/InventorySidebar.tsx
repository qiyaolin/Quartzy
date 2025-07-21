import React from 'react';
import { PlusCircle, Search, Upload, Download } from 'lucide-react';
import SidebarFilter from './SidebarFilter.tsx';

const InventorySidebar = ({ onAddItemClick, filters, onFilterChange, filterOptions }) => (
    <aside className="sidebar w-72 p-4 md:p-6 flex flex-col h-full animate-fade-in hidden lg:flex">
        <div className="flex-grow overflow-y-auto space-y-6">
            <div className="space-y-4">
                <button onClick={onAddItemClick} className="btn btn-primary w-full py-3 text-base font-semibold shadow-soft hover:shadow-medium transition-all duration-200 hover:-translate-y-0.5">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    <span>Add New Item</span>
                </button>
                
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search inventory..." 
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
                    <SidebarFilter title="Location" options={filterOptions.locations} selected={filters.location} onFilterChange={(id) => onFilterChange('location', id)} />
                    <SidebarFilter title="Type" options={filterOptions.itemTypes} selected={filters.item_type} onFilterChange={(id) => onFilterChange('item_type', id)} />
                    <SidebarFilter title="Vendor" options={filterOptions.vendors} selected={filters.vendor} onFilterChange={(id) => onFilterChange('vendor', id)} />
                </div>
            </div>
        </div>
        
        <div className="pt-6 border-t border-secondary-200 space-y-2">
            <button className="btn btn-secondary w-full justify-center py-2.5 hover:bg-secondary-100 transition-all duration-200">
                <Upload className="w-4 h-4 mr-2" />
                <span>Import Data</span>
            </button>
            <button className="btn btn-secondary w-full justify-center py-2.5 hover:bg-secondary-100 transition-all duration-200">
                <Download className="w-4 h-4 mr-2" />
                <span>Export Data</span>
            </button>
        </div>
    </aside>
);

export default InventorySidebar;
