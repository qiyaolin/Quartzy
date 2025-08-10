import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
    Calendar, Clock, Users, MapPin, Plus, Edit3, Settings, 
    Repeat, CheckCircle, AlertCircle, User, Trash2, MoreHorizontal,
    Beaker, TestTube, Brush, ArrowLeftRight
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { 
    groupMeetingApi, 
    RecurringTask, 
    User as TaskUser 
} from "../services/groupMeetingApi.ts";
import { buildApiUrl } from '../config/api.ts';
import EditTaskModal, { EditTaskData } from '../modals/EditTaskModal.tsx';
import AssignUsersModal from '../modals/AssignUsersModal.tsx';
import { OneTimeTask } from '../services/groupMeetingApi.ts';
import AutoGenerateModal, { AutoGenerateConfig } from '../modals/AutoGenerateModal.tsx';

interface RecurringTaskManagerProps {
    onCreateTask?: () => void;
    isAdmin?: boolean;
}

const RecurringTaskManager: React.FC<RecurringTaskManagerProps> = ({
    onCreateTask,
    isAdmin = false
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    const [tasks, setTasks] = useState<RecurringTask[]>([]);
    const [users, setUsers] = useState<TaskUser[]>([]);
    const [oneTimeTasks, setOneTimeTasks] = useState<OneTimeTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<RecurringTask | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningTask, setAssigningTask] = useState<RecurringTask | null>(null);

    // Load data
    const loadData = useCallback(async () => {
        if (!token) return;
        
        setLoading(true);
        try {
            const [tasksData, usersData, oneTime] = await Promise.all([
                groupMeetingApi.getRecurringTasks(token),
                groupMeetingApi.getActiveUsers(token),
                groupMeetingApi.getOneTimeTasks(token)
            ]);

            setTasks(tasksData || []);
            setUsers((usersData || []).filter(u => u.username !== 'admin' && u.username !== 'print_server'));
            setOneTimeTasks(oneTime || []);
            setError(null);
        } catch (err) {
            console.error('Error loading recurring tasks:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(`Failed to load recurring tasks: ${errorMessage}. Please check your connection and try again.`);
            setTasks([]);
            setUsers([]);
            setOneTimeTasks([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const handleClaimOneTime = async (taskId: number) => {
        if (!token) return;
        try {
            const updated = await groupMeetingApi.claimOneTimeTask(token, taskId);
            setOneTimeTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to claim task';
            alert(`Claim failed: ${msg}`);
        }
    };

    const handleCompleteOneTime = async (taskId: number) => {
        if (!token) return;
        try {
            await fetch(buildApiUrl(`/api/tasks/one-time/${taskId}/complete/`), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ completion_notes: 'Task completed via dashboard' })
            });
            
            setOneTimeTasks(prev => prev.map(t => 
                t.id === taskId ? { ...t, status: 'completed' as const } : t
            ));
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to complete task';
            alert(`Complete failed: ${msg}`);
        }
    };

    const handleSwapOneTime = async (task: OneTimeTask) => {
        if (!token || !authContext?.user) return;
        
        const reason = prompt('Please provide a reason for the swap request:');
        if (!reason || reason.trim() === '') {
            alert('Swap request cancelled - reason is required.');
            return;
        }
        
        try {
            const response = await fetch(buildApiUrl('/api/tasks/swap-request/'), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task_id: task.id,
                    reason: reason.trim(),
                    priority: 'normal'
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to submit swap request');
            }
            
            alert('Swap request submitted successfully! An admin will review your request.');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to submit swap request';
            alert(`Swap request failed: ${msg}`);
        }
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openAssignTask = (task: RecurringTask) => {
        setAssigningTask(task);
        setShowAssignModal(true);
    };

    const handleAssignUsers = async (userIds: number[]) => {
        if (!token || !assigningTask) return;
        try {
            await groupMeetingApi.assignRecurringTask(token, assigningTask.id, userIds);
            setTasks(prev => prev.map(t => 
                t.id === assigningTask.id 
                    ? { ...t, last_assigned_user_ids: userIds, last_assigned_date: new Date().toISOString() }
                    : t
            ));
        } catch (err) {
            console.error('Failed to assign users:', err);
            const msg = err instanceof Error ? err.message : 'Failed to assign users';
            throw new Error(msg);
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

    const handleAutoGenerateTasks = async () => {
        setShowAutoGenerateModal(true);
    };

    const handleAutoGenerate = async (config: AutoGenerateConfig) => {
        if (!token) return;

        setIsAutoGenerating(true);
        try {
            setError(null);
            
            // Call the enhanced API with the configuration
            const response = await fetch(buildApiUrl('/api/tasks/generate-with-rotation/'), {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_date: config.startDate,
                    end_date: config.endDate,
                    task_ids: config.selectedTaskIds,
                    user_ids: config.selectedUserIds,
                    rotation_settings: config.rotationSettings
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to generate tasks: ${response.statusText}`);
            }

            const result = await response.json();
            const totalGenerated = result.total_tasks_generated || 0;
            const assignmentsCreated = result.assignments_created || 0;

            alert(`Successfully generated ${totalGenerated} task instances with ${assignmentsCreated} assignments!`);
            
            // Refresh task data
            await loadData();
        } catch (error) {
            console.error('Error auto-generating tasks:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setError(`Failed to auto-generate tasks: ${errorMessage}`);
            throw error; // Re-throw to be handled by the modal
        } finally {
            setIsAutoGenerating(false);
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
                        <p className="text-gray-600">Manage recurring tasks in three steps: 1) Configure task, 2) Select participants, 3) Auto-generate monthly assignments.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <button
                                onClick={handleAutoGenerateTasks}
                                disabled={tasks.length === 0}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Auto-Generate
                            </button>
                        )}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-800 mb-2">
                        <Repeat className="w-5 h-5" />
                        <span className="font-medium">Workflow Guide</span>
                    </div>
                    <ol className="list-decimal pl-5 text-sm text-blue-800 space-y-1">
                        <li>Use “Edit Task” to set frequency, window（例如“每月最后一周”）与预计时长。</li>
                        <li>点击 “Select Participants” 打开人员选择器，保存后作为该任务的指定名单。</li>
                        <li>管理员点击 “Auto-Generate” 生成当月/未来周期的任务实例；工作日 11:00 ET 自动提醒，周末不提醒。</li>
                    </ol>
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
                    <div className="flex items-start justify-between">
                        <div className="flex">
                            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
                            <div>
                                <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="ml-3 bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Retrying...' : 'Retry'}
                        </button>
                    </div>
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
                                onAssign={() => openAssignTask(task)}
                                getTaskIcon={getTaskIcon}
                                getTaskTypeColor={getTaskTypeColor}
                                getFrequencyColor={getFrequencyColor}
                                isTaskDue={isTaskDue}
                                isAdmin={isAdmin}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 批量操作条 */}
            {tasks.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-sm text-gray-600">
                        批量操作：可同时对多个任务进行参与人员选择与任务实例生成
                    </div>
                    {isAdmin && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleAutoGenerateTasks}
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Bulk Generate
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* One-time Tasks Quick Panel */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-gray-900">One-time Tasks</h3>
                    <span className="text-sm text-gray-500">便捷接取，一人先到先得</span>
                </div>
                {oneTimeTasks.length === 0 ? (
                    <div className="text-sm text-gray-500">No one-time tasks available</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {oneTimeTasks.map(ot => (
                            <div key={ot.id} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-900 truncate">{ot.template_name}</div>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{ot.status}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Deadline: {new Date(ot.execution_end_date).toLocaleDateString()}</div>
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="text-xs text-gray-500">Assignee: {ot.current_assignees?.length > 0 ? 'Taken' : 'Unclaimed'}</div>
                                    <div className="flex gap-2">
                                        {ot.current_assignees?.length === 0 && ot.status === 'scheduled' ? (
                                            <button
                                                onClick={() => handleClaimOneTime(ot.id)}
                                                className="text-sm px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                                            >
                                                Claim
                                            </button>
                                        ) : (
                                            <>
                                                {authContext?.user && ot.current_assignees?.includes(authContext.user.id) && (ot.status === 'in_progress' || ot.status === 'scheduled') && (
                                                    <button
                                                        onClick={() => handleCompleteOneTime(ot.id)}
                                                        className="text-sm px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                                        title="Complete Task"
                                                    >
                                                        <CheckCircle className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {authContext?.user && ot.current_assignees?.includes(authContext.user.id) && ot.status !== 'completed' && (
                                                    <button
                                                        onClick={() => handleSwapOneTime(ot)}
                                                        className="text-sm px-2 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700"
                                                        title="Request Swap"
                                                    >
                                                        <ArrowLeftRight className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {ot.current_assignees?.length > 0 && (
                                                    <span className="text-sm px-3 py-1 rounded bg-gray-200 text-gray-700">
                                                        {ot.status === 'completed' ? 'Completed' : 'Claimed'}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
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

            {/* Auto Generate Modal */}
            <AutoGenerateModal
                isOpen={showAutoGenerateModal}
                onClose={() => setShowAutoGenerateModal(false)}
                tasks={tasks}
                users={users}
                onGenerate={handleAutoGenerate}
                isSubmitting={isAutoGenerating}
            />

            {/* Assign Users Modal */}
            <AssignUsersModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                users={users}
                initialSelectedIds={assigningTask?.last_assigned_user_ids || []}
                onSubmit={handleAssignUsers}
                isSubmitting={false}
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
    isAdmin?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    assignedUsers,
    onAssign,
    getTaskIcon,
    getTaskTypeColor,
    getFrequencyColor,
    isTaskDue,
    isAdmin = false
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
                            <span>{task.location?.trim() || '—'}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{typeof task.estimated_duration_hours === 'number' ? `${task.estimated_duration_hours}h estimated` : '—'}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                                {(() => {
                                    const count = typeof task.assignee_count === 'number' ? task.assignee_count : (task.assignee_group?.length || 0);
                                    return count > 0 ? `${count} assignee${count > 1 ? 's' : ''}` : 'assignee';
                                })()}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                                {(() => {
                                    const d = task.next_due_date ? new Date(task.next_due_date) : null;
                                    const valid = d && !Number.isNaN(d.getTime());
                                    return `Due: ${valid ? d!.toLocaleDateString() : 'TBD'}`;
                                })()}
                            </span>
                        </div>
                    </div>

                    {/* Current Assignment */}
                    {/* Participants Preview */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Participants</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700">
                                {(() => {
                                    const count = typeof task.assignee_count === 'number' ? task.assignee_count : (task.assignee_group?.length || 0);
                                    return `${count || 0} selected`;
                                })()}
                            </span>
                            {/* 名单预览（使用 last_assigned_user_ids 作为近似，若需要可改为 assignee_group 名单） */}
                            {assignedUsers.length > 0 && (
                                <span className="text-sm text-blue-700 truncate">
                                    {assignedUsers.slice(0, 5).map(u => (u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username)).join(', ')}
                                    {assignedUsers.length > 5 ? `, +${assignedUsers.length - 5} more` : ''}
                                </span>
                            )}
                            {task.last_assigned_date && (
                                <span className="text-xs text-blue-600">
                                    (Last assigned: {new Date(task.last_assigned_date).toLocaleDateString()})
                                </span>
                            )}
                        </div>
                        <div className="mt-2">
                            <button onClick={() => onAssign()} className="text-sm text-blue-600 hover:text-blue-800">Edit Participants</button>
                        </div>
                    </div>

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
                                    Select Participants
                                </button>
                                
                                {isAdmin && (
                                    <>
                                        <button
                                            onClick={() => {
                                                console.log('Edit task:', task.id);
                                                setShowActions(false);
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <Edit3 className="w-4 h-4 inline mr-2" />
                                            Edit Task
                                        </button>
                                        
                                        <button
                                            onClick={() => {
                                                console.log('Configure task:', task.id);
                                                setShowActions(false);
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <Settings className="w-4 h-4 inline mr-2" />
                                            Configure
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecurringTaskManager;
