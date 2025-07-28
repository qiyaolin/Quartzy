import React, { useState, useCallback } from 'react';
import { Printer, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { printingService, LabelData } from '../services/printingService';

interface CentralizedBarcodeComponentProps {
  barcodeData: string;
  itemName: string;
  itemId?: string;
  onPrint?: () => void;
  showControls?: boolean;
  allowTextEdit?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

const CentralizedBarcodeComponent: React.FC<CentralizedBarcodeComponentProps> = ({ 
  barcodeData, 
  itemName,
  itemId,
  onPrint, 
  showControls = true,
  allowTextEdit = false,
  priority = 'normal'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  
  // Editable text settings
  const [customText, setCustomText] = useState(itemName);
  const [fontSize, setFontSize] = useState(8);
  const [isBold, setIsBold] = useState(false);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const handlePrint = async () => {
    if (isLoading) return;
    
    clearMessages();
    setIsLoading(true);

    try {
      const labelData: LabelData = {
        itemName: customText || itemName,
        barcode: barcodeData,
        itemId,
        customText: customText !== itemName ? customText : undefined,
        fontSize: fontSize !== 8 ? fontSize : undefined,
        isBold: isBold || undefined,
      };

      const job = await printingService.queuePrintJob({
        label_data: labelData,
        priority
      });

      setLastJobId(job.id);
      setSuccess(`Print job #${job.id} queued successfully! Your label will be printed shortly.`);
      
      if (onPrint) {
        onPrint();
      }
      
    } catch (err: any) {
      console.error('Print failed:', err);
      
      // Handle different types of errors
      if (err.response?.status === 401) {
        setError('Please log in to print labels.');
      } else if (err.response?.status === 400) {
        const errorData = err.response.data;
        if (errorData.label_data) {
          setError(`Invalid label data: ${JSON.stringify(errorData.label_data)}`);
        } else {
          setError(`Print request failed: ${JSON.stringify(errorData)}`);
        }
      } else if (err.response?.status >= 500) {
        setError('Print server is currently unavailable. Please try again later.');
      } else {
        setError(`Print failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkJobStatus = async () => {
    if (!lastJobId) return;
    
    try {
      const job = await printingService.getPrintJob(lastJobId);
      
      switch (job.status) {
        case 'pending':
          setSuccess(`Job #${job.id} is waiting in the print queue.`);
          break;
        case 'processing':
          setSuccess(`Job #${job.id} is currently being printed.`);
          break;
        case 'completed':
          setSuccess(`Job #${job.id} completed successfully!`);
          break;
        case 'failed':
          setError(`Job #${job.id} failed: ${job.error_message || 'Unknown error'}`);
          break;
      }
    } catch (err) {
      setError('Failed to check job status.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'normal': return 'text-blue-600';
      case 'low': return 'text-gray-600';
      default: return 'text-blue-600';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[priority as keyof typeof colors]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Centralized Label Printing
        </h3>
        <div className="text-sm text-gray-600 mb-4">
          <p><strong>Item:</strong> {itemName}</p>
          <p><strong>Barcode:</strong> {barcodeData}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span><strong>Priority:</strong></span>
            {getPriorityBadge(priority)}
          </div>
        </div>
      </div>

      {/* Text Editing Controls */}
      {allowTextEdit && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Customize Label Text</h4>
          <div className="space-y-3">
            <div>
              <label htmlFor="customText" className="block text-xs font-medium text-gray-600 mb-1">
                Label Text
              </label>
              <input
                type="text"
                id="customText"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter label text..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fontSize" className="block text-xs font-medium text-gray-600 mb-1">
                  Font Size
                </label>
                <select
                  id="fontSize"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value={6}>6pt</option>
                  <option value={7}>7pt</option>
                  <option value={8}>8pt</option>
                  <option value={9}>9pt</option>
                  <option value={10}>10pt</option>
                  <option value={11}>11pt</option>
                  <option value={12}>12pt</option>
                  <option value={14}>14pt</option>
                  <option value={16}>16pt</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Style
                </label>
                <div className="flex items-center pt-2">
                  <input
                    type="checkbox"
                    id="isBold"
                    checked={isBold}
                    onChange={(e) => setIsBold(e.target.checked)}
                    className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isBold" className="text-sm text-gray-700">
                    Bold
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 flex items-start">
          <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={clearMessages}
              className="text-red-600 hover:text-red-800 text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-green-700 text-sm">{success}</p>
            {lastJobId && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={checkJobStatus}
                  className="text-green-600 hover:text-green-800 text-xs underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Check Status
                </button>
                <button
                  onClick={clearMessages}
                  className="text-green-600 hover:text-green-800 text-xs underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="flex justify-center space-x-3">
          <button
            onClick={handlePrint}
            disabled={isLoading}
            className={`btn btn-primary btn-sm flex items-center space-x-2 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Queueing...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Queue Print Job</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>How it works:</strong> Your print request will be sent to the central print server. 
          The label will be printed on the lab's shared printer automatically.
        </p>
      </div>
    </div>
  );
};

export default CentralizedBarcodeComponent;