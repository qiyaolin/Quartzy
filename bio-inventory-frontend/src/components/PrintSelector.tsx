import React, { useState, useEffect } from 'react';
import { Settings, Printer, Cloud, AlertCircle } from 'lucide-react';
import BarcodeComponent from './BarcodeComponent';
import CentralizedBarcodeComponent from './CentralizedBarcodeComponent';
import { printingService } from '../services/printingService';

interface PrintSelectorProps {
  barcodeData: string;
  itemName: string;
  itemId?: string;
  onPrint?: () => void;
  showControls?: boolean;
  allowTextEdit?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

type PrintMode = 'auto' | 'local' | 'centralized';

const PrintSelector: React.FC<PrintSelectorProps> = (props) => {
  const [printMode, setPrintMode] = useState<PrintMode>('auto');
  const [centralizationAvailable, setCentralizationAvailable] = useState<boolean | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Check if centralized printing is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await printingService.isServiceAvailable();
        setCentralizationAvailable(available);
        
        // Auto-select centralized if available, otherwise fall back to local
        if (printMode === 'auto') {
          setPrintMode(available ? 'centralized' : 'local');
        }
      } catch (error) {
        console.warn('Failed to check centralized printing availability:', error);
        setCentralizationAvailable(false);
        if (printMode === 'auto') {
          setPrintMode('local');
        }
      }
    };

    checkAvailability();
  }, [printMode]);

  const getPrintModeInfo = (mode: PrintMode) => {
    switch (mode) {
      case 'centralized':
        return {
          icon: <Cloud className="w-4 h-4" />,
          label: 'Centralized Printing',
          description: 'Print via shared lab printer',
          available: centralizationAvailable === true
        };
      case 'local':
        return {
          icon: <Printer className="w-4 h-4" />,
          label: 'Local Printing',
          description: 'Print to your local DYMO printer',
          available: true
        };
      case 'auto':
        return {
          icon: <Settings className="w-4 h-4" />,
          label: 'Auto Select',
          description: 'Automatically choose best option',
          available: true
        };
      default:
        return {
          icon: <Settings className="w-4 h-4" />,
          label: 'Unknown',
          description: '',
          available: false
        };
    }
  };

  const currentModeInfo = getPrintModeInfo(printMode);
  const effectiveMode = printMode === 'auto' 
    ? (centralizationAvailable ? 'centralized' : 'local')
    : printMode;

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="bg-gray-50 rounded-lg p-3 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {currentModeInfo.icon}
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {currentModeInfo.label}
              </h4>
              <p className="text-xs text-gray-600">
                {currentModeInfo.description}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowModeSelector(!showModeSelector)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
          >
            <Settings className="w-4 h-4" />
            <span>Change</span>
          </button>
        </div>

        {/* Mode Selection Dropdown */}
        {showModeSelector && (
          <div className="mt-3 space-y-2">
            {(['auto', 'centralized', 'local'] as PrintMode[]).map((mode) => {
              const modeInfo = getPrintModeInfo(mode);
              const isSelected = printMode === mode;
              const isDisabled = !modeInfo.available;
              
              return (
                <button
                  key={mode}
                  onClick={() => {
                    if (!isDisabled) {
                      setPrintMode(mode);
                      setShowModeSelector(false);
                    }
                  }}
                  disabled={isDisabled}
                  className={`w-full text-left p-2 rounded border flex items-center space-x-2 ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-200 text-blue-900' 
                      : isDisabled
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {modeInfo.icon}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{modeInfo.label}</div>
                    <div className="text-xs opacity-75">{modeInfo.description}</div>
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                  {isDisabled && mode === 'centralized' && (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Availability Status */}
        {centralizationAvailable === false && printMode === 'centralized' && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <p className="text-xs text-yellow-800">
              Centralized printing service is not available. Falling back to local printing.
            </p>
          </div>
        )}
      </div>

      {/* Print Component */}
      {effectiveMode === 'centralized' ? (
        <CentralizedBarcodeComponent {...props} />
      ) : (
        <BarcodeComponent {...props} />
      )}

      {/* Status Info */}
      <div className="text-xs text-gray-500 text-center">
        {effectiveMode === 'centralized' 
          ? 'Using centralized printing - your label will be printed on the shared lab printer'
          : 'Using local printing - make sure your DYMO printer is connected and ready'
        }
      </div>
    </div>
  );
};

export default PrintSelector;