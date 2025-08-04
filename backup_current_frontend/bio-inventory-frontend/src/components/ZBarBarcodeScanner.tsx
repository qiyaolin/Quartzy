import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Type, CheckCircle, AlertCircle, Loader, Zap } from 'lucide-react';
import { buildApiUrl } from '../config/api';
import { 
  ZBarBarcodeScanner as ZBarScanner, 
  ZBarBarcodeValidator,
  ZBarCameraUtils 
} from '../utils/zbarBarcodeScanner';

interface ZBarBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onConfirm: (barcode: string, itemData?: any) => void;
  title?: string;
  token: string;
}

const ZBarBarcodeScanner: React.FC<ZBarBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  onConfirm,
  title = 'ZBar WASM Scanner',
  token
}) => {
  const [manualInput, setManualInput] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [barcodeType, setBarcodeType] = useState('');
  const [itemData, setItemData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBarcodeResult, setShowBarcodeResult] = useState(false);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [scanStats, setScanStats] = useState<{
    detectedCount: number;
    lastScanTime: string;
    scanQuality: number;
  }>({ detectedCount: 0, lastScanTime: '', scanQuality: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<ZBarScanner | null>(null);

  const startDetection = useCallback(() => {
    const detectFrame = async () => {
      if (!videoRef.current || !isDetectorReady || !detectorRef.current?.isReady()) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      
      try {
        const results = await detectorRef.current.detectForVideo(videoRef.current);
        
        if (results.barcodes.length > 0) {
          const bestDetection = results.barcodes[0]; // 取质量最好的检测结果
          const barcode = bestDetection.value;
          
          if (barcode && barcode.trim()) {
            console.log('ZBar detected barcode:', bestDetection);
            setIsScanning(false);
            
            // 停止动画帧
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
            
            // 更新扫描统计
            setScanStats(prev => ({
              detectedCount: prev.detectedCount + 1,
              lastScanTime: new Date().toLocaleTimeString(),
              scanQuality: bestDetection.quality
            }));

            // 验证条形码
            const validation = ZBarBarcodeValidator.validateBarcode(barcode.trim(), bestDetection.type);
            if (!validation.isValid) {
              setScanError(`Invalid barcode: ${validation.errorMessage}`);
              // 重新开始扫描
              setTimeout(() => {
                setScanError('');
                initializeScanner();
              }, 2000);
              return;
            }
            
            handleBarcodeDetected(barcode.trim(), bestDetection.type);
            return;
          }
        }
      } catch (err) {
        console.error('ZBar detection error:', err);
        // 继续扫描
      }
      
      // 继续检测循环
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };
    
    detectFrame();
  }, [isDetectorReady]);

  const initializeScanner = useCallback(async () => {
    try {
      setScanError('');
      setIsScanning(true);
      
      // 初始化ZBar检测器
      if (!detectorRef.current) {
        detectorRef.current = new ZBarScanner({
          enableCache: true,
          tryHarder: true,
          enableAllFormats: true
        });
      }
      await detectorRef.current.initialize();
      setIsDetectorReady(true);
      
      // 获取相机流
      const constraints = ZBarCameraUtils.getOptimalConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            startDetection();
          }
        };
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setScanError('Unable to access camera. Please use manual input.');
      setIsManualMode(true);
      setIsScanning(false);
    }
  }, [startDetection]);

  const cleanup = useCallback(() => {
    // 停止动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 停止相机流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // 重置视频元素
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // 清理检测器
    if (detectorRef.current) {
      detectorRef.current.close();
      detectorRef.current = null;
    }
    
    setIsScanning(false);
    setScanError('');
    setIsDetectorReady(false);
  }, []);

  useEffect(() => {
    if (isOpen && !isManualMode) {
      initializeScanner();
    }
    
    return () => {
      cleanup();
    };
  }, [isOpen, isManualMode, initializeScanner, cleanup]);

  const handleBarcodeDetected = async (barcode: string, type: string) => {
    setScannedBarcode(barcode);
    setBarcodeType(type);
    setShowBarcodeResult(true);
    setIsLoading(true);
    setError('');

    try {
      // 查找基于条形码的物品数据
      const response = await fetch(buildApiUrl(`/api/items/?search=${barcode}`), {
        headers: {
          'Authorization': `Token ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        
        const items = data.results || data;
        const filteredItems = Array.isArray(items) ? items.filter((item: any) => item.barcode === barcode) : [];
        
        if (filteredItems.length > 0) {
          const item = filteredItems[0];
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
      handleBarcodeDetected(manualInput.trim(), 'MANUAL');
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
    setBarcodeType('');
    setItemData(null);
    setError('');
    setShowConfirmation(false);
    setShowBarcodeResult(false);
    setIsLoading(false);
    setScanStats({ detectedCount: 0, lastScanTime: '', scanQuality: 0 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center">
            <Zap className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
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
            // 条形码扫描结果视图
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Zap className="w-5 h-5 text-purple-600 mr-2" />
                  <span className="font-semibold text-purple-800">ZBar WASM Detection Success</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Scanned Code:</strong> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{ZBarBarcodeValidator.formatBarcodeDisplay(scannedBarcode, barcodeType)}</span></p>
                  <p><strong>Format:</strong> <span className="bg-blue-100 px-2 py-1 rounded text-blue-800">{barcodeType}</span></p>
                  <p><strong>Quality:</strong> <span className="bg-green-100 px-2 py-1 rounded text-green-800">{scanStats.scanQuality}/100</span></p>
                  <p className="text-purple-700">Looking up item information...</p>
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
            // 确认视图
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-semibold text-green-800">Item Available for Checkout</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Item:</strong> {itemData.name}</p>
                  <p><strong>Barcode:</strong> {ZBarBarcodeValidator.formatBarcodeDisplay(scannedBarcode, barcodeType)} <span className="text-gray-500">({barcodeType})</span></p>
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
                    setBarcodeType('');
                    setItemData(null);
                    setError('');
                    // 重新开始扫描
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
              {/* 模式切换 */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setIsManualMode(false);
                    if (isOpen) {
                      setTimeout(() => initializeScanner(), 100);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors ${
                    !isManualMode
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>ZBar Camera</span>
                </button>
                <button
                  onClick={() => {
                    cleanup();
                    setIsManualMode(true);
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors ${
                    isManualMode
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  <span>Manual</span>
                </button>
              </div>

              {/* 相机视图 */}
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
                          className="text-purple-600 hover:text-purple-700 font-medium px-3 py-1 rounded border border-purple-200"
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
                    <Zap className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                    <p>Position the barcode within the frame</p>
                    {isScanning && isDetectorReady ? (
                      <p className="text-xs text-purple-600 mt-1 font-medium">
                        ⚡ ZBar WASM scanning active - align barcode in frame
                      </p>
                    ) : isScanning ? (
                      <p className="text-xs text-blue-600 mt-1 font-medium">
                        🔄 Initializing ZBar WASM detector...
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        Camera ready - align barcode in the frame
                      </p>
                    )}
                  </div>

                  {/* 扫描统计 */}
                  {scanStats.detectedCount > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="text-purple-800 text-xs">
                        <p><strong>Scan Statistics:</strong></p>
                        <p>Detected: {scanStats.detectedCount} barcodes</p>
                        {scanStats.lastScanTime && <p>Last scan: {scanStats.lastScanTime}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 手动输入 */}
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg font-mono"
                      autoFocus
                    />
                  </div>
                  
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim() || isLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    {isLoading ? 'Looking up...' : 'Scan Item'}
                  </button>
                </div>
              )}

              {/* 错误显示 */}
              {(error || scanError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-700 text-sm">{error || scanError}</span>
                </div>
              )}

              {/* 加载显示 */}
              {isLoading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
                  <Loader className="w-5 h-5 text-blue-600 mr-2 animate-spin" />
                  <span className="text-blue-700 text-sm">Looking up barcode information...</span>
                </div>
              )}

              {/* 使用说明 */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="text-purple-800 text-sm">
                  <p className="font-medium mb-1 flex items-center">
                    <Zap className="w-4 h-4 mr-1" />
                    ZBar WebAssembly Scanner:
                  </p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>High-performance WASM barcode detection</li>
                    <li>Supports QR, EAN, UPC, Code-128 and more</li>
                    <li>Real-time multi-barcode detection capability</li>
                    <li>Automatic barcode format validation</li>
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

export default ZBarBarcodeScanner;