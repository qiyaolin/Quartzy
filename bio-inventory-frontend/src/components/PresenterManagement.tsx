import React, { useState, useEffect, useContext } from 'react';
import {
    Users, Plus, Edit3, Trash2, RotateCcw, UserCheck, UserX,
    Mail, Calendar, Clock, ArrowUpDown, Settings, Save,
    AlertCircle, CheckCircle, Eye, EyeOff, Search
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

// Types
interface Presenter {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
    last_presentation_date?: string;
    total_presentations: number;
    next_scheduled?: string;
    position_in_rotation?: number;
}

interface RotationList {
    id: number;
    name: string;
    meeting_type: 'research_update' | 'journal_club';
    presenters: Presenter[];
    current_presenter_index: number;
    next_presenter?: Presenter;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface PresenterStats {
    total_presentations: number;
    last_presentation: string;
    upcoming_presentations: number;
    swap_requests_sent: number;
    swap_requests_received: number;
}

interface PresenterManagementProps {
    onPresenterUpdate?: (presenter: Presenter) => void;
    onRotationUpdate?: (rotation: RotationList) => void;
}

const PresenterManagement: React.FC<PresenterManagementProps> = ({
    onPresenterUpdate,
    onRotationUpdate
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    // State
    const [presenters, setPresenters] = useState<Presenter[]>([]);
    const [rotationLists, setRotationLists] = useState<RotationList[]>([]);
    const [presenterStats, setPresenterStats] = useState<Record<number, PresenterStats>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // View state
    const [activeTab, setActiveTab] = useState<'presenters' | 'rotations'>('presenters');
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [selectedRotation, setSelectedRotation] = useState<number | null>(null);
    
    // Modal state
    const [showPresenterModal, setShowPresenterModal] = useState(false);
    const [showRotationModal, setShowRotationModal] = useState(false);
    const [editingPresenter, setEditingPresenter] = useState<Presenter | null>(null);
    const [editingRotation, setEditingRotation] = useState<RotationList | null>(null);

    // Initialize mock data
    useEffect(() => {
        if (!token) return;

        const initializeMockData = async () => {
            setLoading(true);
            try {
                // Mock presenters with enhanced data
                const mockPresenters: Presenter[] = [
                    {
                        id: 1,
                        username: 'alice.johnson',
                        first_name: 'Alice',
                        last_name: 'Johnson',
                        email: 'alice.johnson@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-01-15',
                        total_presentations: 12,
                        next_scheduled: '2024-03-01',
                        position_in_rotation: 1
                    },
                    {
                        id: 2,
                        username: 'bob.smith',
                        first_name: 'Bob',
                        last_name: 'Smith',
                        email: 'bob.smith@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-01-22',
                        total_presentations: 8,
                        next_scheduled: '2024-03-08',
                        position_in_rotation: 2
                    },
                    {
                        id: 3,
                        username: 'carol.davis',
                        first_name: 'Carol',
                        last_name: 'Davis',
                        email: 'carol.davis@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-01-29',
                        total_presentations: 15,
                        next_scheduled: '2024-03-15',
                        position_in_rotation: 3
                    },
                    {
                        id: 4,
                        username: 'david.wilson',
                        first_name: 'David',
                        last_name: 'Wilson',
                        email: 'david.wilson@lab.com',
                        is_active: true,
                        last_presentation_date: '2024-02-05',
                        total_presentations: 6,
                        next_scheduled: '2024-03-22',
                        position_in_rotation: 4
                    },
                    {
                        id: 5,
                        username: 'emma.taylor',
                        first_name: 'Emma',
                        last_name: 'Taylor',
                        email: 'emma.taylor@lab.com',
                        is_active: false,
                        last_presentation_date: '2023-11-20',
                        total_presentations: 5,
                        position_in_rotation: undefined
                    }
                ];

                // Mock rotation lists
                const mockRotationLists: RotationList[] = [
                    {
                        id: 1,
                        name: 'Research Update Rotation',
                        meeting_type: 'research_update',
                        presenters: mockPresenters.filter(p => p.is_active),
                        current_presenter_index: 0,
                        next_presenter: mockPresenters[0],
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        id: 2,
                        name: 'Journal Club Rotation',
                        meeting_type: 'journal_club',
                        presenters: mockPresenters.filter(p => p.is_active),
                        current_presenter_index: 1,
                        next_presenter: mockPresenters[1],
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ];

                // Mock presenter stats
                const mockStats: Record<number, PresenterStats> = {};
                mockPresenters.forEach(presenter => {
                    mockStats[presenter.id] = {
                        total_presentations: presenter.total_presentations,
                        last_presentation: presenter.last_presentation_date || 'Never',
                        upcoming_presentations: presenter.is_active ? 1 : 0,
                        swap_requests_sent: Math.floor(Math.random() * 3),
                        swap_requests_received: Math.floor(Math.random() * 2)
                    };
                });

                setPresenters(mockPresenters);
                setRotationLists(mockRotationLists);
                setPresenterStats(mockStats);
                setError(null);
            } catch (err) {
                setError('Failed to load presenter data');
                console.error('Error loading presenters:', err);
            } finally {
                setLoading(false);
            }
        };

        initializeMockData();
    }, [token]);

    // Filter presenters
    const filteredPresenters = presenters.filter(presenter => {
        const matchesSearch = !searchTerm || 
            presenter.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            presenter.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            presenter.email.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesActive = showInactive || presenter.is_active;
        
        return matchesSearch && matchesActive;
    });

    // Action handlers
    const handleEditPresenter = (presenter: Presenter) => {
        setEditingPresenter(presenter);
        setShowPresenterModal(true);
    };

    const handleAddPresenter = () => {
        setEditingPresenter(null);
        setShowPresenterModal(true);
    };

    const handleTogglePresenterStatus = async (presenter: Presenter) => {
        const updatedPresenter = { ...presenter, is_active: !presenter.is_active };
        setPresenters(prev => 
            prev.map(p => p.id === presenter.id ? updatedPresenter : p)
        );
        onPresenterUpdate?.(updatedPresenter);
    };

    const handleAdvanceRotation = async (rotation: RotationList) => {
        const nextIndex = (rotation.current_presenter_index + 1) % rotation.presenters.length;
        const updatedRotation = {
            ...rotation,
            current_presenter_index: nextIndex,
            next_presenter: rotation.presenters[nextIndex]
        };
        setRotationLists(prev =>
            prev.map(r => r.id === rotation.id ? updatedRotation : r)
        );
        onRotationUpdate?.(updatedRotation);
    };

    const handleReorderPresenters = (rotation: RotationList, fromIndex: number, toIndex: number) => {
        const newPresenters = [...rotation.presenters];
        const [movedPresenter] = newPresenters.splice(fromIndex, 1);
        newPresenters.splice(toIndex, 0, movedPresenter);
        
        const updatedRotation = {
            ...rotation,
            presenters: newPresenters
        };
        setRotationLists(prev =>
            prev.map(r => r.id === rotation.id ? updatedRotation : r)
        );
        onRotationUpdate?.(updatedRotation);
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
                        <h2 className="text-2xl font-bold text-gray-900">Presenter Management</h2>
                        <p className="text-gray-600">Manage presenters and rotation schedules</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleAddPresenter}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Presenter
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('presenters')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'presenters'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Users className="w-4 h-4 inline mr-2" />
                        Presenters ({filteredPresenters.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('rotations')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'rotations'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <RotateCcw className="w-4 h-4 inline mr-2" />
                        Rotations ({rotationLists.length})
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'presenters' ? 'Search presenters...' : 'Search rotations...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                    
                    {activeTab === 'presenters' && (
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                showInactive 
                                    ? 'bg-gray-100 text-gray-700' 
                                    : 'bg-blue-100 text-blue-700'
                            }`}
                        >
                            {showInactive ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                            {showInactive ? 'Hide Inactive' : 'Show All'}
                        </button>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Content based on active tab */}
            {activeTab === 'presenters' && (
                <PresentersTab
                    presenters={filteredPresenters}
                    presenterStats={presenterStats}
                    onEdit={handleEditPresenter}
                    onToggleStatus={handleTogglePresenterStatus}
                />
            )}

            {activeTab === 'rotations' && (
                <RotationsTab
                    rotationLists={rotationLists}
                    onAdvanceRotation={handleAdvanceRotation}
                    onReorderPresenters={handleReorderPresenters}
                />
            )}

            {/* Modals would go here */}
        </div>
    );
};

// Presenters Tab Component
interface PresentersTabProps {
    presenters: Presenter[];
    presenterStats: Record<number, PresenterStats>;
    onEdit: (presenter: Presenter) => void;
    onToggleStatus: (presenter: Presenter) => void;
}

const PresentersTab: React.FC<PresentersTabProps> = ({
    presenters,
    presenterStats,
    onEdit,
    onToggleStatus
}) => {
    if (presenters.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No presenters found</h3>
                <p className="text-gray-600">Add presenters or adjust your search criteria</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Presenter
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Presentations
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Presentation
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Next Scheduled
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {presenters.map((presenter) => {
                            const stats = presenterStats[presenter.id];
                            return (
                                <tr key={presenter.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {presenter.first_name[0]}{presenter.last_name[0]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {presenter.first_name} {presenter.last_name}
                                                </div>
                                                <div className="text-sm text-gray-500">{presenter.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            presenter.is_active 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {presenter.is_active ? (
                                                <>
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Active
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    Inactive
                                                </>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {presenter.total_presentations}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {presenter.last_presentation_date 
                                            ? new Date(presenter.last_presentation_date).toLocaleDateString()
                                            : 'Never'
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {presenter.next_scheduled 
                                            ? new Date(presenter.next_scheduled).toLocaleDateString()
                                            : 'Not scheduled'
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onEdit(presenter)}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onToggleStatus(presenter)}
                                                className={`${
                                                    presenter.is_active 
                                                        ? 'text-red-600 hover:text-red-900' 
                                                        : 'text-green-600 hover:text-green-900'
                                                }`}
                                            >
                                                {presenter.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                            </button>
                                            <button className="text-gray-600 hover:text-gray-900">
                                                <Mail className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Rotations Tab Component
interface RotationsTabProps {
    rotationLists: RotationList[];
    onAdvanceRotation: (rotation: RotationList) => void;
    onReorderPresenters: (rotation: RotationList, fromIndex: number, toIndex: number) => void;
}

const RotationsTab: React.FC<RotationsTabProps> = ({
    rotationLists,
    onAdvanceRotation,
    onReorderPresenters
}) => {
    if (rotationLists.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No rotation lists found</h3>
                <p className="text-gray-600">Create rotation lists to manage presenter schedules</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {rotationLists.map((rotation) => (
                <div key={rotation.id} className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">{rotation.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">
                                {rotation.meeting_type.replace('_', ' ')} • {rotation.presenters.length} presenters
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {rotation.next_presenter && (
                                <div className="text-sm text-gray-600">
                                    Next: <span className="font-medium">
                                        {rotation.next_presenter.first_name} {rotation.next_presenter.last_name}
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={() => onAdvanceRotation(rotation)}
                                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Advance
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Presenter Order</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {rotation.presenters.map((presenter, index) => (
                                <div
                                    key={presenter.id}
                                    className={`p-3 rounded-lg border-2 ${
                                        index === rotation.current_presenter_index
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <span className="text-sm font-medium text-gray-500 mr-3">
                                                #{index + 1}
                                            </span>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {presenter.first_name} {presenter.last_name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {presenter.total_presentations} presentations
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {index === rotation.current_presenter_index && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Current
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PresenterManagement;