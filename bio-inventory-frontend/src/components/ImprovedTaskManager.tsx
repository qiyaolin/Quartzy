import React, { useState, useEffect, useContext } from 'react';
import { 
    Plus, Calendar, Clock, Users, Repeat, CheckCircle, AlertCircle, 
    Edit, Trash2, Settings, User, Bell, ArrowRight, PlayCircle, 
    UserCheck, MessageSquare, Timer, Archive, RefreshCw,
    ClipboardList, Target, ArrowLeftRight
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import TaskCreationModal from '../modals/TaskCreationModal.tsx';
import { groupMeetingApi } from '../services/groupMeetingApi.ts';
import { periodicTaskApi, scheduleApi, type PeriodicTaskInstance } from '../services/scheduleApi.ts';
import { buildApiUrl } from '../config/api.ts';
import TaskSwapRequestModal, { TaskSwapFormData } from '../modals/TaskSwapRequestModal.tsx';

// Task Types aligned with backend models
interface TaskTemplate {
    id: number;
    name: string;
    description: string;
    task_type: 'recurring' | 'one_time';
    category: 'system' | 'custom';
    frequency?: string;
    interval: number;
    start_date: string;
    end_date?: string;
    min_people: number;
    max_people: number;
    default_people: number;
    estimated_hours?: number;
    priority: 'high' | 'medium' | 'low';
    is_active: boolean;
    created_at: string;
    created_by: {
        id: number;
        username: string;
        first_name: string;
        last_name: string;
    };
}

type TaskInstance = PeriodicTaskInstance;

interface User {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

const ImprovedTaskManager: React.FC = () => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('ImprovedTaskManager must be used within an AuthProvider');
    }
    const { token, user } = authContext;
    const isAdmin = user?.is_staff || false;

    // State management
    const [activeTab, setActiveTab] = useState<'templates' | 'instances' | 'my-tasks'>('instances');
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
    const [taskInstances, setTaskInstances] = useState<TaskInstance[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [pendingSwapTaskIds, setPendingSwapTaskIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTaskType, setSelectedTaskType] = useState<'recurring' | 'one_time' | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

    // Load data on component mount
    useEffect(() => {
        loadData();
    }, [token]);

    const loadData = async () => {
        if (!token) return;
        
        setLoading(true);
        try {
            await Promise.all([
                loadTaskTemplates(),
                loadTaskInstances(),
                loadUsers(),
                loadPendingSwapRequests()
            ]);
        } catch (error) {
            console.error('Error loading task data:', error);
            setError('Failed to load task data');
        } finally {
            setLoading(false);
        }
    };

    const loadTaskTemplates = async () => {
        try {
            // Load periodic task templates from schedule API
            const tasks = await periodicTaskApi.getTaskTemplates(token);
            setTaskTemplates(tasks || []);
        } catch (error) {
            console.error('Error loading task templates:', error);
            setError('Failed to load task templates');
        }
    };

    const loadTaskInstances = async () => {
        try {
            const tasks = await periodicTaskApi.getPeriodicTasks(token);
            setTaskInstances(tasks || []);
        } catch (error) {
            console.error('Error loading task instances:', error);
            setError('Failed to load task instances');
        }
    };

    const loadPendingSwapRequests = async () => {
        try {
            const all = await scheduleApi.getTaskSwapRequests(token, {});
            const minePending = (all || []).filter(r => r.from_user?.id === user?.id && r.status === 'pending');
            const ids = new Set<number>();
            minePending.forEach(r => {
                if ((r as any).task_instance?.id) ids.add((r as any).task_instance.id);
            });
            setPendingSwapTaskIds(ids);
        } catch (e) {
            // non-fatal
            setPendingSwapTaskIds(new Set());
        }
    };

    const loadUsers = async () => {
        try {
            // Use the existing groupMeetingApi function for consistent API calls
            const users = await groupMeetingApi.getActiveUsers(token);
            setUsers(users || []);
        } catch (error) {
            console.error('Error loading users:', error);
            setError('Failed to load users');
        }
    };

    const handleCompleteTask = async (taskId: number) => {
        try {
            await periodicTaskApi.completeTask(token, taskId, { completion_notes: 'Task completed via dashboard' });
            loadTaskInstances();
        } catch (error) {
            console.error('Error completing task:', error);
            setError('Failed to complete task');
        }
    };

    const handleClaimTask = async (taskId: number) => {
        try {
            // Use the existing groupMeetingApi function
            const result = await groupMeetingApi.claimOneTimeTask(token, taskId);
            loadTaskInstances(); // Refresh the data
        } catch (error) {
            console.error('Error claiming task:', error);
            setError(`Failed to claim task: ${error}`);
        }
    };

    // Swap modal state
    const [swapModalOpen, setSwapModalOpen] = useState(false);
    const [swapSubmitting, setSwapSubmitting] = useState(false);
    const [swapTaskId, setSwapTaskId] = useState<number | null>(null);
    const [swapTaskTitle, setSwapTaskTitle] = useState<string | undefined>(undefined);

    const openSwapModal = (task: TaskInstance) => {
        setSwapTaskId(task.id);
        setSwapTaskTitle(task.template_name);
        setSwapModalOpen(true);
    };

    const handleSwapTask = (task: TaskInstance) => {
        if (!token || !user) return;
        openSwapModal(task);
    };

    const submitSwap = async ({ taskId, toUserId, reason }: TaskSwapFormData) => {
        if (!token || !user) return;
        setSwapSubmitting(true);
        try {
            const response = await fetch(buildApiUrl('/api/schedule/task-swap-requests/'), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task_instance_id: taskId,
                    request_type: 'swap',
                    to_user_id: toUserId,
                    reason
                })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || err.error || 'Failed to submit swap request');
            }
            setSwapModalOpen(false);
            await Promise.all([loadTaskInstances(), loadPendingSwapRequests()]);
        } finally {
            setSwapSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'in_progress':
                return 'bg-blue-100 text-blue-800';
            case 'overdue':
                return 'bg-red-100 text-red-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800';
            case 'low':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const myTasks = taskInstances.filter(task => 
        user && task.current_assignees.includes(user.id)
    );

    const availableOneTimeTasks = taskInstances.filter(task => 
        task.template?.task_type === 'one_time' && 
        (task.status === 'pending' || task.status === 'scheduled') && 
        (task.current_assignees?.length || 0) === 0
    );

    const tabs = [
        { 
            id: 'instances', 
            label: 'Active Tasks', 
            icon: ClipboardList,
            count: taskInstances.filter(t => ['pending', 'in_progress'].includes(t.status)).length
        },
        { 
            id: 'my-tasks', 
            label: 'My Tasks', 
            icon: User,
            count: myTasks.length
        },
        ...(isAdmin ? [{ 
            id: 'templates', 
            label: 'Task Templates', 
            icon: Settings,
            count: taskTemplates.length
        }] : [])
    ] as const;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-2 text-gray-600">Loading tasks...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
                <button 
                    onClick={() => { setError(null); loadData(); }}
                    className="mt-2 text-red-600 hover:text-red-800 underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Laboratory Task Management</h2>
                    <p className="text-gray-600">Manage recurring and one-time laboratory tasks</p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setSelectedTaskType('recurring'); setShowCreateModal(true); }}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Repeat className="w-4 h-4 mr-2" />
                            New Recurring Task
                        </button>
                        <button
                            onClick={() => { setSelectedTaskType('one_time'); setShowCreateModal(true); }}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New One-Time Task
                        </button>
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Active Tasks</p>
                            <p className="text-xl font-semibold text-gray-900">
                                {taskInstances.filter(t => ['pending', 'in_progress'].includes(t.status)).length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Timer className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-xl font-semibold text-gray-900">
                                {taskInstances.filter(t => t.status === 'pending').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">My Tasks</p>
                            <p className="text-xl font-semibold text-gray-900">{myTasks.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Overdue</p>
                            <p className="text-xl font-semibold text-gray-900">
                                {taskInstances.filter(t => t.status === 'overdue').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Available One-Time Tasks for Claiming */}
            {availableOneTimeTasks.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="border-b border-gray-200 p-4">
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Available Tasks to Claim</h3>
                        </div>
                        <p className="text-sm text-gray-600">One-time tasks waiting for someone to take ownership</p>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableOneTimeTasks.map((task) => (
                                <div key={task.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900">{task.template_name}</h4>
                                            <p className="text-sm text-gray-600 mt-1">{task.template.description}</p>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.template.priority)}`}>
                                            {task.template.priority}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>Due: {new Date(task.execution_end_date).toLocaleDateString()}</span>
                                            </div>
                                            {task.template.estimated_hours && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{task.template.estimated_hours}h</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleClaimTask(task.id)}
                                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                        >
                                            <UserCheck className="w-3 h-3 mr-1" />
                                            Claim Task
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-1 px-6" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                        isActive
                                            ? 'border-primary-500 text-primary-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            isActive ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Active Tasks Tab */}
                    {activeTab === 'instances' && (
                        <TaskInstancesView 
                            instances={taskInstances}
                            users={users}
                            currentUser={user}
                            onCompleteTask={handleCompleteTask}
                            onClaimTask={handleClaimTask}
                        />
                    )}

                    {/* My Tasks Tab */}
                    {activeTab === 'my-tasks' && (
                        <MyTasksView 
                            tasks={myTasks}
                            onCompleteTask={handleCompleteTask}
                            onSwapTask={handleSwapTask}
                            disabledSwapTaskIds={pendingSwapTaskIds}
                        />
                    )}

                    {/* Task Templates Tab (Admin Only) */}
                    {activeTab === 'templates' && isAdmin && (
                        <TaskTemplatesView 
                            templates={taskTemplates}
                            onEditTemplate={setEditingTemplate}
                            onRefresh={loadTaskTemplates}
                        />
                    )}
                </div>
            </div>

            {/* Task Creation Modal */}
            <TaskCreationModal 
                isOpen={showCreateModal}
                onClose={() => { setShowCreateModal(false); setSelectedTaskType(null); }}
                taskType={selectedTaskType}
                users={users}
                onSuccess={() => {
                    setShowCreateModal(false);
                    setSelectedTaskType(null);
                    loadData();
                }}
            />

            {/* Task Swap Modal */}
            <TaskSwapRequestModal
                isOpen={swapModalOpen}
                onClose={() => setSwapModalOpen(false)}
                taskTitle={swapTaskTitle}
                taskId={swapTaskId}
                users={users as any}
                currentUserId={user?.id ?? null}
                submitting={swapSubmitting}
                onSubmit={submitSwap}
            />

        </div>
    );
};

// Task Instances View Component
const TaskInstancesView: React.FC<{
    instances: TaskInstance[];
    users: User[];
    currentUser: any;
    onCompleteTask: (taskId: number) => void;
    onClaimTask: (taskId: number) => void;
}> = ({ instances, users, currentUser, onCompleteTask, onClaimTask }) => {
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');

    const filteredInstances = instances.filter(task => {
        if (filterStatus !== 'all' && task.status !== filterStatus) return false;
        if (filterType !== 'all' && task.template.task_type !== filterType) return false;
        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getUserById = (userId: number) => {
        return users.find(user => user.id === userId);
    };

    const canCompleteTask = (task: TaskInstance) => {
        return currentUser && task.current_assignees.includes(currentUser.id) && task.status === 'in_progress';
    };

    const canClaimTask = (task: TaskInstance) => {
        return task.template.task_type === 'one_time' && (task.status === 'pending' || task.status === 'scheduled') && task.current_assignees.length === 0;
    };

    if (filteredInstances.length === 0) {
        return (
            <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                <p className="text-gray-600">
                    {instances.length === 0 
                        ? "No task instances have been created yet"
                        : "Try adjusting your filters to see more tasks"
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Status:</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Type:</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                        <option value="all">All Types</option>
                        <option value="recurring">Recurring</option>
                        <option value="one_time">One-Time</option>
                    </select>
                </div>
            </div>

            {/* Task Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredInstances.map((task) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-medium text-gray-900">{task.template_name}</h3>
                                    {task.template.task_type === 'recurring' && (
                                        <Repeat className="w-4 h-4 text-blue-500" />
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mb-3">{task.template.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {task.template.task_type === 'recurring' ? 'Recurring' : 'One-Time'}
                                </span>
                            </div>
                        </div>

                        {/* Task Details */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-1 text-gray-500">
                                    <Calendar className="w-4 h-4" />
                                    <span>Due: {new Date(task.execution_end_date).toLocaleDateString()}</span>
                                </div>
                                {task.template.estimated_hours && (
                                    <div className="flex items-center gap-1 text-gray-500">
                                        <Clock className="w-4 h-4" />
                                        <span>{task.template.estimated_hours}h estimated</span>
                                    </div>
                                )}
                            </div>

                            {/* Assignees */}
                            {task.current_assignees.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    <div className="flex flex-wrap gap-1">
                                        {task.current_assignees.map(userId => {
                                            const user = getUserById(userId);
                                            return user ? (
                                                <span key={userId} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                                    {user.first_name} {user.last_name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Completion Info */}
                            {task.status === 'completed' && task.completed_by && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Completed by {task.completed_by.first_name} {task.completed_by.last_name}</span>
                                    {task.completed_at && (
                                        <span className="text-gray-500">
                                            on {new Date(task.completed_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                                <div className="text-sm text-gray-500">
                                    ID: {task.id} • Period: {task.scheduled_period}
                                </div>
                                <div className="flex gap-2">
                                    {canClaimTask(task) && (
                                        <button
                                            onClick={() => onClaimTask(task.id)}
                                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                        >
                                            <UserCheck className="w-3 h-3 mr-1" />
                                            Claim
                                        </button>
                                    )}
                                    {canCompleteTask(task) && (
                                        <button
                                            onClick={() => onCompleteTask(task.id)}
                                            className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                        >
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Complete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// My Tasks View Component
const MyTasksView: React.FC<{
    tasks: TaskInstance[];
    onCompleteTask: (taskId: number) => void;
    onSwapTask: (task: TaskInstance) => void;
    disabledSwapTaskIds?: Set<number>;
}> = ({ tasks, onCompleteTask, onSwapTask, disabledSwapTaskIds }) => {
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (tasks.length === 0) {
        return (
            <div className="text-center py-12">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks assigned to you</h3>
                <p className="text-gray-600">Check the "Active Tasks" tab to claim available one-time tasks.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* In Progress Tasks */}
            {inProgressTasks.length > 0 && (
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-blue-600" />
                        In Progress ({inProgressTasks.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inProgressTasks.map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                onCompleteTask={onCompleteTask}
                                onSwapTask={onSwapTask}
                                showCompleteButton={true}
                                showSwapButton={true}
                                disabled={disabledSwapTaskIds?.has(task.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Timer className="w-5 h-5 text-yellow-600" />
                        Pending ({pendingTasks.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingTasks.map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                onSwapTask={onSwapTask}
                                showSwapButton={true}
                                disabled={disabledSwapTaskIds?.has(task.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Recently Completed ({completedTasks.slice(0, 6).length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {completedTasks.slice(0, 6).map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Task Card Component
const TaskCard: React.FC<{
    task: TaskInstance;
    onCompleteTask?: (taskId: number) => void;
    onSwapTask?: (task: TaskInstance) => void;
    showCompleteButton?: boolean;
    showSwapButton?: boolean;
    disabled?: boolean;
}> = ({ task, onCompleteTask, onSwapTask, showCompleteButton = false, showSwapButton = false, disabled = false }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{task.template_name}</h4>
                        {task.template.task_type === 'recurring' && (
                            <Repeat className="w-4 h-4 text-blue-500" />
                        )}
                    </div>
                    <p className="text-sm text-gray-600">{task.template.description}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                </span>
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {new Date(task.execution_end_date).toLocaleDateString()}</span>
                    </div>
                    {task.template.estimated_hours && (
                        <div className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span>{task.template.estimated_hours}h</span>
                        </div>
                    )}
                </div>

                {task.status === 'completed' && task.completed_at && (
                    <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed on {new Date(task.completed_at).toLocaleDateString()}</span>
                    </div>
                )}
            </div>

            {(showCompleteButton || showSwapButton) && (onCompleteTask || onSwapTask) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex gap-2">
                        {showCompleteButton && onCompleteTask && (
                            <button
                                onClick={() => onCompleteTask(task.id)}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Complete
                            </button>
                        )}
                        {showSwapButton && onSwapTask && task.status !== 'completed' && (
                            <button
                                onClick={() => onSwapTask(task)}
                                disabled={disabled}
                                className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${disabled ? 'bg-gray-300 text-white cursor-not-allowed' : 'bg-yellow-600 text-white hover:bg-yellow-700'}`}
                            >
                                <ArrowLeftRight className="w-4 h-4 mr-1" />
                                {disabled ? 'Requested' : 'Request Swap'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Task Templates View Component (Admin Only)
const TaskTemplatesView: React.FC<{
    templates: TaskTemplate[];
    onEditTemplate: (template: TaskTemplate) => void;
    onRefresh: () => void;
}> = ({ templates, onEditTemplate, onRefresh }) => {
    if (templates.length === 0) {
        return (
            <div className="text-center py-12">
                <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No task templates</h3>
                <p className="text-gray-600">Create your first task template to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-medium text-gray-900">{template.name}</h3>
                                    {template.task_type === 'recurring' && (
                                        <Repeat className="w-4 h-4 text-blue-500" />
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">{template.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    template.priority === 'high' ? 'bg-red-100 text-red-800' :
                                    template.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {template.priority}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {template.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center justify-between">
                                <span>Type: {template.task_type === 'recurring' ? 'Recurring' : 'One-Time'}</span>
                                <span>People: {template.min_people}-{template.max_people}</span>
                            </div>
                            {template.frequency && (
                                <div>Frequency: {template.frequency} (every {template.interval})</div>
                            )}
                            {template.estimated_hours && (
                                <div>Estimated time: {template.estimated_hours} hours</div>
                            )}
                            <div className="flex items-center justify-between">
                                <span>Created: {new Date(template.created_at).toLocaleDateString()}</span>
                                <span>
                                    by {template.created_by
                                        ? ((template.created_by.first_name || template.created_by.last_name)
                                            ? `${template.created_by.first_name || ''} ${template.created_by.last_name || ''}`.trim()
                                            : (template.created_by.username || 'Unknown'))
                                        : 'Unknown'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => onEditTemplate(template)}
                                className="inline-flex items-center px-3 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded transition-colors"
                            >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default ImprovedTaskManager;