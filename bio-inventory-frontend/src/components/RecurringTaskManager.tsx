import React, { useState, useEffect, useContext } from 'react';
import { 
    Calendar, Clock, Users, MapPin, Plus, Edit3, Settings, 
    Repeat, CheckCircle, AlertCircle, User, Trash2, MoreHorizontal,
    Beaker, TestTube, Brush
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { 
    groupMeetingApi, 
    RecurringTask, 
    User as TaskUser 
} from '../services/groupMeetingApi.ts';
import EditTaskModal, { EditTaskData } from '../modals/EditTaskModal.tsx';

interface RecurringTaskManagerProps {
    onCreateTask?: () => void;
}

const RecurringTaskManager: React.FC<RecurringTaskManagerProps> = ({
    onCreateTask
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    const [tasks, setTasks] = useState<RecurringTask[]>([]);
    const [users, setUsers] = useState<TaskUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<RecurringTask | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load data
    useEffect(() => {
        if (!token) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const [tasksData, usersData] = await Promise.all([
                    groupMeetingApi.getRecurringTasks(token),
                    groupMeetingApi.getActiveUsers(token)
                ]);

                setTasks(tasksData);
                setUsers(usersData.filter(u => u.username !== 'admin' && u.username !== 'print_server'));
                setError(null);
            } catch (err) {
                setError('Failed to load recurring tasks data');
                console.error('Error loading recurring tasks:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [token]);

    const handleAssignTask = async (task: RecurringTask) => {
        if (!token) return;

        try {
            // Auto-select users based on task requirements
            const eligibleUsers = users.filter(u => u.is_active);
            const selectedUserIds = autoSelectUsers(eligibleUsers, task);

            await groupMeetingApi.assignRecurringTask(token, task.id, selectedUserIds);
            
            // Update local state
            setTasks(prev => prev.map(t => 
                t.id === task.id 
                    ? { ...t, last_assigned_user_ids: selectedUserIds, last_assigned_date: new Date().toISOString() }
                    : t
            ));

        } catch (error) {
            console.error('Failed to assign task:', error);
            setError('Failed to assign task. Please try again.');
        }
    };

    const autoSelectUsers = (eligibleUsers: TaskUser[], task: RecurringTask): number[] => {
        // Simple rotation logic - in real implementation, this would consider:
        // - Previous assignments to avoid consecutive assignments
        // - User workload balancing
        // - User preferences/availability
        
        const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, task.assignee_count).map(u => u.id);
    };

    const handleEditTask = (task: RecurringTask) => {
        setSelectedTask(task);
        setShowEditModal(true);
    };

    const handleEditSubmit = async (editData: EditTaskData) => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            // In real implementation, this would call the API
            console.log('Task updated:', editData);
            
            // Simulate API response
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update local state
            setTasks(prev => prev.map(t => 
                t.id === editData.taskId 
                    ? { 
                        ...t, 
                        title: editData.title,
                        description: editData.description,
                        location: editData.location,
                        frequency: editData.frequency,
                        estimated_duration_hours: editData.estimated_duration_hours,
                        assignee_count: editData.assignee_count,
                        auto_assign: editData.auto_assign,
                        reminder_days: editData.reminder_days,
                        task_type: editData.task_type
                    }
                    : t
            ));
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfigureTask = async (task: RecurringTask) => {
        try {
            // Open a configuration modal with advanced settings
            const newFrequency = prompt(`Current frequency: ${task.frequency}\nEnter new frequency (daily, weekly, monthly, quarterly):`, task.frequency);
            if (newFrequency && ['daily', 'weekly', 'monthly', 'quarterly'].includes(newFrequency)) {
                // Update task frequency
                setTasks(prev => prev.map(t => 
                    t.id === task.id 
                        ? { ...t, frequency: newFrequency as any }
                        : t
                ));
                console.log(`Task ${task.title} frequency updated to ${newFrequency}`);
            }
        } catch (error) {
            console.error('Error configuring task:', error);
            setError('Failed to configure task');
        }
    };

    const getTaskIcon = (taskType: string) => {
        switch (taskType) {
            case 'cell_culture_room_cleaning':
                return <Brush className="w-5 h-5" />;
            case 'cell_culture_incubator_cleaning':
                return <TestTube className="w-5 h-5" />;
            default:
                return <Repeat className="w-5 h-5" />;
        }
    };

    const getTaskTypeColor = (taskType: string) => {
        switch (taskType) {
            case 'cell_culture_room_cleaning':
                return 'bg-blue-100 text-blue-800';
            case 'cell_culture_incubator_cleaning':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getFrequencyColor = (frequency: string) => {
        switch (frequency) {
            case 'monthly':
                return 'bg-orange-100 text-orange-800';
            case 'quarterly':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const isTaskDue = (dueDate: string): boolean => {
        return new Date(dueDate) <= new Date();
    };

    const getAssignedUsers = (task: RecurringTask): TaskUser[] => {
        if (!task.last_assigned_user_ids) return [];
        return users.filter(u => task.last_assigned_user_ids!.includes(u.id));
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
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Recurring Tasks</h2>
                        <p className="text-gray-600">Automated task management with intelligent user assignment</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {onCreateTask && (
                            <button
                                onClick={onCreateTask}
                                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Task
                            </button>
                        )}
                    </div>
                </div>

                {/* Task Overview */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800 mb-2">
                        <Repeat className="w-5 h-5" />
                        <span className="font-medium">Automated Task Management</span>
                    </div>
                    <p className="text-sm text-green-700">
                        System automatically creates and assigns maintenance tasks to team members in rotation.
                        Tasks are auto-generated based on frequency and assigned to eligible users excluding admin and print_server.
                    </p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Repeat className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Active Tasks</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {tasks.filter(t => t.is_active).length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Due Tasks</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {tasks.filter(t => isTaskDue(t.next_due_date)).length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Brush className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Room Cleaning</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {tasks.filter(t => t.task_type === 'cell_culture_room_cleaning').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <TestTube className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Incubator Cleaning</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {tasks.filter(t => t.task_type === 'cell_culture_incubator_cleaning').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Tasks List */}
            <div className="bg-white rounded-lg border border-gray-200">
                {tasks.length === 0 ? (
                    <div className="p-8 text-center">
                        <Repeat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No recurring tasks configured</h3>
                        <p className="text-gray-600">Create your first recurring task to get started</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {tasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                assignedUsers={getAssignedUsers(task)}
                                onAssign={() => handleAssignTask(task)}
                                getTaskIcon={getTaskIcon}
                                getTaskTypeColor={getTaskTypeColor}
                                getFrequencyColor={getFrequencyColor}
                                isTaskDue={isTaskDue}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Task Modal */}
            <EditTaskModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                task={selectedTask}
                onSubmit={handleEditSubmit}
                isSubmitting={isSubmitting}
            />
        </div>
    );
};

// Task Card Component
interface TaskCardProps {
    task: RecurringTask;
    assignedUsers: TaskUser[];
    onAssign: () => void;
    getTaskIcon: (type: string) => React.ReactNode;
    getTaskTypeColor: (type: string) => string;
    getFrequencyColor: (frequency: string) => string;
    isTaskDue: (date: string) => boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    assignedUsers,
    onAssign,
    getTaskIcon,
    getTaskTypeColor,
    getFrequencyColor,
    isTaskDue
}) => {
    const [showActions, setShowActions] = useState(false);
    const isDue = isTaskDue(task.next_due_date);

    return (
        <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${getTaskTypeColor(task.task_type).replace('text-', 'text-').replace('bg-', 'bg-')}`}>
                            {getTaskIcon(task.task_type)}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                            
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFrequencyColor(task.frequency)}`}>
                                {task.frequency}
                            </span>
                            
                            {isDue && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Due Now
                                </span>
                            )}
                            
                            {!task.is_active && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Inactive
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{task.location}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{task.estimated_duration_hours}h estimated</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{task.assignee_count} assignee{task.assignee_count > 1 ? 's' : ''}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Due: {new Date(task.next_due_date).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Current Assignment */}
                    {assignedUsers.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Current Assignment</h4>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                <span className="text-sm text-blue-700">
                                    {assignedUsers.map(u => `${u.first_name} ${u.last_name}`).join(', ')}
                                </span>
                                {task.last_assigned_date && (
                                    <span className="text-xs text-blue-600">
                                        (Assigned: {new Date(task.last_assigned_date).toLocaleDateString()})
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Auto-assignment Info */}
                    {task.auto_assign && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-green-800 mb-1">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Auto-Assignment Enabled</span>
                            </div>
                            <p className="text-xs text-green-700">
                                System will automatically assign this task to {task.assignee_count} eligible team member{task.assignee_count > 1 ? 's' : ''} when due.
                                Excludes admin and print_server accounts.
                            </p>
                        </div>
                    )}
                </div>
                
                <div className="relative ml-4">
                    <button
                        onClick={() => setShowActions(!showActions)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    {showActions && (
                        <div className="absolute right-0 top-10 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                            <div className="py-1">
                                <button
                                    onClick={() => {
                                        onAssign();
                                        setShowActions(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Users className="w-4 h-4 inline mr-2" />
                                    Assign Now
                                </button>
                                
                                <button
                                    onClick={() => {
                                        handleEditTask(task);
                                        setShowActions(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Edit3 className="w-4 h-4 inline mr-2" />
                                    Edit Task
                                </button>
                                
                                <button
                                    onClick={() => {
                                        handleConfigureTask(task);
                                        setShowActions(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Settings className="w-4 h-4 inline mr-2" />
                                    Configure
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecurringTaskManager;