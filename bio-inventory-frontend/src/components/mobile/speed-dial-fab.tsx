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
    <div className="fixed bottom-24 right-4 z-50">
      <div className="relative flex flex-col items-center">
        {/* 背景遮罩 */}
        <div 
          className={`fixed inset-0 bg-black/20 backdrop-blur-sm transition-all duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsOpen(false)}
        />
        
        {/* 动作按钮容器 */}
        <div className="relative flex flex-col items-center">
          {actions.map((action, index) => (
            <div 
              key={index} 
              className={`flex items-center gap-3 mb-4 transition-all duration-300 ease-out ${
                isOpen 
                  ? 'opacity-100 translate-y-0 scale-100' 
                  : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
              }`}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
              }}
            >
              {/* 标签 */}
              <div className={`bg-white/95 backdrop-blur-sm text-sm text-gray-700 rounded-xl px-3 py-2 shadow-lg border border-white/20 transition-all duration-200 ${
                isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
              }`}
              style={{
                transitionDelay: isOpen ? `${index * 50 + 100}ms` : '0ms'
              }}>
                {action.label}
              </div>
              
              {/* 动作按钮 */}
              <button
                className="bg-white/95 backdrop-blur-sm hover:bg-white rounded-full w-12 h-12 shadow-lg hover:shadow-xl border border-white/30 hover:border-blue-200 flex items-center justify-center transition-all duration-200 transform hover:scale-110 active:scale-95 hover:shadow-blue-500/20"
                onClick={action.onClick}
              >
                <div className="text-blue-600 hover:text-blue-700 transition-colors duration-200">
                  {action.icon}
                </div>
              </button>
            </div>
          ))}
        </div>
        
        {/* 主按钮 */}
        <button
          className={`rounded-full flex items-center justify-center relative overflow-hidden text-white shadow-lg hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-110 active:scale-95 ${
            isOpen ? 'rotate-45 shadow-blue-500/40' : 'rotate-0'
          }`}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
          }}
        >
          {/* 按钮背景动画效果 */}
          <div className={`absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-full transition-all duration-300 ${
            isOpen ? 'scale-110 opacity-100' : 'scale-100 opacity-0'
          }`} />
          
          {/* 图标 */}
          <Plus className={`w-6 h-6 relative z-10 transition-all duration-300 ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`} />
          
          {/* 脉冲效果 */}
          <div className={`absolute inset-0 rounded-full bg-blue-400/20 transition-all duration-1000 ${
            isOpen ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
          }`} 
          style={{
            animation: isOpen ? 'none' : 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }} />
        </button>
      </div>
    </div>
  );
};

export default SpeedDialFab;