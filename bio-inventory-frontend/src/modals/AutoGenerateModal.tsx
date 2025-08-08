import React, { useState, useEffect } from 'react';
import { 
    X, Calendar, Users, Settings, Clock, MapPin, 
    CheckCircle, AlertCircle, Info 
} from 'lucide-react';
import { RecurringTask, User as TaskUser } from '../services/groupMeetingApi.ts';

interface AutoGenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: RecurringTask[];
    users: TaskUser[];
    onGenerate: (config: AutoGenerateConfig) => Promise<void>;
    isSubmitting?: boolean;
}

export interface AutoGenerateConfig {
    startDate: string;
    endDate: string;
    selectedTaskIds: number[];
    selectedUserIds: number[];
    rotationSettings: {
        avoidConsecutive: boolean;
        maxAssignmentsPerPeriod: number;
        balanceWorkload: boolean;
    };
}

const AutoGenerateModal: React.FC<AutoGenerateModalProps> = ({
    isOpen,
    onClose,
    tasks,
    users,
    onGenerate,
    isSubmitting = false
}) => {
    // Form state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [avoidConsecutive, setAvoidConsecutive] = useState(true);
    const [maxAssignmentsPerPeriod, setMaxAssignmentsPerPeriod] = useState(2);
    const [balanceWorkload, setBalanceWorkload] = useState(true);
    const [errors, setErrors] = useState<string[]>([]);

    // Initialize dates
    useEffect(() => {
        if (isOpen && !startDate) {
            const today = new Date();
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 4, 0);
            
            setStartDate(nextMonth.toISOString().split('T')[0]);
            setEndDate(threeMonthsLater.toISOString().split('T')[0]);
        }
        
        // Select all active tasks by default
        if (isOpen && selectedTaskIds.length === 0) {
            setSelectedTaskIds(tasks.filter(t => t.is_active).map(t => t.id));
        }
        
        // Select all eligible users by default
        if (isOpen && selectedUserIds.length === 0) {
            const eligibleUsers = users.filter(u => 
                u.is_active && 
                !['admin', 'print_server'].includes(u.username.toLowerCase())
            );
            setSelectedUserIds(eligibleUsers.map(u => u.id));
        }
    }, [isOpen, tasks, users, startDate, selectedTaskIds, selectedUserIds]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setErrors([]);
        }
    }, [isOpen]);

    const validateForm = (): boolean => {
        const newErrors: string[] = [];

        if (!startDate) newErrors.push('Start date is required');
        if (!endDate) newErrors.push('End date is required');
        if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
            newErrors.push('End date must be after start date');
        }
        if (selectedTaskIds.length === 0) {
            newErrors.push('At least one task must be selected');
        }
        if (selectedUserIds.length === 0) {
            newErrors.push('At least one user must be selected');
        }

        // Check if we have enough users for the selected tasks
        const maxRequiredUsers = Math.max(...tasks
            .filter(t => selectedTaskIds.includes(t.id))
            .map(t => t.assignee_count)
        );
        if (selectedUserIds.length < maxRequiredUsers) {
            newErrors.push(`At least ${maxRequiredUsers} users required for selected tasks`);
        }

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        const config: AutoGenerateConfig = {
            startDate,
            endDate,
            selectedTaskIds,
            selectedUserIds,
            rotationSettings: {
                avoidConsecutive,
                maxAssignmentsPerPeriod,
                balanceWorkload
            }
        };

        try {
            await onGenerate(config);
            onClose();
        } catch (error) {
            console.error('Auto-generate failed:', error);
            setErrors([error instanceof Error ? error.message : 'Auto-generation failed']);
        }
    };

    const toggleTaskSelection = (taskId: number) => {
        setSelectedTaskIds(prev => 
            prev.includes(taskId) 
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId]
        );
    };

    const toggleUserSelection = (userId: number) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const getEstimatedTaskCount = (): number => {
        if (!startDate || !endDate || selectedTaskIds.length === 0) return 0;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        let totalTasks = 0;
        tasks.filter(t => selectedTaskIds.includes(t.id)).forEach(task => {
            switch (task.frequency) {
                case 'monthly':
                    totalTasks += Math.ceil(daysDiff / 30);
                    break;
                case 'quarterly':
                    totalTasks += Math.ceil(daysDiff / 90);
                    break;
            }
        });
        
        return totalTasks;
    };

    if (!isOpen) return null;

    const activeTasks = tasks.filter(t => t.is_active);
    const eligibleUsers = users.filter(u => 
        u.is_active && 
        !['admin', 'print_server'].includes(u.username.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Auto-Generate Recurring Tasks
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Create multiple recurring task instances with intelligent user rotation
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Configuration */}
                        <div className="space-y-6">
                            {/* Date Range */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    Generation Period
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Rotation Settings */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                                    <Settings className="w-5 h-5 mr-2" />
                                    Rotation Settings
                                </h3>
                                <div className="space-y-3">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={avoidConsecutive}
                                            onChange={(e) => setAvoidConsecutive(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isSubmitting}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">
                                            Avoid consecutive assignments
                                        </span>
                                    </label>
                                    
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={balanceWorkload}
                                            onChange={(e) => setBalanceWorkload(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isSubmitting}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">
                                            Balance workload across users
                                        </span>
                                    </label>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Max assignments per user per period
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={maxAssignmentsPerPeriod}
                                            onChange={(e) => setMaxAssignmentsPerPeriod(parseInt(e.target.value) || 1)}
                                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Estimation */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-blue-800 mb-2">
                                    <Info className="w-5 h-5" />
                                    <span className="font-medium">Generation Preview</span>
                                </div>
                                <p className="text-sm text-blue-700">
                                    Estimated tasks to generate: <strong>{getEstimatedTaskCount()}</strong>
                                </p>
                                <p className="text-sm text-blue-700">
                                    Selected users: <strong>{selectedUserIds.length}</strong>
                                </p>
                                <p className="text-sm text-blue-700">
                                    Selected task types: <strong>{selectedTaskIds.length}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Right Column - Selection */}
                        <div className="space-y-6">
                            {/* Task Selection */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    Select Tasks ({selectedTaskIds.length}/{activeTasks.length})
                                </h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                                    {activeTasks.map(task => (
                                        <label key={task.id} className="flex items-start">
                                            <input
                                                type="checkbox"
                                                checked={selectedTaskIds.includes(task.id)}
                                                onChange={() => toggleTaskSelection(task.id)}
                                                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                disabled={isSubmitting}
                                            />
                                            <div className="ml-2 min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {task.title}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {task.frequency}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {task.assignee_count} people
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {task.location}
                                                    </span>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTaskIds(activeTasks.map(t => t.id))}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                        disabled={isSubmitting}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTaskIds([])}
                                        className="text-sm text-gray-600 hover:text-gray-800"
                                        disabled={isSubmitting}
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>

                            {/* User Selection */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                                    <Users className="w-5 h-5 mr-2" />
                                    Select Personnel ({selectedUserIds.length}/{eligibleUsers.length})
                                </h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                                    {eligibleUsers.map(user => (
                                        <label key={user.id} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.includes(user.id)}
                                                onChange={() => toggleUserSelection(user.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                disabled={isSubmitting}
                                            />
                                            <span className="ml-2 text-sm text-gray-900">
                                                {user.first_name} {user.last_name} ({user.username})
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUserIds(eligibleUsers.map(u => u.id))}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                        disabled={isSubmitting}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUserIds([])}
                                        className="text-sm text-gray-600 hover:text-gray-800"
                                        disabled={isSubmitting}
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Error Display */}
                    {errors.length > 0 && (
                        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start">
                                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
                                <div>
                                    <h3 className="text-sm font-medium text-red-800">
                                        Please fix the following errors:
                                    </h3>
                                    <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                                        {errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || errors.length > 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        {isSubmitting ? 'Generating...' : 'Generate Tasks'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutoGenerateModal;