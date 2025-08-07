import React, { useState, useContext, useMemo, useCallback } from 'react';
import {
    Zap, Monitor, Clock, CheckCircle, AlertTriangle, 
    Plus, ArrowRight, Timer, CalendarCheck, Users,
    Calendar, ClipboardList, Search, Grid3X3, List,
    Star, Bookmark, TrendingUp, Activity, Award,
    MapPin, Bell, Settings, ChevronDown, ChevronRight
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

interface QuickAction {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    color: string;
    bgColor: string;
    onClick: () => void;
    badge?: string | number;
    priority?: 'high' | 'medium' | 'low';
    category?: 'equipment' | 'schedule' | 'tasks' | 'meetings';
}

interface EnhancedQuickActionsProps {
    availableEquipment?: Equipment[];
    onEquipmentBooked?: (booking: any) => void;
    onTaskCompleted?: (taskId: number) => void;
    onNavigateToTab?: (tab: string) => void;
    onRefreshNeeded?: () => void;
    compactMode?: boolean;
}

const EnhancedQuickActions: React.FC<EnhancedQuickActionsProps> = ({
    availableEquipment = [],
    onEquipmentBooked,
    onTaskCompleted,
    onNavigateToTab,
    onRefreshNeeded,
    compactMode = false
}) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('EnhancedQuickActions must be used within an AuthProvider');
    }
    const { token } = authContext;

    const [activeCategory, setActiveCategory] = useState<'all' | 'equipment' | 'schedule' | 'tasks' | 'meetings'>('all');
    const [showFavorites, setShowFavorites] = useState(false);
    const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleQuickBook = useCallback(async (equipment: Equipment) => {
        setIsSubmitting(true);
        try {
            // Quick book for 1 hour starting now
            const bookingData = {
                equipment_id: equipment.id,
                duration_minutes: 60,
                auto_checkin: equipment.requires_qr_checkin
            };

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

            setActionStatus({ type: 'success', message: `${equipment.name} booked successfully!` });
            onEquipmentBooked?.(data.booking);
            onRefreshNeeded?.();
            
            setTimeout(() => setActionStatus(null), 3000);
        } catch (error) {
            setActionStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Booking failed'
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [token, onEquipmentBooked, onRefreshNeeded]);

    const handleQuickTask = useCallback(() => {
        // TODO: Implement quick task creation modal
        console.log('Quick task creation not implemented yet');
    }, []);

    // Generate quick actions based on available data
    const quickActions: QuickAction[] = useMemo(() => {
        const actions: QuickAction[] = [];

        // Equipment actions
        availableEquipment
            .filter(eq => eq.is_bookable && !eq.is_in_use)
            .slice(0, 4)
            .forEach(equipment => {
                actions.push({
                    id: `book-${equipment.id}`,
                    title: `Book ${equipment.name}`,
                    description: `Available at ${equipment.location}`,
                    icon: Monitor,
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-100',
                    onClick: () => handleQuickBook(equipment),
                    priority: 'high',
                    category: 'equipment'
                });
            });

        // Schedule actions
        actions.push(
            {
                id: 'new-meeting',
                title: 'Schedule Meeting',
                description: 'Create a new meeting',
                icon: Users,
                color: 'text-purple-600',
                bgColor: 'bg-purple-100',
                onClick: () => onNavigateToTab?.('meetings'),
                priority: 'high',
                category: 'meetings'
            },
            {
                id: 'add-event',
                title: 'Add Calendar Event',
                description: 'Schedule personal event',
                icon: Calendar,
                color: 'text-green-600',
                bgColor: 'bg-green-100',
                onClick: () => onNavigateToTab?.('calendar'),
                priority: 'medium',
                category: 'schedule'
            },
            {
                id: 'view-schedule',
                title: 'My Schedule',
                description: 'View personal schedule',
                icon: Calendar,
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-100',
                onClick: () => onNavigateToTab?.('my-schedule'),
                priority: 'medium',
                category: 'schedule'
            }
        );

        // Task actions
        actions.push(
            {
                id: 'manage-tasks',
                title: 'Manage Tasks',
                description: 'View and complete tasks',
                icon: ClipboardList,
                color: 'text-orange-600',
                bgColor: 'bg-orange-100',
                onClick: () => onNavigateToTab?.('tasks'),
                priority: 'medium',
                category: 'tasks'
            },
            {
                id: 'quick-task',
                title: 'Quick Task Entry',
                description: 'Add a quick task',
                icon: Plus,
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-100',
                onClick: handleQuickTask,
                priority: 'low',
                category: 'tasks'
            }
        );

        return actions;
    }, [availableEquipment, onNavigateToTab, handleQuickBook, handleQuickTask]);

    const filteredActions = activeCategory === 'all' 
        ? quickActions 
        : quickActions.filter(action => action.category === activeCategory);

    const prioritizedActions = filteredActions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority || 'low'] - priorityOrder[a.priority || 'low']);
    });

    const categories = [
        { id: 'all', label: 'All', icon: Grid3X3 },
        { id: 'equipment', label: 'Equipment', icon: Monitor },
        { id: 'meetings', label: 'Meetings', icon: Users },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'tasks', label: 'Tasks', icon: ClipboardList }
    ];

    return (
        <div className={`space-y-${compactMode ? '4' : '6'}`}>
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

            {/* Enhanced Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-xl">
                                <Zap className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Quick Actions</h3>
                                <p className="text-primary-100 text-sm">
                                    {filteredActions.length} action{filteredActions.length !== 1 ? 's' : ''} available
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFavorites(!showFavorites)}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                    showFavorites 
                                        ? 'bg-white bg-opacity-30' 
                                        : 'hover:bg-white hover:bg-opacity-20'
                                }`}
                            >
                                <Star className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Category Filter */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                                    activeCategory === category.id
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                            >
                                <category.icon className="w-4 h-4" />
                                {category.label}
                                {category.id !== 'all' && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        activeCategory === category.id
                                            ? 'bg-white bg-opacity-20'
                                            : 'bg-gray-200'
                                    }`}>
                                        {quickActions.filter(a => a.category === category.id).length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions Grid */}
                <div className="p-6">
                    {prioritizedActions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="p-4 bg-gray-100 rounded-2xl inline-flex mb-4">
                                <ClipboardList className="w-8 h-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Actions Available</h4>
                            <p className="text-gray-600 max-w-sm mx-auto">
                                No quick actions available for the selected category. 
                                Try selecting a different category or check back later.
                            </p>
                        </div>
                    ) : (
                        <div className={`grid gap-4 ${
                            compactMode 
                                ? 'grid-cols-1 sm:grid-cols-2' 
                                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        }`}>
                            {prioritizedActions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={action.onClick}
                                    disabled={isSubmitting}
                                    className="group bg-gray-50 hover:bg-white border border-gray-200 hover:border-primary-300 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                                >
                                    {/* Priority indicator */}
                                    <div className={`absolute top-0 left-0 w-full h-1 ${
                                        action.priority === 'high' ? 'bg-red-500' :
                                        action.priority === 'medium' ? 'bg-yellow-500' :
                                        'bg-green-500'
                                    }`} />
                                    
                                    <div className="flex items-start gap-3">
                                        <div className={`p-3 rounded-xl transition-all duration-200 group-hover:scale-110 ${action.bgColor}`}>
                                            <action.icon className={`w-6 h-6 ${action.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-semibold text-gray-900 truncate">
                                                    {action.title}
                                                </h4>
                                                {action.badge && (
                                                    <span className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full font-medium ml-2">
                                                        {action.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                    action.priority === 'high' 
                                                        ? 'bg-red-100 text-red-700' 
                                                        : action.priority === 'medium'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-green-100 text-green-700'
                                                }`}>
                                                    {action.priority} priority
                                                </span>
                                                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all duration-200" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnhancedQuickActions;