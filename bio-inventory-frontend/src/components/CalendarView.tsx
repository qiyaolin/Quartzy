import React, { useState, useMemo, useCallback } from 'react';
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
  Filter,
  Eye,
  MoreHorizontal,
  X
} from 'lucide-react';
import { Schedule, scheduleHelpers } from "../services/scheduleApi.ts";

interface CalendarViewProps {
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

interface CalendarDay {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  schedules: Schedule[];
}

const CalendarView: React.FC<CalendarViewProps> = ({
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

  // Generate calendar days for month view
  const calendarDays = useMemo(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // End on Saturday
    
    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    const selected = new Date(selectedDate + 'T00:00:00');
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const daySchedules = schedules
        .filter(s => s.date === dateStr)
        .reduce((unique: Schedule[], schedule) => {
          // Deduplicate by unique id first, then by title, date, and start_time as fallback
          const exists = unique.some(
            existing => existing.id === schedule.id ||
                       (existing.title === schedule.title && 
                        existing.date === schedule.date &&
                        existing.start_time === schedule.start_time)
          );
          if (!exists) {
            unique.push(schedule);
          }
          return unique;
        }, []);
      
      days.push({
        date: dateStr,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.toDateString() === today.toDateString(),
        isSelected: currentDate.toDateString() === selected.toDateString(),
        schedules: daySchedules
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [selectedDate, schedules]);

  // Generate week days for week view
  const weekDays = useMemo(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start from Sunday
    
    const days: CalendarDay[] = [];
    const today = new Date();
    const selected = new Date(selectedDate + 'T00:00:00');
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      const daySchedules = schedules
        .filter(s => s.date === dateStr)
        .reduce((unique: Schedule[], schedule) => {
          // Deduplicate by unique id first, then by title, date, and start_time as fallback
          const exists = unique.some(
            existing => existing.id === schedule.id ||
                       (existing.title === schedule.title && 
                        existing.date === schedule.date &&
                        existing.start_time === schedule.start_time)
          );
          if (!exists) {
            unique.push(schedule);
          }
          return unique;
        }, []);
      
      days.push({
        date: dateStr,
        isCurrentMonth: true,
        isToday: currentDate.toDateString() === today.toDateString(),
        isSelected: currentDate.toDateString() === selected.toDateString(),
        schedules: daySchedules
      });
    }
    
    return days;
  }, [selectedDate, schedules]);

  // Generate time slots for day/week view
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  }, []);

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

  const getEventPosition = useCallback((schedule: Schedule) => {
    if (!schedule.start_time) return { top: 0, height: 60 };
    
    const [hours, minutes] = schedule.start_time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    
    let endMinutes = startMinutes + 60; // Default 1 hour
    if (schedule.end_time) {
      const [endHours, endMins] = schedule.end_time.split(':').map(Number);
      endMinutes = endHours * 60 + endMins;
    }
    
    const duration = endMinutes - startMinutes;
    
    return {
      top: (startMinutes / 120) * 64, // 64px per 2-hour slot
      height: Math.max((duration / 120) * 64, 32) // Minimum 32px height
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Date Display */}
          <div className="text-lg font-semibold text-gray-900">
            {viewMode === 'day' && formatDate(selectedDate).fullDate}
            {viewMode === 'week' && (
              `Week of ${formatDate(weekDays[0]?.date || selectedDate).monthName} ${formatDate(weekDays[0]?.date || selectedDate).dayNumber}`
            )}
            {viewMode === 'month' && (
              new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
            )}
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
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
      </div>

      {/* Calendar Content */}
      <div className="relative">
        {/* Month View */}
        {viewMode === 'month' && (
          <div className="grid grid-cols-7">
            {/* Week Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 border-r border-b border-gray-200 bg-gray-50 text-center text-sm font-medium text-gray-600">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDays.map((day, index) => (
              <div
                key={day.date}
                className={`min-h-[80px] p-1 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  !day.isCurrentMonth ? 'bg-gray-50' : ''
                } ${day.isSelected ? 'bg-blue-50' : ''} ${day.isToday ? 'bg-yellow-50' : ''}`}
                onClick={() => onDateChange(day.date)}
                onDoubleClick={() => onCreateEvent?.(day.date)}
              >
                {/* Day Number */}
                <div className={`text-sm font-medium mb-1 ${
                  !day.isCurrentMonth ? 'text-gray-400' : 
                  day.isToday ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {formatDate(day.date).dayNumber}
                </div>
                
                {/* Events */}
                <div className="space-y-1">
                  {day.schedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`text-xs p-1 rounded cursor-pointer truncate border-l-2 ${scheduleHelpers.getEventColorLight(scheduleHelpers.getEventType(schedule), schedule.status)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent?.(schedule);
                      }}
                      title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                    >
                      {formatTime(schedule.start_time)} {schedule.title}
                    </div>
                  ))}
                  {day.schedules.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{day.schedules.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="flex h-full">
            {/* Time Column */}
            <div className="w-16 border-r border-gray-200 flex-shrink-0">
              <div className="h-12 sticky top-0 bg-white z-10"></div> {/* Header spacer */}
              {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                <div key={time} className="h-16 px-2 py-1 text-xs text-gray-500 border-b border-gray-100">
                  {formatTime(time)}
                </div>
              ))}
            </div>
            
            {/* Week Days */}
            <div className="flex-1 grid grid-cols-7">
              {/* Day Headers */}
              {weekDays.map((day) => (
                <div key={`header-${day.date}`} className="h-12 p-2 border-r border-b border-gray-200 text-center sticky top-0 bg-white z-10">
                  <div className={`text-sm font-medium ${day.isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {formatDate(day.date).dayName}
                  </div>
                  <div className={`text-lg font-bold ${day.isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                    {formatDate(day.date).dayNumber}
                  </div>
                </div>
              ))}
              
              {/* Day Columns */}
              {weekDays.map((day) => (
                <div key={`column-${day.date}`} className="relative border-r border-gray-200">
                  {/* Time Grid */}
                  {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                    <div key={time} className="h-16 border-b border-gray-100"></div>
                  ))}
                  
                  {/* Events */}
                  {day.schedules.map((schedule) => {
                    const position = getEventPosition(schedule);
                    return (
                      <div
                        key={schedule.id}
                        className={`absolute left-1 right-1 rounded p-1 cursor-pointer text-xs border-l-2 ${scheduleHelpers.getEventColor(scheduleHelpers.getEventType(schedule), schedule.status)}`}
                        style={{
                          top: position.top + 48, // Offset for header
                          height: position.height,
                          zIndex: 10
                        }}
                        onClick={() => onEditEvent?.(schedule)}
                        onMouseEnter={() => setHoveredEvent(schedule.id)}
                        onMouseLeave={() => setHoveredEvent(null)}
                        title={`${schedule.title} (${scheduleHelpers.getEventType(schedule)})`}
                      >
                        <div className="font-medium truncate">{schedule.title}</div>
                        <div className="truncate">{formatTime(schedule.start_time)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="flex h-full">
            {/* Time Column */}
            <div className="w-20 border-r border-gray-200 flex-shrink-0">
              {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                <div key={time} className="h-16 px-3 py-2 text-sm text-gray-500 border-b border-gray-100">
                  {formatTime(time)}
                </div>
              ))}
            </div>
            
            {/* Day Content */}
            <div className="flex-1 relative overflow-y-auto" style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}>
              {/* Time Grid */}
              {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                <div 
                  key={time} 
                  className="h-16 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  onDoubleClick={() => onCreateEvent?.(selectedDate, time)}
                ></div>
              ))}
              
              {/* Events */}
              {schedules
                .filter(s => s.date === selectedDate)
                .reduce((unique: Schedule[], schedule) => {
                  // Deduplicate by title, date, and start_time
                  const exists = unique.some(
                    existing => existing.title === schedule.title && 
                               existing.date === schedule.date &&
                               existing.start_time === schedule.start_time
                  );
                  if (!exists) {
                    unique.push(schedule);
                  }
                  return unique;
                }, [])
                .map((schedule) => {
                const position = getEventPosition(schedule);
                return (
                  <div
                    key={schedule.id}
                    className={`absolute left-2 right-2 rounded-lg p-3 cursor-pointer shadow-sm border-l-4 ${scheduleHelpers.getEventColor(scheduleHelpers.getEventType(schedule), schedule.status)}`}
                    style={{
                      top: position.top,
                      height: Math.max(position.height, 60),
                      zIndex: 10
                    }}
                    onClick={() => onEditEvent?.(schedule)}
                    onMouseEnter={() => setHoveredEvent(schedule.id)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    title={`${schedule.title} (${scheduleHelpers.getEventType(schedule)})`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{schedule.title}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatTime(schedule.start_time)}
                          {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                        </div>
                        {schedule.location && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{schedule.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {hoveredEvent === schedule.id && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEvent?.(schedule);
                            }}
                            className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
                            title="Edit event"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Call cancel API instead of delete
                              if (schedule.status !== 'cancelled' && schedule.status !== 'completed') {
                                // TODO: Add cancel functionality
                                console.log('Cancel event:', schedule.id);
                              }
                            }}
                            className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-orange-400"
                            title="Cancel event"
                            disabled={schedule.status === 'cancelled' || schedule.status === 'completed'}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEvent?.(schedule.id);
                            }}
                            className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-red-600"
                            title="Delete event"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Create Button */}
      {onCreateEvent && (
        <button
          onClick={() => onCreateEvent()}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default CalendarView;