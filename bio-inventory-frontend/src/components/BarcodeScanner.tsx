import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Loader, Zap } from 'lucide-react';
import { buildApiUrl } from '../config/api.ts';
import { 
  ZBarBarcodeScanner as ZBarScanner, 
  ZBarBarcodeValidator,
  ZBarCameraUtils 
} from '../utils/zbarBarcodeScanner.ts';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
    onConfirm: (barcode: string, itemData?: any) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, onConfirm }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const detectorRef = useRef<ZBarScanner | null>(null);
    const [scannedBarcode, setScannedBarcode] = useState<string>('');
    const [barcodeType, setBarcodeType] = useState('');
    const [itemData, setItemData] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanningError, setScanningError] = useState<string>('');
    const [isDetectorReady, setIsDetectorReady] = useState(false);

    const initializeScanner = useCallback(async () => {
        try {
            setScanningError('');
            setIsScanning(true);
            
            // Initialize ZBar detector
            if (!detectorRef.current) {
                detectorRef.current = new ZBarScanner({
                    enableCache: true,
                    tryHarder: true,
                    enableAllFormats: true
                });
            }
            await detectorRef.current.initialize();
            setIsDetectorReady(true);
            
            // Start camera
            await startCamera();
            
        } catch (err) {
            console.error('Error initializing scanner:', err);
            setScanningError('Failed to access camera. Please ensure camera permissions are granted.');
            setIsScanning(false);
        }
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const constraints = ZBarCameraUtils.getOptimalConstraints();
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    if (videoRef.current) {
                        videoRef.current.play();
                        startScanning();
                    }
                };
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setScanningError("Unable to access camera");
        }
    }, []);

    const startScanning = useCallback(() => {
        const detectFrame = async () => {
            if (!videoRef.current || !isDetectorReady || !detectorRef.current?.isReady()) {
                animationFrameRef.current = requestAnimationFrame(detectFrame);
                return;
            }
            
            try {
                const results = await detectorRef.current.detectForVideo(videoRef.current);
                
                if (results.barcodes.length > 0) {
                    const bestDetection = results.barcodes[0];
                    const barcode = bestDetection.value;
                    
                    if (barcode && barcode.trim()) {
                        console.log('ZBar detected barcode:', bestDetection);
                        setIsScanning(false);
                        
                        // Stop animation frame
                        if (animationFrameRef.current) {
                            cancelAnimationFrame(animationFrameRef.current);
                            animationFrameRef.current = null;
                        }
                        
                        // Validate barcode
                        const validation = ZBarBarcodeValidator.validateBarcode(barcode.trim(), bestDetection.type);
                        if (!validation.isValid) {
                            setScanningError(`Invalid barcode: ${validation.errorMessage}`);
                            setTimeout(() => {
                                setScanningError('');
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
            }
            
            animationFrameRef.current = requestAnimationFrame(detectFrame);
        };
        
        detectFrame();
    }, [isDetectorReady, initializeScanner]);

    const cleanup = useCallback(() => {
        // Stop animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        
        // Stop camera stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        // Reset video element
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        
        // Cleanup detector
        if (detectorRef.current) {
            detectorRef.current.close();
            detectorRef.current = null;
        }
        
        setIsScanning(false);
        setScanningError('');
        setIsDetectorReady(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            initializeScanner();
        } else {
            cleanup();
        }

        return () => {
            cleanup();
        };
    }, [isOpen, initializeScanner, cleanup]);


    const handleBarcodeDetected = async (barcode: string, type?: string) => {
        setScannedBarcode(barcode);
        setBarcodeType(type || 'UNKNOWN');
        setIsLoading(true);
        setError('');

        try {
            // Look up item data based on barcode from items endpoint
            const response = await fetch(buildApiUrl(`/api/items/?search=${barcode}`), {
                headers: {
                    'Authorization': `Token ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('API Response:', data);
                if (data.results && data.results.length > 0) {
                    const item = data.results[0];
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
                console.error('API Error:', response.status, errorData); // Debug log
                setError(`Failed to lookup barcode (${response.status})`);
            }
        } catch (err) {
            setError('Error looking up barcode');
        } finally {
            setIsLoading(false);
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
        setScannedBarcode('');
        setBarcodeType('');
        setItemData(null);
        setError('');
        setShowConfirmation(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Zap className="w-6 h-6 mr-2 text-purple-600" />
                        ZBar Scanner
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {showConfirmation && itemData ? (
                    // Confirmation view
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                                <span className="font-semibold text-green-800">Item Available for Checkout</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <p><strong>Item:</strong> {itemData.name}</p>
                                <p><strong>Barcode:</strong> {ZBarBarcodeValidator.formatBarcodeDisplay(scannedBarcode, barcodeType)} <span className="text-gray-500">({barcodeType})</span></p>
                                <p><strong>Serial Number:</strong> {itemData.serial_number}</p>
                                <p><strong>Quantity:</strong> {itemData.quantity} {itemData.unit}</p>
                                {itemData.owner && <p><strong>Owner:</strong> {itemData.owner.username}</p>}
                                {itemData.vendor && <p><strong>Vendor:</strong> {itemData.vendor.name}</p>}
                                {itemData.catalog_number && <p><strong>Catalog #:</strong> {itemData.catalog_number}</p>}
                                {itemData.location && <p><strong>Location:</strong> {itemData.location.name}</p>}
                            </div>
                        </div>
                        
                        <div className="flex space-x-3">
                            <button
                                onClick={handleConfirm}
                                className="flex-1 btn btn-primary"
                            >
                                Confirm Checkout
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmation(false);
                                    setScannedBarcode('');
                                    setItemData(null);
                                    setError('');
                                    // Restart scanning
                                    setTimeout(() => initializeScanner(), 100);
                                }}
                                className="flex-1 btn btn-secondary"
                            >
                                Scan Again
                            </button>
                        </div>
                    </div>
                ) : (
                    // Scanner view
                    <div className="space-y-4">
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-64 object-cover"
                            />
                            
                            {/* Scan overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="border-2 border-white border-dashed rounded-lg w-48 h-24 flex items-center justify-center">
                                    {isScanning ? (
                                        <div className="flex items-center text-white text-sm font-medium">
                                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                                            Scanning...
                                        </div>
                                    ) : (
                                        <span className="text-white text-sm font-medium">Position barcode here</span>
                                    )}
                                </div>
                            </div>

                            {/* Scanning status indicator */}
                            {isScanning && isDetectorReady && (
                                <div className="absolute top-4 left-4 right-4">
                                    <div className="bg-purple-500 text-white px-3 py-2 rounded-lg text-sm flex items-center">
                                        <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                                        ⚡ ZBar WASM Scanner Active
                                    </div>
                                </div>
                            )}
                            
                            {/* Initialization indicator */}
                            {isScanning && !isDetectorReady && (
                                <div className="absolute top-4 left-4 right-4">
                                    <div className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm flex items-center">
                                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                                        Initializing ZBar WASM detector...
                                    </div>
                                </div>
                            )}
                        </div>

                        {(error || scanningError) && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                                <span className="text-red-700 text-sm">{error || scanningError}</span>
                            </div>
                        )}

                        {isLoading && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
                                <Loader className="w-5 h-5 text-blue-600 mr-2 animate-spin" />
                                <span className="text-blue-700 text-sm">Looking up barcode information...</span>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setScanningError('');
                                    setError('');
                                    // Restart scanning
                                    cleanup();
                                    setTimeout(() => initializeScanner(), 100);
                                }}
                                disabled={isLoading || isScanning}
                                className="flex-1 btn btn-primary"
                            >
                                {isScanning ? 'Scanning...' : isLoading ? 'Processing...' : 'Restart Scanner'}
                            </button>
                            <button
                                onClick={handleClose}
                                className="flex-1 btn btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarcodeScanner;