import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
    onConfirm: (barcode: string, itemData?: any) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, onConfirm }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [scannedBarcode, setScannedBarcode] = useState<string>('');
    const [itemData, setItemData] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            setError('Could not access camera. Please ensure camera permissions are enabled.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const captureFrame = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            // Here you would typically use a barcode scanning library like QuaggaJS or ZXing
            // For demo purposes, we'll simulate barcode detection
            simulateBarcodeDetection(canvas);
        }
    };

    const simulateBarcodeDetection = (canvas: HTMLCanvasElement) => {
        // This is a simulation - in real implementation, you'd use a barcode scanning library
        // For now, we'll allow manual input for testing
        const manualBarcode = prompt('Enter barcode (simulation):');
        if (manualBarcode) {
            handleBarcodeDetected(manualBarcode);
        }
    };

    const handleBarcodeDetected = async (barcode: string) => {
        setScannedBarcode(barcode);
        setIsLoading(true);
        setError('');

        try {
            // Look up item data based on barcode - first check requests (items that have been received)
            const response = await fetch(`http://127.0.0.1:8000/api/requests/?barcode=${barcode}`, {
                headers: {
                    'Authorization': `Token ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const request = data.results[0];
                    // Only allow checkout if the request has been received (is now in inventory)
                    if (request.status === 'RECEIVED') {
                        setItemData(request);
                        setShowConfirmation(true);
                        onScan(barcode);
                    } else {
                        setError(`Item not available for checkout. Status: ${request.status}`);
                    }
                } else {
                    setError('No item found with this barcode');
                }
            } else {
                setError('Failed to lookup barcode');
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
                                <p><strong>Item:</strong> {itemData.item_name}</p>
                                <p><strong>Barcode:</strong> {scannedBarcode}</p>
                                <p><strong>Status:</strong> {itemData.status}</p>
                                <p><strong>Originally requested by:</strong> {itemData.requested_by?.username}</p>
                                {itemData.vendor && <p><strong>Vendor:</strong> {itemData.vendor.name}</p>}
                                {itemData.catalog_number && <p><strong>Catalog #:</strong> {itemData.catalog_number}</p>}
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
                                onClick={() => setShowConfirmation(false)}
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
                                className="w-full h-64 object-cover"
                            />
                            <canvas
                                ref={canvasRef}
                                style={{ display: 'none' }}
                            />
                            
                            {/* Scan overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="border-2 border-white border-dashed rounded-lg w-48 h-24 flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">Position barcode here</span>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                                <span className="text-red-700 text-sm">{error}</span>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={captureFrame}
                                disabled={isLoading}
                                className="flex-1 btn btn-primary"
                            >
                                {isLoading ? 'Processing...' : 'Capture & Scan'}
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