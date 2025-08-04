import React, { useState } from 'react';
import { Plus, Package, FileText, X, Camera } from 'lucide-react';

interface FloatingAction {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  color: string;
}

interface MobileFloatingActionButtonProps {
  primaryAction?: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    onClick: () => void;
  };
  actions?: FloatingAction[];
}

const MobileFloatingActionButton: React.FC<MobileFloatingActionButtonProps> = ({
  primaryAction,
  actions = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePrimaryClick = () => {
    if (actions.length > 0) {
      setIsExpanded(!isExpanded);
    } else if (primaryAction) {
      primaryAction.onClick();
    }
  };

  const handleActionClick = (action: FloatingAction) => {
    action.onClick();
    setIsExpanded(false);
  };

  const PrimaryIcon = primaryAction?.icon || Plus;

  return (
    <>
      {/* Overlay */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      <div className="fixed bottom-20 right-4 z-50">
        {/* Secondary actions */}
        {isExpanded && actions.length > 0 && (
          <div className="mb-4 space-y-3">
            {actions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center justify-end animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="mr-3 bg-gray-900 text-white px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap shadow-lg">
                    {action.label}
                  </span>
                  <button
                    onClick={() => handleActionClick(action)}
                    className={`w-12 h-12 ${action.color} text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center`}
                  >
                    <ActionIcon size={20} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Primary button */}
        <button
          onClick={handlePrimaryClick}
          className={`w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center ${
            isExpanded ? 'rotate-45' : ''
          }`}
        >
          {isExpanded && actions.length > 0 ? (
            <X size={24} />
          ) : (
            <PrimaryIcon size={24} />
          )}
        </button>
      </div>
    </>
  );
};

// Pre-configured FAB for inventory page
export const InventoryFAB: React.FC<{
  onAddItem: () => void;
  onScanBarcode: () => void;
}> = ({ onAddItem, onScanBarcode }) => {
  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end space-y-3">
      {/* Camera button for scan barcode checkout */}
      <button
        onClick={onScanBarcode}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
        title="Scan Barcode Checkout"
      >
        <Camera size={20} />
      </button>
      
      {/* Main Add Item button */}
      <button
        onClick={onAddItem}
        className="w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
        title="Add Item"
      >
        <Plus size={24} />
      </button>
    </div>
  );
};

// Pre-configured FAB for requests page
export const RequestsFAB: React.FC<{
  onAddRequest: () => void;
}> = ({ onAddRequest }) => {
  return (
    <MobileFloatingActionButton
      primaryAction={{
        icon: Plus,
        onClick: onAddRequest
      }}
    />
  );
};

export default MobileFloatingActionButton;