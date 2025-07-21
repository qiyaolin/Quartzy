import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;
    
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="text-secondary-600">
                Showing <span className="font-medium text-secondary-900">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> to{' '}
                <span className="font-medium text-secondary-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
                <span className="font-medium text-secondary-900">{totalItems}</span> results
            </div>
            <div className="flex items-center space-x-1">
                <button 
                    onClick={() => onPageChange(1)} 
                    disabled={currentPage === 1} 
                    className="p-2 rounded-lg hover:bg-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-secondary-600 hover:text-secondary-900"
                    title="First page"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => onPageChange(currentPage - 1)} 
                    disabled={currentPage === 1} 
                    className="p-2 rounded-lg hover:bg-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-secondary-600 hover:text-secondary-900"
                    title="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-4 py-2 text-secondary-700">
                    <span className="font-medium">Page {currentPage}</span>
                    <span className="text-secondary-500"> of {totalPages}</span>
                </div>
                <button 
                    onClick={() => onPageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages} 
                    className="p-2 rounded-lg hover:bg-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-secondary-600 hover:text-secondary-900"
                    title="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => onPageChange(totalPages)} 
                    disabled={currentPage === totalPages} 
                    className="p-2 rounded-lg hover:bg-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-secondary-600 hover:text-secondary-900"
                    title="Last page"
                >
                    <ChevronsRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
