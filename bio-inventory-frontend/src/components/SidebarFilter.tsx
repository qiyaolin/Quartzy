import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const SidebarFilter = ({ title, options, selected, onFilterChange }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="py-4 border-b border-secondary-200">
            <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
                <h4 className="font-semibold text-secondary-700 group-hover:text-secondary-900 transition-colors">{title}</h4>
                <ChevronDown className={`w-5 h-5 text-secondary-400 group-hover:text-secondary-600 transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="mt-3 max-h-48 overflow-y-auto space-y-2 animate-slide-up">
                    {(Array.isArray(options) ? options : []).map(option => (
                        <div key={option.id} className="flex items-center group">
                            <input 
                                type="checkbox" 
                                id={`${title}-${option.id}`} 
                                checked={selected.includes(option.id)}
                                onChange={() => onFilterChange(option.id)}
                                className="checkbox" />
                            <label htmlFor={`${title}-${option.id}`} className="ml-2 text-secondary-600 group-hover:text-secondary-900 cursor-pointer transition-colors text-sm">
                                {option.username || option.name || option.email || option.id}
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SidebarFilter;
