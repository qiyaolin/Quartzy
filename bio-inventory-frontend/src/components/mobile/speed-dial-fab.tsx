import { useState } from 'react';
import { Plus, PlusCircle, ScanLine } from 'lucide-react';

interface SpeedDialFabProps {
  onAddItem?: () => void;
  onScanConsume?: () => void;
}

const SpeedDialFab: React.FC<SpeedDialFabProps> = ({ onAddItem, onScanConsume }) => {
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
      label: 'Scan Label', 
      icon: <ScanLine className="w-6 h-6" />, 
      onClick: onScanConsume || (() => {
        alert('Labeled item scan requires camera access');
      })
    },
  ];

  return (
    <div
      className="fixed right-4 z-50 pointer-events-none"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div className="relative flex items-end">
        {/* 背景遮罩 */}
        <div 
          className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-all duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsOpen(false)}
        />
        
        {/* 动作按钮容器 */}
        <div
          className={`absolute bottom-full right-0 mb-3 z-50 flex flex-col items-end transition-opacity duration-200 ${
            isOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {actions.map((action, index) => (
            <div 
              key={index} 
              className={`mb-4 flex items-center gap-3 transition-all duration-300 ease-out ${
                isOpen 
                  ? 'opacity-100 translate-y-0 scale-100' 
                  : 'opacity-0 translate-y-4 scale-90'
              }`}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
              }}
            >
              {/* 标签 */}
              <div className={`min-w-[112px] whitespace-nowrap text-center bg-white/95 backdrop-blur-sm text-sm text-gray-700 rounded-xl px-4 py-2 shadow-lg border border-white/20 transition-all duration-200 ${
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
          className={`pointer-events-auto z-50 relative overflow-hidden rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-110 active:scale-95 ${
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
