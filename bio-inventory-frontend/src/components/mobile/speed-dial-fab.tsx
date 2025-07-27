import { useState } from 'react';
import { Plus, PlusCircle, ScanLine } from 'lucide-react';
import { Button } from '../ui/button.tsx';

interface SpeedDialFabProps {
  onAddItem?: () => void;
  onScanCheckout?: () => void;
}

const SpeedDialFab: React.FC<SpeedDialFabProps> = ({ onAddItem, onScanCheckout }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { 
      label: 'Add Item', 
      icon: <PlusCircle className="w-6 h-6" />, 
      onClick: onAddItem || (() => {
        if (window.openAddItemModal) {
          window.openAddItemModal();
        } else {
          alert('Add item functionality not available');
        }
      })
    },
    { 
      label: 'Scan Out', 
      icon: <ScanLine className="w-6 h-6" />, 
      onClick: onScanCheckout || (() => {
        alert('Scan checkout feature requires camera access');
      })
    },
  ];

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <div className="relative flex flex-col items-center gap-2">
        {isOpen && (
          <div className="flex flex-col items-center gap-3">
            {actions.map((action, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="bg-white text-sm text-gray-700 rounded-md px-2 py-1 shadow-sm">
                  {action.label}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white rounded-full w-12 h-12 shadow-md flex items-center justify-center"
                  onClick={action.onClick}
                >
                  {action.icon}
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          size="icon"
          className={`rounded-full w-16 h-16 bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-transform duration-300 flex items-center justify-center ${isOpen ? 'rotate-45' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Plus className="w-8 h-8" />
        </Button>
      </div>
    </div>
  );
};

export default SpeedDialFab;