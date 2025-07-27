import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { buildApiUrl } from '../config/api.ts';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
    onConfirm: (barcode: string, itemData?: any) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, onConfirm }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [codeReader, setCodeReader] = useState<BrowserMultiFormatReader | null>(null);
    const [scannedBarcode, setScannedBarcode] = useState<string>('');
    const [itemData, setItemData] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanningError, setScanningError] = useState<string>('');

    const initializeScanner = useCallback(async () => {
        try {
            const reader = new BrowserMultiFormatReader();
            setCodeReader(reader);
            
            // 获取可用的视频设备
            const videoInputDevices = await reader.listVideoInputDevices();
            
            if (videoInputDevices.length === 0) {
                setScanningError('No camera devices found');
                return;
            }

            // 尝试使用后置摄像头（环境摄像头）
            const backCamera = videoInputDevices.find(device => 
                device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('environment')
            );
            
            const selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
            
            startScanning(reader, selectedDeviceId);
        } catch (err) {
            console.error('Error initializing scanner:', err);
            setScanningError('Failed to initialize camera scanner');
        }
    }, []);

    const cleanup = useCallback(() => {
        if (codeReader) {
            codeReader.reset();
        }
        setIsScanning(false);
        setScanningError('');
    }, [codeReader]);

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

    const startScanning = async (reader: BrowserMultiFormatReader, deviceId: string) => {
        try {
            setIsScanning(true);
            setScanningError('');
            
            // 使用连续扫描模式
            reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
                if (result) {
                    const barcode = result.getText();
                    console.log('Barcode detected:', barcode);
                    // 停止扫描并处理结果
                    setIsScanning(false);
                    reader.reset();
                    handleBarcodeDetected(barcode);
                }
                
                if (err && !(err instanceof NotFoundException)) {
                    console.error('Scanning error:', err);
                    setScanningError('Error scanning barcode. Please try again.');
                    setIsScanning(false);
                }
                // NotFoundException 是正常的，表示当前帧没有找到条形码，继续扫描
            });
        } catch (err) {
            console.error('Error starting scan:', err);
            setScanningError('Failed to start camera');
            setIsScanning(false);
        }
    };

    const handleBarcodeDetected = async (barcode: string) => {
        setScannedBarcode(barcode);
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
                console.log('API Response:', data); // Debug log
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
        setScannedBarcode('');
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
                        <Camera className="w-6 h-6 mr-2" />
                        Scan Barcode
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
                                <p><strong>Barcode:</strong> {scannedBarcode}</p>
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
                                    // 重新开始扫描
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
                            {isScanning && (
                                <div className="absolute top-4 left-4 right-4">
                                    <div className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm flex items-center">
                                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                                        Camera is actively scanning for barcodes...
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
                                    if (codeReader && videoRef.current) {
                                        // 重新开始扫描
                                        cleanup();
                                        setTimeout(() => initializeScanner(), 100);
                                    }
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