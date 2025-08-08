import React, { useState } from 'react';
import { Calendar, Clock, Users, Settings, X, Plus } from 'lucide-react';

interface MeetingGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (params: MeetingGenerationParams) => void;
    isLoading?: boolean;
}

export interface MeetingGenerationParams {
    start_date: string;
    end_date: string;
    meeting_types: string[];
    auto_assign_presenters: boolean;
    generation_mode: 'weeks' | 'months' | 'count' | 'custom';
    weeks_ahead?: number;
    months_ahead?: number;
    meeting_count?: number;
}

const MeetingGenerationModal: React.FC<MeetingGenerationModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    isLoading = false
}) => {
    const [generationMode, setGenerationMode] = useState<'weeks' | 'months' | 'count' | 'custom'>('months');
    const [weeksAhead, setWeeksAhead] = useState(12);
    const [monthsAhead, setMonthsAhead] = useState(3);
    const [meetingCount, setMeetingCount] = useState(10);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [meetingTypes, setMeetingTypes] = useState<string[]>(['research_update', 'journal_club']);
    const [autoAssignPresenters, setAutoAssignPresenters] = useState(true);

    React.useEffect(() => {
        if (isOpen) {
            // Set default start date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setStartDate(tomorrow.toISOString().split('T')[0]);

            // Set default end date based on mode
            const endDefault = new Date();
            if (generationMode === 'months') {
                endDefault.setMonth(endDefault.getMonth() + monthsAhead);
            } else if (generationMode === 'weeks') {
                endDefault.setDate(endDefault.getDate() + (weeksAhead * 7));
            }
            setEndDate(endDefault.toISOString().split('T')[0]);
        }
    }, [isOpen, generationMode, weeksAhead, monthsAhead]);

    const handleMeetingTypeToggle = (type: string) => {
        setMeetingTypes(prev => 
            prev.includes(type) 
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const calculateDateRange = () => {
        const start = new Date();
        start.setDate(start.getDate() + 1); // Tomorrow

        const end = new Date();
        switch (generationMode) {
            case 'weeks':
                end.setDate(end.getDate() + (weeksAhead * 7));
                break;
            case 'months':
                end.setMonth(end.getMonth() + monthsAhead);
                break;
            case 'count':
                // Estimate based on weekly meetings
                end.setDate(end.getDate() + (meetingCount * 7));
                break;
            case 'custom':
                return { start_date: startDate, end_date: endDate };
        }
        
        return {
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0]
        };
    };

    const handleGenerate = () => {
        if (meetingTypes.length === 0) {
            alert('Please select at least one meeting type.');
            return;
        }

        const dateRange = calculateDateRange();
        
        const params: MeetingGenerationParams = {
            ...dateRange,
            meeting_types: meetingTypes,
            auto_assign_presenters: autoAssignPresenters,
            generation_mode: generationMode,
            weeks_ahead: weeksAhead,
            months_ahead: monthsAhead,
            meeting_count: meetingCount
        };

        onGenerate(params);
    };

    const getEstimatedMeetings = () => {
        switch (generationMode) {
            case 'weeks':
                return `~${weeksAhead} meetings`;
            case 'months':
                return `~${monthsAhead * 4} meetings`;
            case 'count':
                return `${meetingCount} meetings`;
            case 'custom':
                const start = new Date(startDate);
                const end = new Date(endDate);
                const weeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
                return `~${weeks} meetings`;
            default:
                return '';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-screen overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Plus className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Generate Meetings</h2>
                            <p className="text-sm text-gray-500">Configure automatic meeting generation</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Generation Mode */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Generation Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setGenerationMode('months')}
                                className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                                    generationMode === 'months'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                By Months
                            </button>
                            <button
                                type="button"
                                onClick={() => setGenerationMode('weeks')}
                                className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                                    generationMode === 'weeks'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                By Weeks
                            </button>
                            <button
                                type="button"
                                onClick={() => setGenerationMode('count')}
                                className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                                    generationMode === 'count'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                By Count
                            </button>
                            <button
                                type="button"
                                onClick={() => setGenerationMode('custom')}
                                className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                                    generationMode === 'custom'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                Custom Range
                            </button>
                        </div>
                    </div>

                    {/* Mode-specific inputs */}
                    {generationMode === 'months' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Months Ahead
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                value={monthsAhead}
                                onChange={(e) => setMonthsAhead(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {generationMode === 'weeks' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Weeks Ahead
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="52"
                                value={weeksAhead}
                                onChange={(e) => setWeeksAhead(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {generationMode === 'count' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number of Meetings
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={meetingCount}
                                onChange={(e) => setMeetingCount(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {generationMode === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Meeting Types */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            <Settings className="w-4 h-4 inline mr-2" />
                            Meeting Types
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={meetingTypes.includes('research_update')}
                                    onChange={() => handleMeetingTypeToggle('research_update')}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Research Update</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={meetingTypes.includes('journal_club')}
                                    onChange={() => handleMeetingTypeToggle('journal_club')}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Journal Club</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={meetingTypes.includes('special')}
                                    onChange={() => handleMeetingTypeToggle('special')}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Special Meeting</span>
                            </label>
                        </div>
                    </div>

                    {/* Auto-assign Presenters */}
                    <div>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={autoAssignPresenters}
                                onChange={(e) => setAutoAssignPresenters(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                                <Users className="w-4 h-4 inline mr-1" />
                                Auto-assign Presenters
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                            Automatically assign presenters using fair rotation algorithm
                        </p>
                    </div>

                    {/* Estimate */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <Clock className="w-4 h-4 text-blue-600 mr-2" />
                            <span className="text-sm font-medium text-blue-900">
                                Estimated: {getEstimatedMeetings()}
                            </span>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                            Actual count may vary due to holidays and existing meetings
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || meetingTypes.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                Generate Meetings
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MeetingGenerationModal;