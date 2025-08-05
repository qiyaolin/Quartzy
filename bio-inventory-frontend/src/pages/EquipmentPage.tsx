import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
    QrCode, 
    Calendar, 
    Plus, 
    Search, 
    Filter,
    RefreshCw,
    Settings
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { equipmentApi, Equipment } from '../services/scheduleApi.ts';
import EquipmentCard from '../components/EquipmentCard';
import EquipmentQRScanner from '../components/EquipmentQRScanner';

const EquipmentPage: React.FC = () => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('EquipmentPage must be used within an AuthProvider');
    }
    const { token, user } = authContext;

    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterQREnabled, setFilterQREnabled] = useState('all');
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [scannerMode, setScannerMode] = useState<'checkin' | 'checkout'>('checkin');

    const fetchEquipment = useCallback(async () => {
        try {
            setLoading(true);
            const params: any = {};
            
            if (filterStatus === 'bookable') {
                params.bookable_only = 'true';
            }
            
            const data = await equipmentApi.getEquipment(token, params);
            setEquipment(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error occurred');
            console.error('Error fetching equipment:', err);
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus]);

    useEffect(() => {
        if (token) {
            fetchEquipment();
        }
    }, [token, fetchEquipment]);

    const handleQRScanSuccess = (result: any) => {
        console.log('QR scan successful:', result);
        // Refresh equipment list to show updated status
        fetchEquipment();
    };

    const handleBooking = (equipment: Equipment) => {
        // TODO: Implement booking modal or redirect to booking page
        console.log('Booking equipment:', equipment);
        alert(`Booking functionality for ${equipment.name} will be implemented`);
    };

    const handleViewUsage = (equipment: Equipment) => {
        // TODO: Implement usage history modal
        console.log('View usage for equipment:', equipment);
        alert(`Usage history for ${equipment.name} will be implemented`);
    };

    const handleScannerOpen = (mode: 'checkin' | 'checkout') => {
        setScannerMode(mode);
        setShowQRScanner(true);
    };

    // Filter equipment based on search and filters
    const filteredEquipment = equipment.filter(eq => {
        const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             eq.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (eq.description && eq.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = filterStatus === 'all' || 
                             (filterStatus === 'available' && !eq.is_in_use && eq.is_bookable) ||
                             (filterStatus === 'in_use' && eq.is_in_use) ||
                             (filterStatus === 'bookable' && eq.is_bookable);
        
        const matchesQR = filterQREnabled === 'all' ||
                         (filterQREnabled === 'qr_enabled' && eq.requires_qr_checkin) ||
                         (filterQREnabled === 'qr_disabled' && !eq.requires_qr_checkin);
        
        return matchesSearch && matchesStatus && matchesQR;
    });

    // Statistics
    const stats = {
        total: equipment.length,
        available: equipment.filter(eq => !eq.is_in_use && eq.is_bookable).length,
        in_use: equipment.filter(eq => eq.is_in_use).length,
        qr_enabled: equipment.filter(eq => eq.requires_qr_checkin).length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Equipment Management</h1>
                    <p className="text-gray-600">Manage equipment bookings and QR code check-in/out</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleScannerOpen('checkin')}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <QrCode className="w-4 h-4 mr-2" />
                        Quick Check In
                    </button>
                    
                    <button
                        onClick={() => handleScannerOpen('checkout')}
                        className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        <QrCode className="w-4 h-4 mr-2" />
                        Quick Check Out
                    </button>
                    
                    <button
                        onClick={fetchEquipment}
                        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Equipment</p>
                            <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                        </div>
                        <Settings className="w-8 h-8 text-gray-400" />
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Available</p>
                            <p className="text-2xl font-semibold text-green-600">{stats.available}</p>
                        </div>
                        <Calendar className="w-8 h-8 text-green-400" />
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">In Use</p>
                            <p className="text-2xl font-semibold text-red-600">{stats.in_use}</p>
                        </div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">QR Enabled</p>
                            <p className="text-2xl font-semibold text-blue-600">{stats.qr_enabled}</p>
                        </div>
                        <QrCode className="w-8 h-8 text-blue-400" />
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search equipment..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="available">Available</option>
                        <option value="in_use">In Use</option>
                        <option value="bookable">Bookable Only</option>
                    </select>

                    {/* QR Filter */}
                    <select
                        value={filterQREnabled}
                        onChange={(e) => setFilterQREnabled(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                        <option value="all">All QR Types</option>
                        <option value="qr_enabled">QR Enabled</option>
                        <option value="qr_disabled">QR Disabled</option>
                    </select>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEquipment.length === 0 ? (
                    <div className="col-span-full">
                        <div className="text-center py-12">
                            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No equipment found</h3>
                            <p className="text-gray-600">
                                {searchTerm || filterStatus !== 'all' || filterQREnabled !== 'all'
                                    ? 'Try adjusting your search or filter criteria'
                                    : 'No equipment has been added yet'
                                }
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredEquipment.map((eq) => (
                        <EquipmentCard
                            key={eq.id}
                            equipment={eq}
                            onBooking={handleBooking}
                            onViewUsage={handleViewUsage}
                            currentUserId={user?.id}
                            currentUsername={user?.username}
                        />
                    ))
                )}
            </div>

            {/* QR Scanner Modal */}
            <EquipmentQRScanner
                isOpen={showQRScanner}
                onClose={() => setShowQRScanner(false)}
                onSuccess={handleQRScanSuccess}
                mode={scannerMode}
            />
        </div>
    );
};

export default EquipmentPage;