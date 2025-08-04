import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { X, CheckCircle, AlertCircle, Loader, QrCode, Clock, User } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { 
  ZBarBarcodeScanner as ZBarScanner, 
  ZBarBarcodeValidator,
  ZBarCameraUtils 
} from '../utils/zbarBarcodeScanner.ts';
import { buildApiUrl } from '../config/api.ts';

interface EquipmentQRScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (result: any) => void;
    mode: 'checkin' | 'checkout';
}

interface EquipmentInfo {
    id: number;
    name: string;
    location: string;
    is_in_use: boolean;
    current_user?: {
        username: string;
        first_name?: string;
        last_name?: string;
    };
    current_checkin_time?: string;
    current_usage_duration?: string;
}

const EquipmentQRScanner: React.FC<EquipmentQRScannerProps> = ({ 
    isOpen, 
    onClose, 
    onSuccess,
    mode 
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('EquipmentQRScanner must be used within an AuthProvider');
    }
    const { token } = authContext;

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const detectorRef = useRef<ZBarScanner | null>(null);
    
    const [scannedQR, setScannedQR] = useState<string>('');
    const [equipmentInfo, setEquipmentInfo] = useState<EquipmentInfo | null>(null);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanningError, setScanningError] = useState<string>('');
    const [isDetectorReady, setIsDetectorReady] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [actionResult, setActionResult] = useState<any>(null);

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
                    const qrCode = bestDetection.value;
                    
                    if (qrCode && qrCode.trim()) {
                        console.log('ZBar detected QR code:', bestDetection);
                        setIsScanning(false);
                        
                        // Stop animation frame
                        if (animationFrameRef.current) {
                            cancelAnimationFrame(animationFrameRef.current);
                            animationFrameRef.current = null;
                        }
                        
                        handleQRCodeDetected(qrCode.trim());
                        return;
                    }
                }
                
                animationFrameRef.current = requestAnimationFrame(detectFrame);
            } catch (error) {
                console.error('Detection error:', error);
                animationFrameRef.current = requestAnimationFrame(detectFrame);
            }
        };
        
        detectFrame();
    }, [isDetectorReady]);

    const handleQRCodeDetected = useCallback(async (qrCode: string) => {
        setScannedQR(qrCode);
        setIsLoading(true);
        setError('');
        
        try {
            // First, verify the QR code and get equipment info
            const response = await fetch(buildApiUrl('schedule/equipment/'), {
                method: 'GET',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch equipment information');
            }
            
            const equipmentList = await response.json();
            const equipment = equipmentList.results?.find((eq: any) => eq.qr_code === qrCode) || 
                             equipmentList.find((eq: any) => eq.qr_code === qrCode);
            
            if (!equipment) {
                throw new Error('Equipment not found for this QR code');
            }
            
            setEquipmentInfo(equipment);
            setShowConfirmation(true);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to verify QR code');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const performAction = useCallback(async () => {
        if (!scannedQR) return;
        
        setIsLoading(true);
        setError('');
        
        try {
            const endpoint = mode === 'checkin' ? 'qr_checkin' : 'qr_checkout';
            const response = await fetch(buildApiUrl(`schedule/equipment/${endpoint}/`), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    qr_code: scannedQR,
                    scan_method: 'mobile_camera',
                    notes: `${mode === 'checkin' ? 'Checked in' : 'Checked out'} via mobile QR scanner`
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `Failed to ${mode}`);
            }
            
            setActionResult(result);
            onSuccess(result);
            
            // Close scanner after successful action
            setTimeout(() => {
                onClose();
            }, 2000);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${mode}`);
        } finally {
            setIsLoading(false);
        }
    }, [scannedQR, mode, token, onSuccess, onClose]);

    const cleanup = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (detectorRef.current) {
            detectorRef.current.cleanup();
            detectorRef.current = null;
        }
        
        setIsDetectorReady(false);
        setIsScanning(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            initializeScanner();
        } else {
            cleanup();
            setScannedQR('');
            setEquipmentInfo(null);
            setError('');
            setShowConfirmation(false);
            setActionResult(null);
        }
        
        return cleanup;
    }, [isOpen, initializeScanner, cleanup]);

    if (!isOpen) return null;

    const getModeTitle = () => {
        return mode === 'checkin' ? 'Check In to Equipment' : 'Check Out from Equipment';
    };

    const getModeIcon = () => {
        return mode === 'checkin' ? <QrCode className="w-6 h-6" /> : <Clock className="w-6 h-6" />;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-full overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        {getModeIcon()}
                        <h2 className="text-lg font-semibold">{getModeTitle()}</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4">
                    {/* Success Result */}
                    {actionResult && (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800 mb-2">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">
                                    {mode === 'checkin' ? 'Successfully Checked In!' : 'Successfully Checked Out!'}
                                </span>
                            </div>
                            <div className="text-sm text-green-700">
                                <p><strong>Equipment:</strong> {actionResult.equipment?.name}</p>
                                {actionResult.usage_duration && (
                                    <p><strong>Usage Duration:</strong> {actionResult.usage_duration}</p>
                                )}
                                {actionResult.check_in_time && (
                                    <p><strong>Check-in Time:</strong> {new Date(actionResult.check_in_time).toLocaleTimeString()}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Equipment Confirmation */}
                    {showConfirmation && equipmentInfo && !actionResult && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h3 className="font-medium text-blue-800 mb-2">Equipment Found</h3>
                            <div className="text-sm text-blue-700 mb-3">
                                <p><strong>Name:</strong> {equipmentInfo.name}</p>
                                <p><strong>Location:</strong> {equipmentInfo.location}</p>
                                {equipmentInfo.is_in_use && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                        <div className="flex items-center gap-1 text-yellow-800">
                                            <User className="w-4 h-4" />
                                            <span>Currently in use by {equipmentInfo.current_user?.username}</span>
                                        </div>
                                        {equipmentInfo.current_usage_duration && (
                                            <p className="text-xs text-yellow-700 mt-1">
                                                Duration: {equipmentInfo.current_usage_duration}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={performAction}
                                disabled={isLoading}
                                className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
                                    mode === 'checkin' 
                                        ? 'bg-green-600 hover:bg-green-700' 
                                        : 'bg-red-600 hover:bg-red-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader className="w-4 h-4 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    `Confirm ${mode === 'checkin' ? 'Check In' : 'Check Out'}`
                                )}
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 text-red-800">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-medium">Error</span>
                            </div>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    )}

                    {/* Scanning Error */}
                    {scanningError && (
                        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-800">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-medium">Camera Issue</span>
                            </div>
                            <p className="text-sm text-yellow-700 mt-1">{scanningError}</p>
                            <button
                                onClick={initializeScanner}
                                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                            >
                                Retry Camera Access
                            </button>
                        </div>
                    )}

                    {/* Scanner Interface */}
                    {!showConfirmation && !actionResult && (
                        <>
                            {/* Camera Preview */}
                            <div className="relative mb-4 bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover"
                                    playsInline
                                    muted
                                />
                                
                                {/* Scanning Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="border-2 border-blue-500 bg-transparent rounded-lg" 
                                         style={{ width: '200px', height: '200px' }}>
                                        <div className="absolute inset-0 border border-white border-opacity-30 rounded-lg"></div>
                                    </div>
                                </div>
                                
                                {/* Status Overlay */}
                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="bg-black bg-opacity-70 text-white p-2 rounded text-center text-sm">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader className="w-4 h-4 animate-spin" />
                                                <span>Processing QR code...</span>
                                            </div>
                                        ) : isScanning ? (
                                            <span>Scanning for QR code...</span>
                                        ) : (
                                            <span>Initializing camera...</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="text-sm text-gray-600 text-center">
                                <p className="mb-2">Point your camera at the equipment QR code</p>
                                <p>The code will be automatically detected and processed</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EquipmentQRScanner;