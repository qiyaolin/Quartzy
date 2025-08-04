import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Package, AlertCircle } from 'lucide-react';
import { printingService } from '../services/printingService';
import { useNotification } from '../contexts/NotificationContext';

interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  barcode: string;
  itemId?: string | number;
  customText?: string;
  allowTextEdit?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

const PrintBarcodeModal: React.FC<PrintBarcodeModalProps> = ({
  isOpen,
  onClose,
  itemName,
  barcode,
  itemId,
  customText,
  allowTextEdit = false,
  priority = 'normal'
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editableText, setEditableText] = useState(customText || itemName);
  const [fontSize, setFontSize] = useState(8);
  const [isBold, setIsBold] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>(priority);
  const notification = useNotification();

  if (!isOpen) return null;

  const handlePrintConfirm = async () => {
    if (!barcode) {
      notification.error('No barcode available for printing');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await printingService.printItemLabel(itemName, barcode, {
        itemId: itemId?.toString(),
        priority: selectedPriority,
        customText: editableText,
        fontSize,
        isBold
      });

      notification.success(`Print job queued successfully! Job ID: ${result.id}`);
      onClose();
    } catch (error: any) {
      console.error('Print job submission error:', error);
      notification.error(`Failed to queue print job: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 mx-4 w-full max-w-md animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Print Barcode Label</h2>
              <p className="text-sm text-gray-500">Send to centralized printer</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Item Info */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Item Details</span>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-600">Name:</span>
                <p className="text-gray-900 font-medium">{itemName}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Barcode:</span>
                <p className="text-gray-900 font-mono text-sm bg-white px-2 py-1 rounded border">
                  {barcode}
                </p>
              </div>
            </div>
          </div>

          {/* Label Customization */}
          {allowTextEdit && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Customize Label</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="labelText" className="block text-xs font-medium text-gray-600 mb-1">
                    Label Text
                  </label>
                  <input
                    type="text"
                    id="labelText"
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={6}>6pt</option>
                      <option value={7}>7pt</option>
                      <option value={8}>8pt</option>
                      <option value={9}>9pt</option>
                      <option value={10}>10pt</option>
                      <option value={12}>12pt</option>
                      <option value={14}>14pt</option>
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
                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

          {/* Priority Selection */}
          <div className="bg-yellow-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Print Priority</h4>
            <div className="grid grid-cols-2 gap-2">
              {(['low', 'normal', 'high', 'urgent'] as const).map((priorityOption) => (
                <button
                  key={priorityOption}
                  onClick={() => setSelectedPriority(priorityOption)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedPriority === priorityOption
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {priorityOption.charAt(0).toUpperCase() + priorityOption.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Information Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Centralized Printing</p>
                <p>This print job will be sent to the lab's centralized print server. The label will be printed automatically when the printer is available.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={handlePrintConfirm}
            disabled={isSubmitting || !barcode}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Queueing...</span>
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                <span>Queue Print Job</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintBarcodeModal;