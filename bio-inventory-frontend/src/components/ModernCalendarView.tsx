import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Edit3,
  Trash2,
  MoreHorizontal,
  Filter,
  Settings,
  Grid3X3,
  List,
  Zap,
  Search,
  Bell
} from 'lucide-react';
import { Schedule, scheduleHelpers } from '../services/scheduleApi.ts';

interface ModernCalendarViewProps {
  schedules: Schedule[];
  loading: boolean;
  selectedDate: string;
  onDateChange: (date: string) => void;
  viewMode: 'day' | 'week' | 'month';
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void;
  onCreateEvent?: (date?: string, time?: string) => void;
  onEditEvent?: (event: Schedule) => void;
  onDeleteEvent?: (eventId: number) => void;
}

const ModernCalendarView: React.FC<ModernCalendarViewProps> = ({
  schedules,
  loading,
  selectedDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);
  const [calendarLayout, setCalendarLayout] = useState<'grid' | 'list'>('grid');
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);

  // Generate calendar days for month view with modern styling
  const calendarDays = useMemo(() => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    const days = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    const selected = new Date(selectedDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const daySchedules = schedules.filter(s => s.date === dateStr);
      
      days.push({
        date: dateStr,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.toDateString() === today.toDateString(),
        isSelected: currentDate.toDateString() === selected.toDateString(),
        schedules: daySchedules,
        dayNumber: currentDate.getDate(),
        isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [selectedDate, schedules]);

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    
    if (viewMode === 'day') {
      date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewMode === 'month') {
      date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    }
    
    onDateChange(date.toISOString().split('T')[0]);
  }, [selectedDate, viewMode, onDateChange]);

  const formatDate = useCallback((date: string) => {
    const d = new Date(date);
    return {
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      monthFullName: d.toLocaleDateString('en-US', { month: 'long' }),
      year: d.getFullYear(),
      fullDate: d.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };
  }, []);

  const formatTime = useCallback((timeString: string | undefined): string => {
    if (!timeString) return '';
    return scheduleHelpers.formatScheduleTime(timeString, null);
  }, []);

  const getEventColor = (schedule: Schedule) => {
    const statusColors = {
      'scheduled': 'bg-blue-500 border-blue-600',
      'in_progress': 'bg-yellow-500 border-yellow-600',
      'completed': 'bg-green-500 border-green-600',
      'cancelled': 'bg-red-500 border-red-600'
    };
    return statusColors[schedule.status as keyof typeof statusColors] || 'bg-gray-500 border-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Navigation Controls */}
            <div className="flex items-center bg-white bg-opacity-20 rounded-xl p-1">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-200"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-200"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Date Display */}
            <div>
              <h1 className="text-2xl font-bold">
                {viewMode === 'day' && formatDate(selectedDate).fullDate}
                {viewMode === 'week' && `Week of ${formatDate(selectedDate).monthName} ${formatDate(selectedDate).dayNumber}`}
                {viewMode === 'month' && `${formatDate(selectedDate).monthFullName} ${formatDate(selectedDate).year}`}
              </h1>
              <p className="text-primary-100 text-sm">
                {schedules.length} events scheduled
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3">
            {/* Layout Toggle */}
            <div className="flex items-center bg-white bg-opacity-20 rounded-xl p-1">
              <button
                onClick={() => setCalendarLayout('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  calendarLayout === 'grid' ? 'bg-white bg-opacity-30' : 'hover:bg-white hover:bg-opacity-20'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarLayout('list')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  calendarLayout === 'list' ? 'bg-white bg-opacity-30' : 'hover:bg-white hover:bg-opacity-20'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center bg-white bg-opacity-20 rounded-xl p-1">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onViewModeChange(mode)}
                  className={`px-4 py-2 text-sm font-medium capitalize rounded-lg transition-all duration-200 ${
                    viewMode === mode
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'hover:bg-white hover:bg-opacity-20'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Quick Create Button */}
            <button
              onClick={() => onCreateEvent?.(selectedDate)}
              className="flex items-center gap-2 bg-white text-primary-700 px-4 py-2 rounded-xl font-medium hover:bg-opacity-90 transition-all duration-200 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex">
        {/* Sidebar - Mini Calendar & Quick Info */}
        {showMiniCalendar && (
          <div className="w-80 border-r border-gray-100 bg-gray-50">
            <div className="p-6 space-y-6">
              {/* Mini Calendar */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Quick Navigation
                </h3>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-400 p-1">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <button
                      key={day.date}
                      onClick={() => onDateChange(day.date)}
                      className={`w-8 h-8 text-xs rounded-lg flex items-center justify-center transition-all duration-200 ${
                        day.isToday 
                          ? 'bg-primary-600 text-white font-semibold shadow-sm' 
                          : day.isSelected
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : day.isCurrentMonth 
                          ? 'hover:bg-gray-100 text-gray-700' 
                          : 'text-gray-300'
                      }`}
                    >
                      {day.dayNumber}
                      {day.schedules.length > 0 && (
                        <div className="absolute mt-6 ml-4">
                          <div className={`w-1 h-1 rounded-full ${
                            day.isToday || day.isSelected ? 'bg-white' : 'bg-primary-500'
                          }`} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Today's Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Today's Overview
                </h3>
                {schedules.filter(s => s.date === new Date().toISOString().split('T')[0]).length === 0 ? (
                  <p className="text-gray-500 text-sm">No events today</p>
                ) : (
                  <div className="space-y-2">
                    {schedules
                      .filter(s => s.date === new Date().toISOString().split('T')[0])
                      .slice(0, 3)
                      .map(schedule => (
                        <div key={schedule.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <div className={`w-2 h-8 rounded-full ${getEventColor(schedule)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{schedule.title}</p>
                            <p className="text-xs text-gray-500">{formatTime(schedule.start_time)}</p>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Calendar Area */}
        <div className="flex-1">
          {viewMode === 'month' && calendarLayout === 'grid' && (
            <div className="h-full">
              {/* Month Grid View */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <div key={day} className="p-4 bg-gray-50 border-r border-gray-100 last:border-r-0">
                    <div className="text-sm font-semibold text-gray-700">{day}</div>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 h-full">
                {calendarDays.map((day) => (
                  <div
                    key={day.date}
                    className={`min-h-32 border-r border-b border-gray-100 last:border-r-0 p-2 cursor-pointer group relative ${
                      !day.isCurrentMonth ? 'bg-gray-50' : 'hover:bg-primary-50'
                    } ${day.isSelected ? 'bg-primary-100' : ''} ${day.isToday ? 'bg-gradient-to-br from-primary-50 to-primary-100' : ''}`}
                    onClick={() => onDateChange(day.date)}
                    onDoubleClick={() => onCreateEvent?.(day.date)}
                  >
                    {/* Day Number */}
                    <div className={`text-sm font-semibold mb-2 flex items-center justify-between ${
                      !day.isCurrentMonth ? 'text-gray-400' : 
                      day.isToday ? 'text-primary-700' : 
                      day.isWeekend ? 'text-gray-600' : 'text-gray-900'
                    }`}>
                      <span className={day.isToday ? 'bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs' : ''}>
                        {day.dayNumber}
                      </span>
                      {day.schedules.length > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-1 rounded">
                          {day.schedules.length}
                        </span>
                      )}
                    </div>
                    
                    {/* Events */}
                    <div className="space-y-1">
                      {day.schedules.slice(0, 3).map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`text-xs p-1 rounded cursor-pointer truncate text-white transition-all duration-200 hover:shadow-sm ${getEventColor(schedule)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent?.(schedule);
                          }}
                          title={`${schedule.title} - ${formatTime(schedule.start_time)}`}
                        >
                          {formatTime(schedule.start_time)} {schedule.title}
                        </div>
                      ))}
                      {day.schedules.length > 3 && (
                        <div className="text-xs text-gray-500 font-medium">
                          +{day.schedules.length - 3} more
                        </div>
                      )}
                    </div>

                    {/* Quick Add Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateEvent?.(day.date);
                      }}
                      className="absolute bottom-2 right-2 w-6 h-6 bg-primary-600 text-white rounded-full items-center justify-center hover:bg-primary-700 transition-all duration-200 opacity-0 group-hover:opacity-100 flex"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      {onCreateEvent && (
        <button
          onClick={() => onCreateEvent()}
          className="md:hidden fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};

export default ModernCalendarView;