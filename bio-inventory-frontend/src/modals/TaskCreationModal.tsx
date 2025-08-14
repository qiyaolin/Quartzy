import React, { useState, useEffect, useContext } from 'react';
import { 
    X, Calendar, Clock, Users, Repeat, Bell, Target, AlertTriangle,
    Plus, Trash2, User, FileText, MapPin, Settings, CheckCircle
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { buildApiUrl } from '../config/api.ts';

interface User {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
}

interface TaskCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskType: 'recurring' | 'one_time' | null;
    users: User[];
    onSuccess: () => void;
}

interface TaskFormData {
    // Basic Information
    name: string;
    description: string;
    
    // Task Configuration
    task_type: 'recurring' | 'one_time';
    priority: 'high' | 'medium' | 'low';
    category: 'system' | 'custom';
    
    // Scheduling
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    interval: number;
    start_date: string;
    end_date?: string;
    
    // Time Window (for one-time tasks or recurring execution windows)
    execution_start_date?: string;
    execution_end_date?: string;
    
    // Assignment
    min_people: number;
    max_people: number;
    default_people: number;
    assignee_group: number[];
    
    // Additional Settings
    estimated_hours?: number;
    reminder_days: number;
    auto_assign: boolean;
    email_notifications: boolean;
}

const TaskCreationModal: React.FC<TaskCreationModalProps> = ({
    isOpen,
    onClose,
    taskType,
    users,
    onSuccess
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('TaskCreationModal must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [formData, setFormData] = useState<TaskFormData>({
        name: '',
        description: '',
        task_type: taskType || 'one_time',
        priority: 'medium',
        category: 'custom',
        frequency: 'monthly',
        interval: 1,
        start_date: new Date().toISOString().split('T')[0],
        min_people: 1,
        max_people: 2,
        default_people: 1,
        assignee_group: [],
        estimated_hours: 1,
        reminder_days: 1,
        auto_assign: true,
        email_notifications: true
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = taskType === 'recurring' ? 4 : 3;

    // Update task type when prop changes
    useEffect(() => {
        if (taskType) {
            setFormData(prev => ({ 
                ...prev, 
                task_type: taskType,
                // Set reasonable defaults for one-time tasks
                ...(taskType === 'one_time' && {
                    execution_start_date: new Date().toISOString().split('T')[0],
                    execution_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
                    frequency: undefined,
                    interval: 1
                })
            }));
        }
    }, [taskType]);

    const handleInputChange = (field: keyof TaskFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleUserToggle = (userId: number) => {
        const currentAssignees = formData.assignee_group;
        const newAssignees = currentAssignees.includes(userId)
            ? currentAssignees.filter(id => id !== userId)
            : [...currentAssignees, userId];
        
        handleInputChange('assignee_group', newAssignees);
    };

    const validateStep = (step: number): boolean => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            // Basic Information
            if (!formData.name.trim()) {
                newErrors.name = 'Task name is required';
            }
            if (!formData.description.trim()) {
                newErrors.description = 'Task description is required';
            }
        } else if (step === 2) {
            // Scheduling
            if (formData.task_type === 'recurring') {
                if (!formData.frequency) {
                    newErrors.frequency = 'Frequency is required for recurring tasks';
                }
                if (!formData.start_date) {
                    newErrors.start_date = 'Start date is required';
                }
                if (!formData.end_date) {
                    newErrors.end_date = 'End date is required';
                }
                if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
                    newErrors.end_date = 'End date must be after start date';
                }
            } else {
                if (!formData.execution_start_date) {
                    newErrors.execution_start_date = 'Start date is required';
                }
                if (!formData.execution_end_date) {
                    newErrors.execution_end_date = 'End date is required';
                }
                if (formData.execution_start_date && formData.execution_end_date && 
                    formData.execution_start_date >= formData.execution_end_date) {
                    newErrors.execution_end_date = 'End date must be after start date';
                }
            }
        } else if (step === 3) {
            // Assignment
            if (formData.assignee_group.length === 0) {
                newErrors.assignee_group = 'At least one person must be assigned';
            }
            if (formData.min_people < 1) {
                newErrors.min_people = 'Minimum people must be at least 1';
            }
            if (formData.max_people < formData.min_people) {
                newErrors.max_people = 'Maximum people must be at least equal to minimum';
            }
            if (formData.default_people < formData.min_people || 
                formData.default_people > formData.max_people) {
                newErrors.default_people = 'Default people must be between minimum and maximum';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps));
        }
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        if (!validateStep(currentStep)) return;

        setIsSubmitting(true);
        try {
            const endpoint = formData.task_type === 'recurring' 
                ? '/api/schedule/task-templates/'
                : '/api/one-time-tasks/';

            // Prepare payload based on task type
            const payload = formData.task_type === 'recurring' 
                ? {
                    name: formData.name,
                    description: formData.description,
                    task_type: formData.task_type,
                    category: formData.category,
                    frequency: formData.frequency,
                    interval: formData.interval,
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    min_people: formData.min_people,
                    max_people: formData.max_people,
                    default_people: formData.default_people,
                    estimated_hours: formData.estimated_hours,
                    priority: formData.priority,
                    is_active: true
                }
                : {
                    name: formData.name,
                    description: formData.description,
                    deadline: formData.execution_end_date || formData.execution_start_date || formData.start_date,
                    remind_reoffer: false
                };

            // 1) Create template (recurring) or one-time task
            const response = await fetch(buildApiUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.message || 'Failed to create task');
            }

            const created = await response.json();

            // 2) If recurring: assign selected users to rotation queue, then generate instances for the specified date range
            if (formData.task_type === 'recurring') {
                // 2.1) Assign selected users into rotation queue for this template (compat endpoint)
                try {
                    const selectedUserIds = formData.assignee_group || [];
                    if (selectedUserIds.length > 0) {
                        const assignRes = await fetch(buildApiUrl(`/api/recurring-tasks/${created.id}/assign/`), {
                            method: 'POST',
                            headers: {
                                'Authorization': `Token ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ user_ids: selectedUserIds })
                        });
                        if (!assignRes.ok) {
                            const err = await assignRes.json().catch(() => ({}));
                            throw new Error(err.error || err.detail || 'Failed to assign rotation members');
                        }
                    }
                } catch (e) {
                    throw e instanceof Error ? e : new Error('Failed to assign rotation members');
                }

                // Compute YYYY-MM periods between start_date and end_date (inclusive)
                const periods: string[] = [];
                const start = new Date(formData.start_date);
                const end = new Date(formData.end_date!);
                const cur = new Date(start.getFullYear(), start.getMonth(), 1);
                const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
                while (cur <= endMonth) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, '0');
                    periods.push(`${y}-${m}`);
                    cur.setMonth(cur.getMonth() + 1);
                }

                const genRes = await fetch(buildApiUrl('api/schedule/tasks/generate/'), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        periods,
                        template_ids: [created.id],
                        preview_only: false
                    })
                });

                if (!genRes.ok) {
                    const err = await genRes.json().catch(() => ({}));
                    throw new Error(err.error || err.detail || 'Failed to generate task instances');
                }
            }

            onSuccess();
            resetForm();
        } catch (error) {
            console.error('Error creating task:', error);
            setErrors({ submit: error instanceof Error ? error.message : 'Network error occurred' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            task_type: taskType || 'one_time',
            priority: 'medium',
            category: 'custom',
            frequency: 'monthly',
            interval: 1,
            start_date: new Date().toISOString().split('T')[0],
            min_people: 1,
            max_people: 2,
            default_people: 1,
            assignee_group: [],
            estimated_hours: 1,
            reminder_days: 1,
            auto_assign: true,
            email_notifications: true
        });
        setErrors({});
        setCurrentStep(1);
    };

    if (!isOpen || !taskType) return null;

    const isRecurring = formData.task_type === 'recurring';
    const selectedUsers = users.filter(user => formData.assignee_group.includes(user.id));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isRecurring ? 'bg-blue-100' : 'bg-green-100'}`}>
                            {isRecurring ? (
                                <Repeat className="w-5 h-5 text-blue-600" />
                            ) : (
                                <Target className="w-5 h-5 text-green-600" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Create {isRecurring ? 'Recurring' : 'One-Time'} Task
                            </h2>
                            <p className="text-sm text-gray-600">
                                {isRecurring 
                                    ? 'Set up a task that repeats automatically on schedule'
                                    : 'Create a single task that can be claimed by lab members'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                            <div key={step} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    step <= currentStep 
                                        ? 'bg-primary-600 text-white' 
                                        : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {step}
                                </div>
                                {step < totalSteps && (
                                    <div className={`w-16 h-0.5 mx-2 ${
                                        step < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-gray-600">Basic Info</span>
                        <span className="text-xs text-gray-600">Scheduling</span>
                        <span className="text-xs text-gray-600">Assignment</span>
                        {isRecurring && <span className="text-xs text-gray-600">Settings</span>}
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                    {/* Step 1: Basic Information */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                                
                                <div className="space-y-4">
                                    {/* Task Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Task Name *
                                        </label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => handleInputChange('name', e.target.value)}
                                                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                    errors.name ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                placeholder={isRecurring 
                                                    ? "e.g., Cell Culture Room Weekly Cleaning"
                                                    : "e.g., Pick up lab supplies delivery"
                                                }
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description *
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => handleInputChange('description', e.target.value)}
                                            rows={4}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none ${
                                                errors.description ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                            placeholder={isRecurring 
                                                ? "Detailed instructions for cleaning the cell culture room, including specific areas to focus on and safety protocols to follow..."
                                                : "Go to the main office to collect the ordered lab supplies. Check with reception and verify delivery receipt..."
                                            }
                                            disabled={isSubmitting}
                                        />
                                        {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Priority Level
                                        </label>
                                        <select
                                            value={formData.priority}
                                            onChange={(e) => handleInputChange('priority', e.target.value as any)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            disabled={isSubmitting}
                                        >
                                            <option value="low">Low Priority</option>
                                            <option value="medium">Medium Priority</option>
                                            <option value="high">High Priority</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Scheduling */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Scheduling</h3>
                                
                                {isRecurring ? (
                                    <div className="space-y-4">
                                        {/* Frequency */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Frequency *
                                            </label>
                                            <select
                                                value={formData.frequency}
                                                onChange={(e) => handleInputChange('frequency', e.target.value as any)}
                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                    errors.frequency ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                disabled={isSubmitting}
                                            >
                                                <option value="">Select frequency</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="quarterly">Quarterly</option>
                                            </select>
                                            {errors.frequency && <p className="text-red-500 text-sm mt-1">{errors.frequency}</p>}
                                        </div>

                                        {/* Interval */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Every {formData.frequency ? formData.frequency.replace('ly', '') : ''}(s)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="12"
                                                value={formData.interval}
                                                onChange={(e) => handleInputChange('interval', Number(e.target.value))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                disabled={isSubmitting}
                                            />
                                        </div>

                                        {/* Start Date */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Start Date
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.start_date}
                                                onChange={(e) => handleInputChange('start_date', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                disabled={isSubmitting}
                                            />
                                        </div>

                                        {/* End Date (Optional) */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                End Date (Optional)
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.end_date || ''}
                                                onChange={(e) => handleInputChange('end_date', e.target.value || undefined)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                disabled={isSubmitting}
                                            />
                                            <p className="text-sm text-gray-500 mt-1">Leave empty for indefinite recurrence</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Execution Window */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Available From *
                                                </label>
                                                <input
                                                    type="date"
                                                    value={formData.execution_start_date || ''}
                                                    onChange={(e) => handleInputChange('execution_start_date', e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                        errors.execution_start_date ? 'border-red-300' : 'border-gray-300'
                                                    }`}
                                                    disabled={isSubmitting}
                                                />
                                                {errors.execution_start_date && <p className="text-red-500 text-sm mt-1">{errors.execution_start_date}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Must Complete By *
                                                </label>
                                                <input
                                                    type="date"
                                                    value={formData.execution_end_date || ''}
                                                    onChange={(e) => handleInputChange('execution_end_date', e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                        errors.execution_end_date ? 'border-red-300' : 'border-gray-300'
                                                    }`}
                                                    disabled={isSubmitting}
                                                />
                                                {errors.execution_end_date && <p className="text-red-500 text-sm mt-1">{errors.execution_end_date}</p>}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-start gap-2">
                                                <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-blue-900">One-Time Task Window</p>
                                                    <p className="text-sm text-blue-700">
                                                        This task will be available for claiming from the start date until the completion deadline.
                                                        Once claimed, the assigned person must complete it by the deadline.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Assignment */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Configuration</h3>
                                
                                <div className="space-y-4">
                                    {/* People Requirements */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Min People *
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.min_people}
                                                onChange={(e) => handleInputChange('min_people', Number(e.target.value))}
                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                    errors.min_people ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                disabled={isSubmitting}
                                            />
                                            {errors.min_people && <p className="text-red-500 text-sm mt-1">{errors.min_people}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Max People *
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.max_people}
                                                onChange={(e) => handleInputChange('max_people', Number(e.target.value))}
                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                    errors.max_people ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                disabled={isSubmitting}
                                            />
                                            {errors.max_people && <p className="text-red-500 text-sm mt-1">{errors.max_people}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Default People *
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.default_people}
                                                onChange={(e) => handleInputChange('default_people', Number(e.target.value))}
                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                                    errors.default_people ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                disabled={isSubmitting}
                                            />
                                            {errors.default_people && <p className="text-red-500 text-sm mt-1">{errors.default_people}</p>}
                                        </div>
                                    </div>

                                    {/* Assignee Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Eligible Members * ({selectedUsers.length} selected)
                                        </label>
                                        <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                                            {users.length === 0 ? (
                                                <p className="text-gray-500 text-sm">No users available</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {users.map((user) => (
                                                        <label key={user.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.assignee_group.includes(user.id)}
                                                                onChange={() => handleUserToggle(user.id)}
                                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                                disabled={isSubmitting}
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <User className="w-4 h-4 text-gray-400" />
                                                                <span className="text-sm text-gray-900">
                                                                    {user.first_name} {user.last_name} ({user.username})
                                                                </span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {errors.assignee_group && <p className="text-red-500 text-sm mt-1">{errors.assignee_group}</p>}
                                    </div>

                                    {/* Assignment Preview */}
                                    {selectedUsers.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-blue-900 mb-2">Assignment Preview</h4>
                                            <p className="text-sm text-blue-700">
                                                {isRecurring 
                                                    ? `Tasks will rotate among: ${selectedUsers.map(u => u.first_name).join(', ')}`
                                                    : `This task can be claimed by any of: ${selectedUsers.map(u => u.first_name).join(', ')}`
                                                }
                                            </p>
                                            <p className="text-sm text-blue-600 mt-1">
                                                Typically {formData.default_people} person(s) will be assigned per instance.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Additional Settings (Recurring Only) */}
                    {currentStep === 4 && isRecurring && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Settings</h3>
                                
                                <div className="space-y-4">
                                    {/* Estimated Hours */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Estimated Hours
                                        </label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            max="24"
                                            step="0.5"
                                            value={formData.estimated_hours || ''}
                                            onChange={(e) => handleInputChange('estimated_hours', e.target.value ? Number(e.target.value) : undefined)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            disabled={isSubmitting}
                                        />
                                        <p className="text-sm text-gray-500 mt-1">Estimated time to complete this task</p>
                                    </div>

                                    {/* Reminder Settings */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Reminder (days before due)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="30"
                                            value={formData.reminder_days}
                                            onChange={(e) => handleInputChange('reminder_days', Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    {/* Auto Assignment */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="auto_assign"
                                                checked={formData.auto_assign}
                                                onChange={(e) => handleInputChange('auto_assign', e.target.checked)}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                disabled={isSubmitting}
                                            />
                                            <label htmlFor="auto_assign" className="text-sm font-medium text-gray-700">
                                                Auto-assign tasks using rotation system
                                            </label>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="email_notifications"
                                                checked={formData.email_notifications}
                                                onChange={(e) => handleInputChange('email_notifications', e.target.checked)}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                disabled={isSubmitting}
                                            />
                                            <label htmlFor="email_notifications" className="text-sm font-medium text-gray-700">
                                                Send email notifications to assigned users
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit Error */}
                    {errors.submit && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <p className="text-red-600 text-sm">{errors.submit}</p>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-6 border-t border-gray-200">
                        <button
                            onClick={handlePrevStep}
                            className={`inline-flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors ${currentStep === 1 ? 'invisible' : ''}`}
                            disabled={isSubmitting}
                        >
                            Previous
                        </button>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="inline-flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            
                            {currentStep < totalSteps ? (
                                <button
                                    onClick={handleNextStep}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Next Step
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Create Task
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskCreationModal;