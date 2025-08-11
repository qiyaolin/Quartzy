import React, { useState, useEffect, useContext } from 'react';
import { Monitor, CalendarCheck, AlertTriangle } from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { equipmentApi } from '../services/scheduleApi.ts';

interface Equipment {
    id: number;
    name: string;
    location: string;
    is_bookable: boolean;
    is_in_use: boolean;
}

interface QuickBookingData {
    equipment_id: number;
    duration_minutes: number;
    start_time?: string;
    auto_checkin?: boolean;
}

interface QuickBookModalProps {
    equipment: Equipment;
    isSubmitting: boolean;
    onClose: () => void;
    onSubmit: (data: QuickBookingData) => void;
}

const QuickBookModal: React.FC<QuickBookModalProps> = ({
    equipment,
    isSubmitting,
    onClose,
    onSubmit
}) => {
    const authContext = useContext(AuthContext);
    const token = authContext?.token;
    
    const [duration, setDuration] = useState(60);
    const [startTime, setStartTime] = useState('');
    const [autoCheckin, setAutoCheckin] = useState(true);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);
    const [checkingAvailability, setCheckingAvailability] = useState(false);

    const checkAvailability = async () => {
        if (!token) return;
        
        setCheckingAvailability(true);
        setConflictWarning(null);
        
        try {
            // Calculate the booking time range
            const now = new Date();
            const bookingStart = startTime ? 
                new Date(`${now.toDateString()} ${startTime}`) : 
                now;
            const bookingEnd = new Date(bookingStart.getTime() + duration * 60000);
            
            // Check for existing bookings
            const bookings = await equipmentApi.getEquipmentBookings(
                token, 
                equipment.id,
                bookingStart.toISOString().split('T')[0],
                bookingEnd.toISOString().split('T')[0]
            );
            
            // Check for conflicts
            const conflicts = bookings.filter((booking: any) => {
                const existingStart = new Date(booking.start_time);
                const existingEnd = new Date(booking.end_time);
                
                // Check if times overlap
                return (bookingStart < existingEnd && bookingEnd > existingStart) &&
                       booking.status !== 'cancelled';
            });
            
            if (conflicts.length > 0) {
                const conflictTimes = conflicts.map((c: any) => 
                    `${new Date(c.start_time).toLocaleTimeString()} - ${new Date(c.end_time).toLocaleTimeString()}`
                ).join(', ');
                setConflictWarning(`Time slot conflicts with existing booking(s): ${conflictTimes}`);
            }
        } catch (error) {
            console.error('Error checking availability:', error);
        } finally {
            setCheckingAvailability(false);
        }
    };

    // Check availability when duration or start time changes
    useEffect(() => {
        if (duration && equipment.id) {
            const timeoutId = setTimeout(checkAvailability, 500); // Debounce
            return () => clearTimeout(timeoutId);
        }
    }, [duration, startTime, equipment.id, token]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const bookingData: QuickBookingData = {
            equipment_id: equipment.id,
            duration_minutes: duration,
            auto_checkin: autoCheckin
        };

        if (startTime) {
            bookingData.start_time = new Date(`${new Date().toDateString()} ${startTime}`).toISOString();
        }

        onSubmit(bookingData);
    };

    const durationOptions = [30, 60, 90, 120, 180, 240];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Monitor className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Book Equipment</h3>
                            <p className="text-sm text-gray-600">{equipment.name}</p>
                            <p className="text-xs text-gray-500">{equipment.location}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Conflict Warning */}
                        {conflictWarning && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-red-800">
                                    {conflictWarning}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Duration
                                {checkingAvailability && (
                                    <span className="ml-2 text-xs text-gray-500">
                                        (checking availability...)
                                    </span>
                                )}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {durationOptions.map((minutes) => (
                                    <button
                                        key={minutes}
                                        type="button"
                                        onClick={() => setDuration(minutes)}
                                        className={`px-3 py-2 text-sm rounded border ${
                                            duration === minutes
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {minutes}min
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Time (optional)
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Start now"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave empty to start immediately
                            </p>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="autoCheckin"
                                checked={autoCheckin}
                                onChange={(e) => setAutoCheckin(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="autoCheckin" className="ml-2 text-sm text-gray-700">
                                Auto check-in upon booking
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || checkingAvailability || !!conflictWarning}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Booking...
                                    </>
                                ) : (
                                    <>
                                        <CalendarCheck className="w-4 h-4" />
                                        Book Now
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default QuickBookModal;