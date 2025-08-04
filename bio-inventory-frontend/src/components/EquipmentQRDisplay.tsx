import React, { useState, useEffect, useContext } from 'react';
import { QrCode, Download, Printer, MapPin, Clock, User, X } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { equipmentApi, Equipment } from '../services/scheduleApi.ts';

interface EquipmentQRDisplayProps {
    equipment: Equipment;
    isOpen: boolean;
    onClose: () => void;
}


const EquipmentQRDisplay: React.FC<EquipmentQRDisplayProps> = ({ 
    equipment, 
    isOpen, 
    onClose 
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('EquipmentQRDisplay must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [qrData, setQrData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

    useEffect(() => {
        if (isOpen && equipment.id) {
            fetchEquipmentQR();
        }
    }, [isOpen, equipment.id]);

    const fetchEquipmentQR = async () => {
        try {
            setLoading(true);
            setError('');

            const data = await equipmentApi.getEquipmentQR(token, equipment.id);
            setQrData(data);
            
            // Generate QR code using a simple text-based approach
            generateQRCode(data.qr_code);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load QR code');
        } finally {
            setLoading(false);
        }
    };

    const generateQRCode = (qrText: string) => {
        // Simple QR code generation using a web service
        // In production, you might want to use a proper QR code library
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrText)}`;
        setQrCodeDataUrl(qrApiUrl);
    };

    const handleDownload = () => {
        if (!equipment || !qrCodeDataUrl) return;

        // Create download link
        const link = document.createElement('a');
        link.download = `${equipment.name.replace(/\s+/g, '_')}_QR_Code.png`;
        link.href = qrCodeDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        if (!equipment || !qrCodeDataUrl) return;

        // Create print window with QR code
        const printWindow = window.open('', '_blank', 'width=600,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Equipment QR Code - ${equipment.name}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            padding: 20px; 
                        }
                        .qr-container { 
                            border: 2px solid #000; 
                            padding: 20px; 
                            margin: 20px auto; 
                            max-width: 400px; 
                        }
                        .equipment-name { 
                            font-size: 24px; 
                            font-weight: bold; 
                            margin-bottom: 10px; 
                        }
                        .equipment-details { 
                            font-size: 14px; 
                            margin-bottom: 20px; 
                        }
                        .qr-code { 
                            max-width: 300px; 
                            height: auto; 
                        }
                        .qr-text { 
                            font-family: monospace; 
                            font-size: 12px; 
                            margin-top: 10px; 
                            word-break: break-all; 
                        }
                        .instructions { 
                            font-size: 12px; 
                            margin-top: 20px; 
                            text-align: left; 
                        }
                    </style>
                </head>
                <body>
                    <div class="qr-container">
                        <div class="equipment-name">${equipment.name}</div>
                        <div class="equipment-details">
                            Location: ${equipment.location || 'Not specified'}<br>
                            QR Code: ${qrData?.qr_code || 'Not available'}
                        </div>
                        <img src="${qrCodeDataUrl}" alt="Equipment QR Code" class="qr-code" />
                        <div class="qr-text">${qrData?.qr_code || 'Not available'}</div>
                    </div>
                    <div class="instructions">
                        <h3>Instructions:</h3>
                        <ol>
                            <li>Scan this QR code with your mobile device to check in</li>
                            <li>Scan again when finished to check out</li>
                            <li>This ensures accurate usage tracking</li>
                        </ol>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-full overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <QrCode className="w-6 h-6 text-blue-600" />
                        <h2 className="text-lg font-semibold">Equipment QR Code</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-gray-600">Loading QR code...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600">{error}</p>
                        </div>
                    )}

                    {equipment && !loading && !error && (
                        <>
                            {/* Equipment Information */}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    {equipment.name}
                                </h3>
                                
                                <div className="space-y-2 text-sm text-gray-600">
                                    {equipment.location && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            <span>{equipment.location}</span>
                                        </div>
                                    )}
                                    
                                    {qrData?.qr_code && (
                                        <div className="flex items-center gap-2">
                                            <QrCode className="w-4 h-4" />
                                            <span className="font-mono">{qrData.qr_code}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Current Usage Status */}
                                {equipment.is_in_use && equipment.current_user && (
                                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <div className="flex items-center gap-2 text-yellow-800 mb-1">
                                            <User className="w-4 h-4" />
                                            <span className="font-medium">Currently in use</span>
                                        </div>
                                        <div className="text-sm text-yellow-700">
                                            <p>User: {equipment.current_user.username}</p>
                                            {equipment.current_usage_duration && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>Duration: {equipment.current_usage_duration}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* QR Code Display */}
                            <div className="text-center mb-6">
                                <div className="inline-block p-4 border-2 border-gray-300 rounded-lg bg-white">
                                    {qrCodeDataUrl && (
                                        <img 
                                            src={qrCodeDataUrl} 
                                            alt="Equipment QR Code"
                                            className="w-64 h-64 mx-auto"
                                        />
                                    )}
                                </div>
                                {qrData?.qr_code && (
                                    <p className="text-sm text-gray-500 mt-2 font-mono">
                                        {qrData.qr_code}
                                    </p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mb-6">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download</span>
                                </button>
                                
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Print</span>
                                </button>
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-medium text-blue-800 mb-2">How to Use</h4>
                                <div className="text-sm text-blue-700 space-y-1">
                                    <p>1. <strong>Check In:</strong> Scan this QR code with your mobile device when you start using the equipment</p>
                                    <p>2. <strong>Check Out:</strong> Scan the same QR code again when you finish using the equipment</p>
                                    <p>3. <strong>Tracking:</strong> This ensures accurate usage logging and helps the next user know when equipment becomes available</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EquipmentQRDisplay;