import React, { useState, useEffect, useContext } from 'react';
import {
    ArrowUpDown, Clock, CheckCircle, XCircle, AlertCircle,
    User, Calendar, MessageSquare, Eye, Filter, Search,
    Check, X, MoreHorizontal, FileText
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';

// Types
interface SwapRequest {
    id: number;
    from_meeting_id: number;
    to_meeting_id: number;
    from_presenter: Presenter;
    to_presenter: Presenter;
    from_meeting: GroupMeeting;
    to_meeting: GroupMeeting;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
    requested_at: string;
    reviewed_at?: string;
    reviewed_by?: number;
    admin_notes?: string;
}

interface Presenter {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
}

interface GroupMeeting {
    id: number;
    title: string;
    date: string;
    start_time?: string;
    meeting_type: 'research_update' | 'journal_club' | 'general';
    topic: string;
}

interface SwapRequestManagerProps {
    onApprove?: (requestId: number, notes?: string) => Promise<void>;
    onReject?: (requestId: number, notes?: string) => Promise<void>;
    isAdmin?: boolean;
}

const SwapRequestManager: React.FC<SwapRequestManagerProps> = ({
    onApprove,
    onReject,
    isAdmin = false
}) => {
    const authContext = useContext(AuthContext);
    const { token } = authContext || {};

    // State
    const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
    const [reviewNotes, setReviewNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock data initialization
    useEffect(() => {
        if (!token) return;

        const initializeMockData = () => {
            setLoading(true);
            try {
                // Mock presenters
                const mockPresenters: Presenter[] = [
                    {
                        id: 1,
                        username: 'alice.johnson',
                        first_name: 'Alice',
                        last_name: 'Johnson',
                        email: 'alice.johnson@lab.com'
                    },
                    {
                        id: 2,
                        username: 'bob.smith',
                        first_name: 'Bob',
                        last_name: 'Smith',
                        email: 'bob.smith@lab.com'
                    },
                    {
                        id: 3,
                        username: 'carol.davis',
                        first_name: 'Carol',
                        last_name: 'Davis',
                        email: 'carol.davis@lab.com'
                    }
                ];

                // Mock meetings
                const mockMeetings: GroupMeeting[] = [
                    {
                        id: 1001,
                        title: 'Research Update: Week 1',
                        date: '2024-03-08',
                        start_time: '14:00',
                        meeting_type: 'research_update',
                        topic: 'Alice\'s Research Progress'
                    },
                    {
                        id: 1002,
                        title: 'Journal Club: Week 2',
                        date: '2024-03-15',
                        start_time: '15:00',
                        meeting_type: 'journal_club',
                        topic: 'Recent Advances in Cell Biology'
                    },
                    {
                        id: 1003,
                        title: 'Research Update: Week 3',
                        date: '2024-03-22',
                        start_time: '14:00',
                        meeting_type: 'research_update',
                        topic: 'Bob\'s Research Progress'
                    }
                ];

                // Mock swap requests
                const mockSwapRequests: SwapRequest[] = [
                    {
                        id: 1,
                        from_meeting_id: 1001,
                        to_meeting_id: 1003,
                        from_presenter: mockPresenters[0],
                        to_presenter: mockPresenters[1],
                        from_meeting: mockMeetings[0],
                        to_meeting: mockMeetings[2],
                        status: 'pending',
                        reason: 'I have a conference to attend during my originally scheduled presentation',
                        requested_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
                    },
                    {
                        id: 2,
                        from_meeting_id: 1002,
                        to_meeting_id: 1001,
                        from_presenter: mockPresenters[1],
                        to_presenter: mockPresenters[0],
                        from_meeting: mockMeetings[1],
                        to_meeting: mockMeetings[0],
                        status: 'approved',
                        reason: 'Need to switch due to lab equipment availability',
                        requested_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
                        reviewed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
                        reviewed_by: 999,
                        admin_notes: 'Approved due to equipment scheduling conflict'
                    },
                    {
                        id: 3,
                        from_meeting_id: 1003,
                        to_meeting_id: 1002,
                        from_presenter: mockPresenters[2],
                        to_presenter: mockPresenters[1],
                        from_meeting: mockMeetings[2],
                        to_meeting: mockMeetings[1],
                        status: 'rejected',
                        reason: 'Personal emergency, need to reschedule',
                        requested_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
                        reviewed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
                        reviewed_by: 999,
                        admin_notes: 'Rejected - consider postponing instead of swapping'
                    }
                ];

                setSwapRequests(mockSwapRequests);
                setError(null);
            } catch (err) {
                setError('Failed to load swap requests');
                console.error('Error loading swap requests:', err);
            } finally {
                setLoading(false);
            }
        };

        initializeMockData();
    }, [token]);

    // Filter swap requests
    const filteredRequests = swapRequests.filter(request => {
        const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
        const matchesSearch = !searchTerm || 
            request.from_presenter.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.from_presenter.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.to_presenter.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.to_presenter.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.from_meeting.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.to_meeting.topic.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesStatus && matchesSearch;
    });

    // Handle review actions
    const handleReviewRequest = (request: SwapRequest, action: 'approve' | 'reject') => {
        setSelectedRequest(request);
        setReviewAction(action);
        setReviewNotes('');
        setShowReviewModal(true);
    };

    const handleSubmitReview = async () => {
        if (!selectedRequest) return;

        setIsSubmitting(true);
        try {
            if (reviewAction === 'approve' && onApprove) {
                await onApprove(selectedRequest.id, reviewNotes);
            } else if (reviewAction === 'reject' && onReject) {
                await onReject(selectedRequest.id, reviewNotes);
            }
            
            // Update local state
            setSwapRequests(prev => 
                prev.map(request => 
                    request.id === selectedRequest.id 
                        ? { 
                            ...request, 
                            status: reviewAction === 'approve' ? 'approved' : 'rejected',
                            reviewed_at: new Date().toISOString(),
                            admin_notes: reviewNotes
                        }
                        : request
                )
            );
            
            setShowReviewModal(false);
            setSelectedRequest(null);
        } catch (error) {
            console.error('Failed to review swap request:', error);
            // Handle error appropriately
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Get status icon
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="w-4 h-4" />;
            case 'approved':
                return <CheckCircle className="w-4 h-4" />;
            case 'rejected':
                return <XCircle className="w-4 h-4" />;
            default:
                return <AlertCircle className="w-4 h-4" />;
        }
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
                        <h2 className="text-2xl font-bold text-gray-900">Swap Requests</h2>
                        <p className="text-gray-600">
                            {isAdmin ? 'Review and manage presenter swap requests' : 'View your swap request history'}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                            {filteredRequests.filter(r => r.status === 'pending').length} pending requests
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by presenter or topic..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                    
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Pending</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {swapRequests.filter(r => r.status === 'pending').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Approved</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {swapRequests.filter(r => r.status === 'approved').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Rejected</p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {swapRequests.filter(r => r.status === 'rejected').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <ArrowUpDown className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">Total</p>
                            <p className="text-2xl font-semibold text-gray-900">{swapRequests.length}</p>
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

            {/* Swap Requests List */}
            <div className="bg-white rounded-lg border border-gray-200">
                {filteredRequests.length === 0 ? (
                    <div className="p-8 text-center">
                        <ArrowUpDown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No swap requests found</h3>
                        <p className="text-gray-600">
                            {searchTerm || statusFilter !== 'all' 
                                ? 'Try adjusting your search or filter criteria'
                                : 'No swap requests have been submitted yet'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredRequests.map((request) => (
                            <SwapRequestCard
                                key={request.id}
                                request={request}
                                isAdmin={isAdmin}
                                onApprove={() => handleReviewRequest(request, 'approve')}
                                onReject={() => handleReviewRequest(request, 'reject')}
                                getStatusColor={getStatusColor}
                                getStatusIcon={getStatusIcon}
                                formatDate={formatDate}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {showReviewModal && selectedRequest && (
                <ReviewModal
                    request={selectedRequest}
                    action={reviewAction}
                    notes={reviewNotes}
                    onNotesChange={setReviewNotes}
                    onSubmit={handleSubmitReview}
                    onCancel={() => {
                        setShowReviewModal(false);
                        setSelectedRequest(null);
                    }}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
};

// Swap Request Card Component
interface SwapRequestCardProps {
    request: SwapRequest;
    isAdmin: boolean;
    onApprove: () => void;
    onReject: () => void;
    getStatusColor: (status: string) => string;
    getStatusIcon: (status: string) => React.ReactNode;
    formatDate: (date: string) => string;
}

const SwapRequestCard: React.FC<SwapRequestCardProps> = ({
    request,
    isAdmin,
    onApprove,
    onReject,
    getStatusColor,
    getStatusIcon,
    formatDate
}) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            <span className="ml-1 capitalize">{request.status}</span>
                        </span>
                        
                        <span className="text-sm text-gray-500">
                            Requested {formatDate(request.requested_at)}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* From Meeting */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-700">From:</h4>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <User className="w-4 h-4 text-red-600" />
                                    <span className="font-medium text-red-800">
                                        {request.from_presenter.first_name} {request.from_presenter.last_name}
                                    </span>
                                </div>
                                <div className="text-sm text-red-700">
                                    <div className="flex items-center gap-1 mb-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{new Date(request.from_meeting.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="font-medium">{request.from_meeting.topic}</div>
                                </div>
                            </div>
                        </div>

                        {/* To Meeting */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-700">To:</h4>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <User className="w-4 h-4 text-green-600" />
                                    <span className="font-medium text-green-800">
                                        {request.to_presenter.first_name} {request.to_presenter.last_name}
                                    </span>
                                </div>
                                <div className="text-sm text-green-700">
                                    <div className="flex items-center gap-1 mb-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{new Date(request.to_meeting.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="font-medium">{request.to_meeting.topic}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    {request.reason && (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Reason:</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                                {request.reason}
                            </p>
                        </div>
                    )}

                    {/* Admin Notes */}
                    {request.admin_notes && (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Admin Notes:</h4>
                            <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                {request.admin_notes}
                            </p>
                        </div>
                    )}

                    {/* Review Info */}
                    {request.reviewed_at && (
                        <div className="mt-4 text-sm text-gray-500">
                            Reviewed on {formatDate(request.reviewed_at)}
                        </div>
                    )}
                </div>
                
                {/* Actions */}
                <div className="ml-4 flex items-center gap-2">
                    {isAdmin && request.status === 'pending' && (
                        <>
                            <button
                                onClick={onApprove}
                                className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <Check className="w-4 h-4 mr-1" />
                                Approve
                            </button>
                            <button
                                onClick={onReject}
                                className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <X className="w-4 h-4 mr-1" />
                                Reject
                            </button>
                        </>
                    )}
                    
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Review Modal Component
interface ReviewModalProps {
    request: SwapRequest;
    action: 'approve' | 'reject';
    notes: string;
    onNotesChange: (notes: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
    request,
    action,
    notes,
    onNotesChange,
    onSubmit,
    onCancel,
    isSubmitting
}) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {action === 'approve' ? 'Approve' : 'Reject'} Swap Request
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Request Summary:</h3>
                        <p className="text-sm text-gray-600">
                            <strong>{request.from_presenter.first_name} {request.from_presenter.last_name}</strong> wants to swap 
                            their presentation on <strong>{new Date(request.from_meeting.date).toLocaleDateString()}</strong> with{' '}
                            <strong>{request.to_presenter.first_name} {request.to_presenter.last_name}</strong>'s presentation 
                            on <strong>{new Date(request.to_meeting.date).toLocaleDateString()}</strong>.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Admin Notes {action === 'reject' && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => onNotesChange(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder={action === 'approve' 
                                ? 'Optional: Add notes about this approval...'
                                : 'Required: Please explain why this request is being rejected...'
                            }
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting || (action === 'reject' && !notes.trim())}
                        className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                            action === 'approve' 
                                ? 'bg-green-600 hover:bg-green-700' 
                                : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                {action === 'approve' ? 'Approving...' : 'Rejecting...'}
                            </>
                        ) : (
                            <>
                                {action === 'approve' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                {action === 'approve' ? 'Approve Request' : 'Reject Request'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SwapRequestManager;