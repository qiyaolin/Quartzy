import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, Download, FileText } from 'lucide-react';
import { processImportFile, validateRequestRow, ImportResult } from '../utils/excelImport.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';
import { useNotification } from '../contexts/NotificationContext.tsx';

interface ImportRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}

const ImportRequestsModal: React.FC<ImportRequestsModalProps> = ({ isOpen, onClose, onSuccess, token }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notification = useNotification();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      setShowPreview(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const config = {
        requiredFields: ['product_name', 'quantity'],
        fieldMapping: {
          'item_name': 'product_name',
          'name': 'product_name',
          'amount': 'quantity',
          'qty': 'quantity',
          'vendor_name': 'vendor',
          'price': 'unit_price',
          'cost': 'unit_price'
        },
        validateRow: validateRequestRow
      };

      const result = await processImportFile(file, config);
      setImportResult(result);
      setShowPreview(true);
    } catch (error) {
      notification.error(`Failed to process file: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!importResult || importResult.validRows === 0) {
      notification.error('No valid data to import');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.REQUESTS_BATCH_CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ requests: importResult.data })
      });

      if (response.ok) {
        const result = await response.json();
        notification.success(`Successfully imported ${result.created_count || importResult.validRows} requests`);
        onSuccess();
        handleClose();
      } else {
        const error = await response.json();
        notification.error(`Import failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      notification.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = [
      ['product_name', 'specifications', 'quantity', 'unit_price', 'vendor', 'product_link', 'urgency', 'notes'],
      ['Sample Product', 'Sample specifications', '5', '99.99', 'Sample Vendor', 'https://example.com', 'medium', 'Sample notes']
    ];

    const csvContent = template.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requests_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-4xl">
        <div className="modal-header">
          <h2 className="modal-title">Import Request Data</h2>
          <button onClick={handleClose} className="modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          {!showPreview ? (
            <>
              {/* File Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Select File</h3>
                  <button
                    onClick={downloadTemplate}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </button>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-gray-900">
                        Upload your request data file
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports Excel (.xlsx) and CSV files
                      </p>
                    </div>
                    <div className="mt-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-primary"
                      >
                        Choose File
                      </button>
                    </div>
                  </div>
                </div>

                {file && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900">{file.name}</p>
                        <p className="text-sm text-blue-600">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Required Fields Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Required Fields</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>• product_name (Product Name)</div>
                    <div>• quantity (Amount)</div>
                  </div>
                  <h4 className="font-semibold text-gray-900 mt-3 mb-2">Optional Fields</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>• specifications</div>
                    <div>• unit_price</div>
                    <div>• vendor</div>
                    <div>• product_link</div>
                    <div>• urgency (low/medium/high)</div>
                    <div>• notes</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
              /* Preview Section */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Import Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Back to File Selection
                  </button>
                </div>

                {/* Import Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">{importResult?.totalRows || 0}</div>
                    <div className="text-sm text-blue-600">Total Rows</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">{importResult?.validRows || 0}</div>
                    <div className="text-sm text-green-600">Valid Rows</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-900">{importResult?.errors.length || 0}</div>
                    <div className="text-sm text-red-600">Errors</div>
                  </div>
                </div>

                {/* Errors */}
                {importResult?.errors && importResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h4 className="font-semibold text-red-900">Validation Errors</h4>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-700">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valid Data Preview */}
                {importResult?.data && importResult.data.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-900">Valid Data Preview (First 5 rows)</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-green-200">
                            {Object.keys(importResult.data[0]).map(key => (
                              <th key={key} className="text-left p-2 text-green-900 font-medium">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.data.slice(0, 5).map((row, index) => (
                            <tr key={index} className="border-b border-green-100">
                              {Object.values(row).map((value, valueIndex) => (
                                <td key={valueIndex} className="p-2 text-green-800">
                                  {String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        <div className="modal-footer">
          <button onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          
          {!showPreview ? (
            <button
              onClick={handlePreview}
              disabled={!file || importing}
              className="btn btn-primary"
            >
              {importing ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Processing...
                </>
              ) : (
                'Preview Import'
              )}
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={!importResult || importResult.validRows === 0 || importing}
              className="btn btn-primary"
            >
              {importing ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Importing...
                </>
              ) : (
                `Import ${importResult?.validRows || 0} Requests`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportRequestsModal;