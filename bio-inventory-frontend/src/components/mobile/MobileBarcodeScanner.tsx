import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Type, Scan, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { buildApiUrl } from '../../config/api.ts';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface MobileBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onConfirm: (barcode: string, itemData?: any) => void;
  title?: string;
  token: string;
}

const MobileBarcodeScanner: React.FC<MobileBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  onConfirm,
  title = 'Scan Barcode',
  token
}) => {
  const [manualInput, setManualInput] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [itemData, setItemData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBarcodeResult, setShowBarcodeResult] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  const startScanning = async (reader: BrowserMultiFormatReader, deviceId: string) => {
    try {
      setIsScanning(true);
      setScanError('');
      
      // Use continuous scanning mode
      reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
        if (result) {
          const barcode = result.getText();
          console.log('Barcode detected:', barcode);
          // Stop scanning and process result
          setIsScanning(false);
          reader.reset();
          handleBarcodeDetected(barcode);
        }
        
        if (err && !(err instanceof NotFoundException)) {
          console.error('Scanning error:', err);
          setScanError('Error scanning barcode. Please try again.');
          setIsScanning(false);
        }
        // NotFoundException is normal, means no barcode found in current frame, continue scanning
      });
    } catch (err) {
      console.error('Error starting scan:', err);
      setScanError('Failed to start camera');
      setIsScanning(false);
    }
  };

  const initializeScanner = useCallback(async () => {
    try {
      setScanError('');
      
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;
      
      // Get available video devices
      const videoInputDevices = await reader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setScanError('No camera devices found');
        setIsManualMode(true);
        return;
      }

      // Try to use back camera (environment camera)
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('environment')
      );
      
      const selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
      
      startScanning(reader, selectedDeviceId);
    } catch (error) {
      console.error('Camera access error:', error);
      setScanError('Unable to access camera. Please use manual input.');
      setIsManualMode(true);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setScanError('');
  }, []);

  useEffect(() => {
    if (isOpen && !isManualMode) {
      initializeScanner();
    }
    
    return () => {
      cleanup();
    };
  }, [isOpen, isManualMode, initializeScanner, cleanup]);

  const handleBarcodeDetected = async (barcode: string) => {
    setScannedBarcode(barcode);
    setShowBarcodeResult(true); // Show barcode result immediately
    setIsLoading(true);
    setError('');

    try {
      // Look up item data based on barcode from items endpoint
      const response = await fetch(buildApiUrl(`/api/items/?search=${barcode}`), {
        headers: {
          'Authorization': `Token ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data); // Debug log
        
        // Handle different response formats
        const items = data.results || data;
        const filteredItems = Array.isArray(items) ? items.filter((item: any) => item.barcode === barcode) : [];
        
        if (filteredItems.length > 0) {
          const item = filteredItems[0];
          // Only allow checkout if the item is not archived
          if (!item.is_archived) {
            setItemData(item);
            setShowConfirmation(true);
            onScan(barcode);
          } else {
            setError('Item has already been checked out');
          }
        } else {
          setError('No item found with this barcode');
        }
      } else {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        setError(`Failed to lookup barcode (${response.status})`);
      }
    } catch (err) {
      console.error('Barcode lookup error:', err);
      setError('Error looking up barcode');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      handleBarcodeDetected(manualInput.trim());
    }
  };

  const handleConfirm = () => {
    if (scannedBarcode) {
      onConfirm(scannedBarcode, itemData);
      handleClose();
    }
  };

  const handleClose = () => {
    cleanup();
    setManualInput('');
    setScanError('');
    setIsManualMode(false);
    setScannedBarcode('');
    setItemData(null);
    setError('');
    setShowConfirmation(false);
    setShowBarcodeResult(false);
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-primary-50">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {showBarcodeResult && scannedBarcode && !showConfirmation ? (
            // Barcode scan result view
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Scan className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="font-semibold text-blue-800">Barcode Scanned Successfully</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Scanned Code:</strong> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{scannedBarcode}</span></p>
                  <p className="text-blue-700">Looking up item information...</p>
                </div>
              </div>
              
              {isLoading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
                  <Loader className="w-5 h-5 text-blue-600 mr-2 animate-spin" />
                  <span className="text-blue-700 text-sm">Searching for item with barcode {scannedBarcode}...</span>
                </div>
              )}
            </div>
          ) : showConfirmation && itemData ? (
            // Confirmation view
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-semibold text-green-800">Item Available for Checkout</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Item:</strong> {itemData.name}</p>
                  <p><strong>Barcode:</strong> {scannedBarcode}</p>
                  {itemData.serial_number && <p><strong>Serial Number:</strong> {itemData.serial_number}</p>}
                  <p><strong>Quantity:</strong> {itemData.quantity} {itemData.unit || ''}</p>
                  {itemData.owner && <p><strong>Owner:</strong> {itemData.owner.username}</p>}
                  {itemData.vendor && <p><strong>Vendor:</strong> {typeof itemData.vendor === 'object' ? itemData.vendor.name : itemData.vendor}</p>}
                  {itemData.catalog_number && <p><strong>Catalog #:</strong> {itemData.catalog_number}</p>}
                  {itemData.location && <p><strong>Location:</strong> {typeof itemData.location === 'object' ? itemData.location.name : itemData.location}</p>}
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Confirm Checkout
                </button>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setShowBarcodeResult(false);
                    setScannedBarcode('');
                    setItemData(null);
                    setError('');
                    // Restart scanning
                    if (!isManualMode) {
                      setTimeout(() => initializeScanner(), 100);
                    }
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Scan Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Toggle */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setIsManualMode(false);
                    if (isOpen) {
                      // Restart scanner when switching back to camera mode
                      setTimeout(() => initializeScanner(), 100);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors ${
                    !isManualMode
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Camera</span>
                </button>
                <button
                  onClick={() => {
                    cleanup(); // Stop camera when switching to manual mode
                    setIsManualMode(true);
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors ${
                    isManualMode
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  <span>Manual</span>
                </button>
              </div>

          {/* Camera View */}
          {!isManualMode && (
            <div className="space-y-3">
              {scanError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-red-600 text-sm mb-3">{scanError}</div>
                  <div className="flex space-x-2 justify-center">
                    <button
                      onClick={() => {
                        setScanError('');
                        initializeScanner();
                      }}
                      className="text-primary-600 hover:text-primary-700 font-medium px-3 py-1 rounded border border-primary-200"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => setIsManualMode(true)}
                      className="text-gray-600 hover:text-gray-700 font-medium px-3 py-1 rounded border border-gray-200"
                    >
                      Use Manual Input
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 bg-gray-900 rounded-lg object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-24 border-2 border-white border-dashed rounded-lg opacity-75">
                      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-white"></div>
                      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-white"></div>
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-white"></div>
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-white"></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-center text-sm text-gray-600">
                <Scan className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                <p>Position the barcode within the frame</p>
                {isScanning ? (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    📷 Camera is actively scanning for barcodes...
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Camera ready - align barcode in the frame
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Manual Input */}
          {isManualMode && (
            <div className="space-y-4">
              <div>
                <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Barcode
                </label>
                <input
                  id="barcode"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type or paste barcode here"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg font-mono"
                  autoFocus
                />
              </div>
              
              <button
                onClick={handleManualSubmit}
                disabled={!manualInput.trim() || isLoading}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Looking up...' : 'Scan Item'}
              </button>
            </div>
          )}

          {/* Error Display */}
          {(error || scanError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-700 text-sm">{error || scanError}</span>
            </div>
          )}

          {/* Loading Display */}
          {isLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
              <Loader className="w-5 h-5 text-blue-600 mr-2 animate-spin" />
              <span className="text-blue-700 text-sm">Looking up barcode information...</span>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-blue-800 text-sm">
              <p className="font-medium mb-1">How to use:</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Use Camera mode to scan barcodes with your device camera</li>
                <li>Use Manual mode to type in the barcode number</li>
                <li>System will show item details before checkout</li>
                <li>Confirm to automatically check out the item</li>
              </ul>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileBarcodeScanner;