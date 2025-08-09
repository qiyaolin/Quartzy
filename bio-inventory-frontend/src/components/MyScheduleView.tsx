import React, { useState, useEffect, useContext } from 'react';
import {
    Calendar, Clock, MapPin, Monitor, X, AlertCircle, CheckCircle,
    CalendarDays, User, Trash2
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { equipmentApi, scheduleHelpers, Schedule } from '../services/scheduleApi.ts';

interface Booking {
    id: number;
    start_time: string;
    end_time: string;
    status: string;
    title: string;
    equipment: {
        id: number;
        name: string;
        location?: string;
    };
}

interface MyScheduleViewProps {
    schedules: Schedule[];
    loading: boolean;
    formatTime: (time: string | undefined) => string;
}

const MyScheduleView: React.FC<MyScheduleViewProps> = ({ schedules, loading, formatTime }) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('MyScheduleView must be used within an AuthProvider');
    }
    const { token, user } = authContext;

    const [userBookings, setUserBookings] = useState<Booking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchUserBookings = async () => {
        if (!token || !user) return;
        
        setBookingsLoading(true);
        try {
            const bookings = await equipmentApi.getUserBookings(token, user.id);
            // Filter to only show future bookings that are not cancelled
            const activeBookings = bookings.filter((booking: any) => 
                booking.status !== 'cancelled' && 
                new Date(booking.start_time) > new Date()
            ).map((booking: any) => ({
                id: booking.id,
                start_time: booking.event?.start_time || booking.start_time,
                end_time: booking.event?.end_time || booking.end_time,
                status: booking.status,
                title: booking.event?.title || `${booking.equipment.name} Booking`,
                equipment: booking.equipment
            }));
            setUserBookings(activeBookings);
        } catch (error) {
            console.error('Error fetching user bookings:', error);
            setError('Failed to load your equipment bookings');
        } finally {
            setBookingsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserBookings();
    }, [token, user]);

    const handleCancelBooking = async (bookingId: number) => {
        if (!token) return;
        
        setCancellingId(bookingId);
        try {
            await equipmentApi.cancelBooking(token, bookingId);
            setSuccess('Booking cancelled successfully');
            fetchUserBookings(); // Refresh the list
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to cancel booking');
        } finally {
            setCancellingId(null);
        }
    };

    if (loading || bookingsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const todaySchedules = schedules.filter(s => s.date === new Date().toISOString().split('T')[0]);
    const upcomingSchedules = schedules.filter(s => s.date > new Date().toISOString().split('T')[0]).slice(0, 5);
    
    const todayBookings = userBookings.filter(b => 
        new Date(b.start_time).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
    );
    const upcomingBookings = userBookings.filter(b => 
        new Date(b.start_time).toISOString().split('T')[0] > new Date().toISOString().split('T')[0]
    ).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Status Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-red-800">{error}</p>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-green-800">{success}</p>
                    </div>
                    <button
                        onClick={() => setSuccess(null)}
                        className="text-green-400 hover:text-green-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Today's Schedule */}
            <div className="card">
                <div className="card-body p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Today's Schedule</h3>
                
                {/* Today's Events */}
                {todaySchedules.length === 0 && todayBookings.length === 0 ? (
                    <div className="text-center py-6">
                        <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No events scheduled for today</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Regular Schedule Events */}
                        {todaySchedules.map((schedule) => (
                            <div key={`schedule-${schedule.id}`} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h5 className="font-medium text-gray-900">{schedule.title}</h5>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>
                                                    {formatTime(schedule.start_time)}
                                                    {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                                </span>
                                            </div>
                                            {schedule.location && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{schedule.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scheduleHelpers.getStatusColor(schedule.status)}`}>
                                        {schedule.status?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Equipment Bookings for Today */}
                        {todayBookings.map((booking) => (
                            <div key={`booking-${booking.id}`} className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-blue-600" />
                                            <h5 className="font-medium text-gray-900">{booking.equipment.name}</h5>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>
                                                    {new Date(booking.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    {' - '}
                                                    {new Date(booking.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </span>
                                            </div>
                                            {booking.equipment.location && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{booking.equipment.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {booking.status}
                                        </span>
                                        {new Date(booking.start_time) > new Date() && (
                                            <button
                                                onClick={() => handleCancelBooking(booking.id)}
                                                disabled={cancellingId === booking.id}
                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
                                                title="Cancel booking"
                                            >
                                                {cancellingId === booking.id ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>

            {/* Upcoming Events */}
            <div className="card">
                <div className="card-body p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Events</h3>
                
                {upcomingSchedules.length === 0 && upcomingBookings.length === 0 ? (
                    <div className="text-center py-6">
                        <CalendarDays className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No upcoming events</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Combine and sort upcoming events and bookings */}
                        {[
                            ...upcomingSchedules.map(schedule => ({ type: 'schedule', item: schedule, date: new Date(`${schedule.date}T${schedule.start_time || '00:00:00'}`) })),
                            ...upcomingBookings.map(booking => ({ type: 'booking', item: booking, date: new Date(booking.start_time) }))
                        ]
                            .sort((a, b) => a.date.getTime() - b.date.getTime())
                            .slice(0, 8) // Show max 8 items
                            .map((entry, index) => {
                                if (entry.type === 'schedule') {
                                    const schedule = entry.item as Schedule;
                                    return (
                                        <div key={`upcoming-schedule-${schedule.id}-${index}`} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h5 className="font-medium text-gray-900">{schedule.title}</h5>
                                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>{schedule.date}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-4 h-4" />
                                                            <span>
                                                                {formatTime(schedule.start_time)}
                                                                {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scheduleHelpers.getStatusColor(schedule.status)}`}>
                                                    {schedule.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const booking = entry.item as Booking;
                                    return (
                                        <div key={`upcoming-booking-${booking.id}-${index}`} className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Monitor className="w-4 h-4 text-blue-600" />
                                                        <h5 className="font-medium text-gray-900">{booking.equipment.name}</h5>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>{new Date(booking.start_time).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-4 h-4" />
                                                            <span>
                                                                {new Date(booking.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                {' - '}
                                                                {new Date(booking.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </div>
                                                        {booking.equipment.location && (
                                                            <div className="flex items-center gap-1">
                                                                <MapPin className="w-4 h-4" />
                                                                <span>{booking.equipment.location}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {booking.status}
                                                    </span>
                                                    <button
                                                        onClick={() => handleCancelBooking(booking.id)}
                                                        disabled={cancellingId === booking.id}
                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
                                                        title="Cancel booking"
                                                    >
                                                        {cancellingId === booking.id ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default MyScheduleView;