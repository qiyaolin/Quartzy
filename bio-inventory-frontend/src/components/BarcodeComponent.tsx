import React, { useEffect, useState } from 'react';
import { Printer, Download } from 'lucide-react';

// Singleton DYMO loader to prevent script conflicts
class DymoFrameworkLoader {
    private static instance: DymoFrameworkLoader;
    private isLoading = false;
    private isLoaded = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() {}

    public static getInstance(): DymoFrameworkLoader {
        if (!DymoFrameworkLoader.instance) {
            DymoFrameworkLoader.instance = new DymoFrameworkLoader();
        }
        return DymoFrameworkLoader.instance;
    }

    public async loadFramework(): Promise<void> {
        if (this.isLoaded && typeof (window as any).dymo !== 'undefined') {
            return Promise.resolve();
        }

        if (this.isLoading && this.loadPromise) {
            return this.loadPromise;
        }

        const existingScript = document.querySelector('script[src="/dymo.connect.framework.js"]');
        if (existingScript && typeof (window as any).dymo !== 'undefined') {
            this.isLoaded = true;
            return Promise.resolve();
        }

        this.isLoading = true;
        this.loadPromise = new Promise((resolve, reject) => {
            if (existingScript) {
                const checkFramework = () => {
                    if (typeof (window as any).dymo !== 'undefined') {
                        this.isLoaded = true;
                        this.isLoading = false;
                        resolve();
                    } else {
                        setTimeout(checkFramework, 100);
                    }
                };
                checkFramework();
                return;
            }

            const script = document.createElement('script');
            script.src = '/dymo.connect.framework.js';
            script.async = true;
            
            script.onload = () => {
                this.isLoaded = true;
                this.isLoading = false;
                resolve();
            };
            
            script.onerror = () => {
                this.isLoading = false;
                this.loadPromise = null;
                reject(new Error('Failed to load DYMO framework'));
            };
            
            document.head.appendChild(script);
        });

        return this.loadPromise;
    }

    public isFrameworkLoaded(): boolean {
        return this.isLoaded && typeof (window as any).dymo !== 'undefined';
    }

    public getDymo(): any {
        if (this.isFrameworkLoaded()) {
            return (window as any).dymo;
        }
        return null;
    }
}

const dymoLoader = DymoFrameworkLoader.getInstance();

interface BarcodeComponentProps {
    barcodeData: string;
    itemName: string;
    onPrint?: () => void;
    showControls?: boolean;
}

const BarcodeComponent: React.FC<BarcodeComponentProps> = ({ 
    barcodeData, 
    itemName, 
    onPrint, 
    showControls = true 
}) => {
    const [isFrameworkLoaded, setIsFrameworkLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [labelPreview, setLabelPreview] = useState<string | null>(null);

    // DYMO label XML template
    const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips" MediaType="Default">
    <PaperOrientation>Portrait</PaperOrientation>
    <Id>Small30334</Id>
    <IsOutlined>false</IsOutlined>
    <PaperName>30334 2-1/4 in x 1-1/4 in</PaperName>
    <DrawCommands>
        <RoundRectangle X="0" Y="0" Width="3240" Height="1800" Rx="270" Ry="270" />
    </DrawCommands>
    <ObjectInfo>
        <TextObject>
            <Name>textbox</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">${itemName}</String>
                    <Attributes>
                        <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="58" Y="86" Width="3125" Height="765" />
    </ObjectInfo>
    <ObjectInfo>
        <BarcodeObject>
            <Name>labelbox</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>True</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <Text>${barcodeData}</Text>
            <Type>Code128Auto</Type>
            <Size>Small</Size>
            <TextPosition>None</TextPosition>
            <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <TextEmbedding>None</TextEmbedding>
            <ECLevel>0</ECLevel>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
        </BarcodeObject>
        <Bounds X="58" Y="948.5" Width="3125" Height="607" />
    </ObjectInfo>
</DieCutLabel>`;

    // Load DYMO framework using singleton loader
    useEffect(() => {
        const loadFramework = async () => {
            try {
                await dymoLoader.loadFramework();
                setIsFrameworkLoaded(true);
            } catch (error) {
                setError('Failed to load DYMO framework');
                console.error('DYMO framework loading error:', error);
            }
        };

        if (!dymoLoader.isFrameworkLoaded()) {
            loadFramework();
        } else {
            setIsFrameworkLoaded(true);
        }
    }, []); // Only run once on mount

    // Generate preview when framework is loaded or data changes
    useEffect(() => {
        if (isFrameworkLoaded) {
            generatePreview();
        }
    }, [isFrameworkLoaded, barcodeData, itemName]);

    const generatePreview = () => {
        try {
            const dymo = dymoLoader.getDymo();
            if (!dymo) return;
            
            const label = dymo.label.framework.openLabelXml(labelXml);
            label.setObjectText("labelbox", barcodeData);
            label.setObjectText("textbox", itemName);
            
            const pngData = label.render();
            setLabelPreview(`data:image/png;base64,${pngData}`);
        } catch (e) {
            console.error('Preview generation failed:', e);
            setError(`Preview generation failed: ${e}`);
        }
    };

    const handlePrint = async () => {
        if (!isFrameworkLoaded) {
            setError('DYMO framework not loaded');
            return;
        }

        try {
            const dymo = dymoLoader.getDymo();
            if (!dymo) {
                setError('DYMO framework not available');
                return;
            }
            
            // Check environment
            const result = await new Promise((resolve, reject) => {
                dymo.label.framework.checkEnvironment(resolve, reject);
            });

            if (!(result as any).isFrameworkInstalled) {
                setError('DYMO Label Framework not installed');
                return;
            }

            if (!(result as any).isWebServicePresent) {
                setError('DYMO Web Service not running');
                return;
            }

            // Get printers
            const printers = await dymo.label.framework.getPrintersAsync();
            if (printers.length === 0) {
                setError('No DYMO printers found');
                return;
            }

            // Use first available printer
            const printer = printers.find((p: any) => p.isConnected) || printers[0];
            
            const label = dymo.label.framework.openLabelXml(labelXml);
            label.setObjectText("labelbox", barcodeData);
            label.setObjectText("textbox", itemName);
            
            label.print(printer.name);
            
            if (onPrint) {
                onPrint();
            }
            
        } catch (e) {
            setError(`Print failed: ${e}`);
            console.error('Print error:', e);
        }
    };

    const downloadPreview = () => {
        if (!labelPreview) return;
        
        const link = document.createElement('a');
        link.href = labelPreview;
        link.download = `barcode-${barcodeData}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
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
                {labelPreview ? (
                    <img 
                        src={labelPreview} 
                        alt="Barcode preview" 
                        className="mx-auto border border-gray-300 rounded"
                        style={{ maxWidth: '200px' }}
                    />
                ) : (
                    <div className="bg-gray-100 border border-gray-300 rounded p-8 text-gray-500">
                        Loading preview...
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Controls */}
            {showControls && (
                <div className="flex justify-center space-x-3">
                    <button
                        onClick={handlePrint}
                        disabled={!isFrameworkLoaded}
                        className="btn btn-primary btn-sm flex items-center space-x-2"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print Label</span>
                    </button>
                    <button
                        onClick={downloadPreview}
                        disabled={!labelPreview}
                        className="btn btn-secondary btn-sm flex items-center space-x-2"
                    >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BarcodeComponent;