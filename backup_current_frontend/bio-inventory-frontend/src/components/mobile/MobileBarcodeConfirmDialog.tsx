import React from 'react';
import { X, Printer, Package } from 'lucide-react';

interface MobileBarcodeConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  barcode: string;
}

const MobileBarcodeConfirmDialog: React.FC<MobileBarcodeConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  barcode
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 mx-4 w-full max-w-sm animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Print Barcode</h2>
              <p className="text-sm text-gray-500">Confirm to print label</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
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

          {/* Confirmation Message */}
          <div className="text-center py-2">
            <p className="text-gray-700 font-medium">
              Do you want to print the barcode label for this item?
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Make sure your printer is connected and ready.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={handleConfirm}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
          >
            <Printer className="w-5 h-5" />
            <span>Print Label</span>
          </button>
          
          <button
            onClick={onClose}
            className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileBarcodeConfirmDialog;