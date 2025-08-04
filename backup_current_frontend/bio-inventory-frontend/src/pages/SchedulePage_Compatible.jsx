import React, { useState, useEffect, useContext } from 'react';
import { Calendar, Clock, Users, MapPin, Plus, Edit3, Trash2, Filter, Search } from 'lucide-react';
import { AuthContext } from '../components/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const SchedulePage = () => {
    const { token } = useContext(AuthContext);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Fetch schedules
    useEffect(() => {
        if (token) {
            fetchSchedules();
        }
    }, [token, selectedDate, viewMode]);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const response = await fetch(buildApiUrl(`${API_ENDPOINTS.SCHEDULES}?date=${selectedDate}&view=${viewMode}`), {
                headers: { 'Authorization': `Token ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                setSchedules(data.results || data);
            } else {
                setError('Failed to fetch schedules');
            }
        } catch (err) {
            setError('Network error occurred');
            console.error('Error fetching schedules:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter schedules
    const filteredSchedules = schedules.filter(schedule => {
        const matchesSearch = schedule.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             schedule.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || schedule.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // Get schedule status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-800';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Format time
    const formatTime = (timeString) => {
        if (!timeString) return '';
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
                    <p className="text-gray-600">Manage meetings, equipment bookings, and tasks</p>
                </div>
                <button className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    <Plus className="w-4 h-4 mr-2" />
                    New Event
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                    </div>

                    {/* View Mode */}
                    <div className="flex rounded-md border border-gray-300 overflow-hidden">
                        {['day', 'week', 'month'].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-2 text-sm font-medium capitalize ${
                                    viewMode === mode
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Schedule List */}
            <div className="bg-white rounded-lg border border-gray-200">
                {filteredSchedules.length === 0 ? (
                    <div className="p-8 text-center">
                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
                        <p className="text-gray-600">
                            {searchTerm || filterStatus !== 'all' 
                                ? 'Try adjusting your search or filter criteria'
                                : 'Create your first event to get started'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredSchedules.map((schedule) => (
                            <div key={schedule.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-medium text-gray-900">
                                                {schedule.title}
                                            </h3>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                                                {schedule.status?.replace('_', ' ')}
                                            </span>
                                        </div>
                                        
                                        {schedule.description && (
                                            <p className="text-gray-600 text-sm mb-3">
                                                {schedule.description}
                                            </p>
                                        )}
                                        
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                            {schedule.start_time && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>
                                                        {formatTime(schedule.start_time)}
                                                        {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            {schedule.location && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{schedule.location}</span>
                                                </div>
                                            )}
                                            
                                            {schedule.attendees_count && (
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-4 h-4" />
                                                    <span>{schedule.attendees_count} attendees</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 ml-4">
                                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchedulePage;