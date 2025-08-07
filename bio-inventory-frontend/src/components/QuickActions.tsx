import React, { useState, useContext } from 'react';
import {
    Zap, Monitor, Clock, CheckCircle, AlertTriangle, 
    Plus, ArrowRight, Timer, CalendarCheck
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { buildApiUrl } from '../config/api.ts';

interface Equipment {
    id: number;
    name: string;
    location: string;
    is_bookable: boolean;
    requires_qr_checkin: boolean;
    is_in_use: boolean;
}

interface QuickBookingData {
    equipment_id: number;
    duration_minutes: number;
    start_time?: string;
    auto_checkin?: boolean;
}

interface TaskCompletionData {
    task_id: number;
    completion_notes: string;
    completion_duration?: number;
    completion_rating?: number;
}

interface QuickActionsProps {
    availableEquipment?: Equipment[];
    onEquipmentBooked?: (booking: any) => void;
    onTaskCompleted?: (taskId: number) => void;
    onRefreshNeeded?: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
    availableEquipment = [],
    onEquipmentBooked,
    onTaskCompleted,
    onRefreshNeeded
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('QuickActions must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [isQuickBookModalOpen, setIsQuickBookModalOpen] = useState(false);
    const [isTaskCompletionModalOpen, setIsTaskCompletionModalOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const quickBookEquipment = async (bookingData: QuickBookingData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(
                buildApiUrl('schedule/quick-actions/quick_book_equipment/'),
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bookingData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to book equipment');
            }

            setActionStatus({ type: 'success', message: data.message });
            onEquipmentBooked?.(data.booking);
            onRefreshNeeded?.();
            setIsQuickBookModalOpen(false);
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => setActionStatus(null), 3000);
        } catch (error) {
            setActionStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to book equipment'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const completeTask = async (completionData: TaskCompletionData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(
                buildApiUrl('schedule/quick-actions/complete_task/'),
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(completionData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to complete task');
            }

            setActionStatus({ type: 'success', message: data.message });
            onTaskCompleted?.(completionData.task_id);
            onRefreshNeeded?.();
            setIsTaskCompletionModalOpen(false);
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => setActionStatus(null), 3000);
        } catch (error) {
            setActionStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to complete task'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openQuickBookModal = (equipment: Equipment) => {
        setSelectedEquipment(equipment);
        setIsQuickBookModalOpen(true);
    };

    const openTaskCompletionModal = (taskId: number) => {
        setSelectedTaskId(taskId);
        setIsTaskCompletionModalOpen(true);
    };

    return (
        <div className="space-y-4">
            {/* Action Status */}
            {actionStatus && (
                <div className={`border rounded-lg p-4 ${
                    actionStatus.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {actionStatus.type === 'success' ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <AlertTriangle className="w-4 h-4" />
                        )}
                        <span className="font-medium">{actionStatus.message}</span>
                    </div>
                </div>
            )}

            {/* Quick Actions Grid */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Available Equipment Quick Book */}
                    {availableEquipment.filter(eq => eq.is_bookable && !eq.is_in_use).map((equipment) => (
                        <div
                            key={equipment.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => openQuickBookModal(equipment)}
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Monitor className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium text-gray-900 mb-1">Quick Book</h4>
                                    <p className="text-sm text-gray-600">{equipment.name}</p>
                                    <p className="text-xs text-gray-500 mb-2">{equipment.location}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                            Available
                                        </span>
                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {availableEquipment.filter(eq => eq.is_bookable && !eq.is_in_use).length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No equipment available for quick booking</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Book Modal */}
            {isQuickBookModalOpen && selectedEquipment && (
                <QuickBookModal
                    equipment={selectedEquipment}
                    isSubmitting={isSubmitting}
                    onClose={() => setIsQuickBookModalOpen(false)}
                    onSubmit={quickBookEquipment}
                />
            )}

            {/* Task Completion Modal */}
            {isTaskCompletionModalOpen && selectedTaskId && (
                <TaskCompletionModal
                    taskId={selectedTaskId}
                    isSubmitting={isSubmitting}
                    onClose={() => setIsTaskCompletionModalOpen(false)}
                    onSubmit={completeTask}
                />
            )}
        </div>
    );
};

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
    const [duration, setDuration] = useState(60);
    const [startTime, setStartTime] = useState('');
    const [autoCheckin, setAutoCheckin] = useState(equipment.requires_qr_checkin);

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
                            <h3 className="text-lg font-semibold text-gray-900">Quick Book Equipment</h3>
                            <p className="text-sm text-gray-600">{equipment.name}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Duration
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {durationOptions.map((minutes) => (
                                    <button
                                        key={minutes}
                                        type="button"
                                        onClick={() => setDuration(minutes)}
                                        className={`px-3 py-2 text-sm rounded border ${
                                            duration === minutes
                                                ? 'bg-primary-600 text-white border-primary-600'
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Start now"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave empty to start immediately
                            </p>
                        </div>

                        {equipment.requires_qr_checkin && (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="autoCheckin"
                                    checked={autoCheckin}
                                    onChange={(e) => setAutoCheckin(e.target.checked)}
                                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="autoCheckin" className="ml-2 text-sm text-gray-700">
                                    Auto check-in (skip QR scan)
                                </label>
                            </div>
                        )}

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
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
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

interface TaskCompletionModalProps {
    taskId: number;
    isSubmitting: boolean;
    onClose: () => void;
    onSubmit: (data: TaskCompletionData) => void;
}

const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
    taskId,
    isSubmitting,
    onClose,
    onSubmit
}) => {
    const [notes, setNotes] = useState('');
    const [duration, setDuration] = useState<number | undefined>();
    const [rating, setRating] = useState<number | undefined>();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const completionData: TaskCompletionData = {
            task_id: taskId,
            completion_notes: notes,
        };

        if (duration) {
            completionData.completion_duration = duration;
        }
        if (rating) {
            completionData.completion_rating = rating;
        }

        onSubmit(completionData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Complete Task</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Completion Notes
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Describe what was accomplished..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Time Spent (minutes, optional)
                            </label>
                            <input
                                type="number"
                                value={duration || ''}
                                onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : undefined)}
                                min="1"
                                max="480"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="e.g., 60"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Difficulty Rating (1-5, optional)
                            </label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setRating(rating === value ? undefined : value)}
                                        className={`w-8 h-8 rounded-full border text-sm font-medium ${
                                            rating === value
                                                ? 'bg-primary-600 text-white border-primary-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                1 = Very Easy, 5 = Very Difficult
                            </p>
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
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Completing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        Complete Task
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

export default QuickActions;