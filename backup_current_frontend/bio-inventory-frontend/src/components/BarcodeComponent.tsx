import React, { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import PrintBarcodeModal from './PrintBarcodeModal';

interface BarcodeComponentProps {
    barcodeData: string;
    itemName: string;
    itemId?: string | number;
    onPrint?: () => void;
    showControls?: boolean;
    allowTextEdit?: boolean;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
}

const BarcodeComponent: React.FC<BarcodeComponentProps> = ({ 
    barcodeData, 
    itemName,
    itemId,
    onPrint, 
    showControls = true,
    allowTextEdit = false,
    priority = 'normal'
}) => {
    const [showPrintModal, setShowPrintModal] = useState(false);

    const handlePrint = () => {
        setShowPrintModal(true);
    };

    const handlePrintModalClose = () => {
        setShowPrintModal(false);
        if (onPrint) {
            onPrint();
        }
    };

    // Simple barcode visualization (placeholder for actual implementation)
    const generateBarcodePreview = () => {
        // This is a simplified barcode representation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        canvas.width = 300;
        canvas.height = 100;
        
        // Draw simple barcode-like pattern
        ctx.fillStyle = '#000';
        const binaryPattern = barcodeData.split('').map(char => char.charCodeAt(0).toString(2)).join('');
        const barWidth = canvas.width / Math.max(binaryPattern.length, 30);
        
        for (let i = 0; i < binaryPattern.length; i++) {
            if (binaryPattern[i] === '1') {
                ctx.fillRect(i * barWidth, 10, barWidth * 0.8, 60);
            }
        }
        
        // Add text
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(barcodeData, canvas.width / 2, 90);
        
        return canvas.toDataURL();
    };

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Item Barcode</h3>
                    <div className="text-sm text-gray-600 mb-4">
                        <p><strong>Item:</strong> {itemName}</p>
                        <p><strong>Barcode:</strong> {barcodeData}</p>
                    </div>
                </div>

                {/* Preview */}
                <div className="text-center mb-4">
                    <img 
                        src={generateBarcodePreview()} 
                        alt="Barcode preview" 
                        className="mx-auto border border-gray-300 rounded"
                        style={{ maxWidth: '200px' }}
                    />
                </div>

                {/* Controls */}
                {showControls && (
                    <div className="flex justify-center space-x-3">
                        <button
                            onClick={handlePrint}
                            className="btn btn-primary btn-sm flex items-center space-x-2"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print Label</span>
                        </button>
                        <button
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = generateBarcodePreview();
                                link.download = `barcode-${barcodeData}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="btn btn-secondary btn-sm flex items-center space-x-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Centralized Print Modal */}
            <PrintBarcodeModal
                isOpen={showPrintModal}
                onClose={handlePrintModalClose}
                itemName={itemName}
                barcode={barcodeData}
                itemId={itemId}
                customText={itemName}
                allowTextEdit={allowTextEdit}
                priority={priority}
            />
        </>
    );
};

export default BarcodeComponent;