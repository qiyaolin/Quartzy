import React, { useContext, useState } from 'react';
import { 
    MapPin, 
    Clock, 
    User, 
    Calendar, 
    CheckCircle, 
    AlertCircle,
    MoreVertical,
    History
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { equipmentApi } from '../services/scheduleApi.ts';

interface Equipment {
    id: number;
    name: string;
    description?: string;
    location: string;
    is_bookable: boolean;
    is_in_use: boolean;
    current_user?: {
        username: string;
        first_name?: string;
        last_name?: string;
    };
    current_checkin_time?: string;
    current_usage_duration?: string;
    current_booking?: {
        id: number;
        start_time: string;
        end_time: string;
        status: string;
    };
    created_at: string;
    updated_at: string;
}

interface EquipmentCardProps {
    equipment: Equipment;
    onBooking?: (equipment: Equipment) => void;
    onViewUsage?: (equipment: Equipment) => void;
    currentUserId?: number;
    currentUsername?: string;
    onStatusChange?: () => void;
}

const EquipmentCard: React.FC<EquipmentCardProps> = ({ 
    equipment, 
    onBooking, 
    onViewUsage,
    currentUserId,
    currentUsername,
    onStatusChange
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [submitting, setSubmitting] = useState<'checkin' | 'checkout' | null>(null);
    const authContext = useContext(AuthContext);
    const token = authContext?.token || null;

    const handleCheckIn = async () => {
        if (!token) return;
        try {
            setSubmitting('checkin');
            await equipmentApi.checkIn(token, equipment.id);
            onStatusChange?.();
        } catch (e) {
            console.error('Check-in failed', e);
            alert((e as Error).message || 'Check-in failed');
        } finally {
            setSubmitting(null);
        }
    };

    const handleCheckOut = async () => {
        if (!token) return;
        try {
            setSubmitting('checkout');
            await equipmentApi.checkOut(token, equipment.id);
            onStatusChange?.();
        } catch (e) {
            console.error('Check-out failed', e);
            alert((e as Error).message || 'Check-out failed');
        } finally {
            setSubmitting(null);
        }
    };

    const getStatusColor = () => {
        if (!equipment.is_bookable) return 'bg-gray-100 text-gray-600';
        if (equipment.is_in_use) return 'bg-red-100 text-red-600';
        return 'bg-green-100 text-green-600';
    };

    const getStatusText = () => {
        if (!equipment.is_bookable) return 'Not Bookable';
        if (equipment.is_in_use) return 'In Use';
        return 'Available';
    };

    const canCheckIn = () => {
        return !equipment.is_in_use && equipment.is_bookable;
    };

    const canCheckOut = () => {
        return equipment.is_in_use && 
               equipment.current_user?.username === currentUsername;
    };

    const formatDuration = (durationStr?: string) => {
        if (!durationStr) return '';
        
        try {
            // Parse duration string (assumes format like "1:30:45" for 1h 30m 45s)
            const parts = durationStr.split(':');
            if (parts.length >= 2) {
                const hours = parseInt(parts[0]);
                const minutes = parseInt(parts[1]);
                
                if (hours > 0) {
                    return `${hours}h ${minutes}m`;
                } else {
                    return `${minutes}m`;
                }
            }
        } catch (e) {
            console.error('Error parsing duration:', e);
        }
        
        return durationStr;
    };

    return (
        <>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {equipment.name}
                            </h3>
                            {equipment.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                    {equipment.description}
                                </p>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
                                {getStatusText()}
                            </span>
                            
                            <div className="relative">
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="p-1 hover:bg-gray-100 rounded-full"
                                >
                                    <MoreVertical className="w-4 h-4 text-gray-500" />
                                </button>
                                
                                {showMenu && (
                                    <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                        <div className="py-1">
                                            {onViewUsage && (
                                                <button
                                                    onClick={() => {
                                                        onViewUsage(equipment);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    <History className="w-4 h-4" />
                                                    Usage History
                                                </button>
                                            )}
                                            
                                            {onBooking && equipment.is_bookable && (
                                                <button
                                                    onClick={() => {
                                                        onBooking(equipment);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    <Calendar className="w-4 h-4" />
                                                    Book Equipment
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Location */}
                    {equipment.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <MapPin className="w-4 h-4" />
                            <span>{equipment.location}</span>
                        </div>
                    )}

                    {/* Current Usage */}
                    {equipment.is_in_use && equipment.current_user && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 text-yellow-800 mb-1">
                                <User className="w-4 h-4" />
                                <span className="font-medium">Currently in use</span>
                            </div>
                            <div className="text-sm text-yellow-700">
                                <p>
                                    {equipment.current_user.first_name} {equipment.current_user.last_name} 
                                    ({equipment.current_user.username})
                                </p>
                                {equipment.current_usage_duration && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatDuration(equipment.current_usage_duration)}</span>
                                    </div>
                                )}
                                {equipment.current_booking && (
                                    <div className="mt-1">
                                        <p>Booking: {new Date(equipment.current_booking.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(equipment.current_booking.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        {canCheckIn() && (
                            <button
                                onClick={handleCheckIn}
                                disabled={submitting === 'checkin'}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-60 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {submitting === 'checkin' ? 'Checking In...' : 'Check In'}
                            </button>
                        )}
                        {canCheckOut() && (
                            <button
                                onClick={handleCheckOut}
                                disabled={submitting === 'checkout'}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-60 transition-colors"
                            >
                                <AlertCircle className="w-4 h-4" />
                                {submitting === 'checkout' ? 'Checking Out...' : 'Check Out'}
                            </button>
                        )}
                    </div>

                    {/* Booking Section */}
                    {equipment.is_bookable && onBooking && (
                        <div className="pt-3 border-t border-gray-100">
                            <button
                                onClick={() => onBooking(equipment)}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Calendar className="w-4 h-4" />
                                Book Equipment
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* QR-related modals removed per button-based flow */}
        </>
    );
};

export default EquipmentCard;