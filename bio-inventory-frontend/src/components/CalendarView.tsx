import React, { useState, useMemo, useCallback } from 'react';
import { formatDateET, isTodayET, formatDateForInput, formatTimeET, formatDateTimeET, EASTERN_TIME_ZONE, getCurrentDateET } from '../utils/timezone.ts';
import '../styles/enhanced-calendar.css';
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
      const dateStr = formatDateET(currentDate);
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
        isToday: isTodayET(currentDate),
        isSelected: formatDateET(currentDate) === selectedDate,
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
    const todayET = getCurrentDateET();
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateStr = formatDateET(currentDate);
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
        isToday: isTodayET(currentDate),
        isSelected: formatDateET(currentDate) === selectedDate,
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
    
    onDateChange(formatDateET(date));
  }, [selectedDate, viewMode, onDateChange]);

  const formatDate = useCallback((date: string) => {
    const d = new Date(date);
    return {
      dayName: d.toLocaleDateString('en-US', { 
        timeZone: EASTERN_TIME_ZONE,
        weekday: 'short' 
      }),
      dayNumber: d.toLocaleDateString('en-US', { 
        timeZone: EASTERN_TIME_ZONE,
        day: 'numeric' 
      }),
      monthName: d.toLocaleDateString('en-US', { 
        timeZone: EASTERN_TIME_ZONE,
        month: 'short' 
      }),
      fullDate: d.toLocaleDateString('en-US', { 
        timeZone: EASTERN_TIME_ZONE,
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: '600px', marginBottom: '80px' }}>
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
              new Date(selectedDate).toLocaleDateString('en-US', { 
                timeZone: EASTERN_TIME_ZONE,
                year: 'numeric', 
                month: 'long' 
              })
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
                className={`min-h-[140px] p-4 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden ${
                  !day.isCurrentMonth ? 'bg-gray-50' : ''
                } ${day.isSelected ? 'bg-blue-50' : ''} ${day.isToday ? 'bg-yellow-50' : ''}`}
                onClick={() => onDateChange(day.date)}
                onDoubleClick={() => onCreateEvent?.(day.date)}
              >
                {/* Day Number */}
                <div className={`text-sm font-semibold mb-3 flex items-center justify-between ${
                  !day.isCurrentMonth ? 'text-gray-400' : 
                  day.isToday ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  <span className={day.isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold' : 'text-lg font-bold'}>
                    {formatDate(day.date).dayNumber}
                  </span>
                  {day.schedules.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full font-medium">
                      {day.schedules.length}
                    </span>
                  )}
                </div>
                
                {/* Events */}
                <div className="space-y-2 overflow-hidden flex-1">
                  {day.schedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`text-xs p-2 rounded-lg cursor-pointer border-l-3 transition-all duration-200 hover:shadow-sm ${scheduleHelpers.getEventColorLight(scheduleHelpers.getEventType(schedule), schedule.status)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent?.(schedule);
                      }}
                      title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                      style={{ maxHeight: '32px', minHeight: '32px' }}
                    >
                      <div className="truncate leading-tight">
                        <span className="font-bold text-xs mr-1">{formatTime(schedule.start_time)}</span>
                        <span className="text-xs">{schedule.title}</span>
                      </div>
                    </div>
                  ))}
                  {day.schedules.length > 3 && (
                    <div className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-lg truncate">
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
          <div className="flex" style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}>
            {/* Time Column */}
            <div className="w-20 border-r border-gray-200 flex-shrink-0">
              <div className="h-12 sticky top-0 bg-white z-10"></div> {/* Header spacer */}
              {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                <div key={time} className="h-16 px-2 py-1 text-xs text-gray-500 border-b border-gray-100">
                  {formatTime(time)}
                </div>
              ))}
            </div>
            
            {/* Week Days */}
            <div className="flex-1 grid grid-cols-7 min-w-0">
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
                    const eventWidth = 160; // Week view column width approximation
                    return (
                      <div
                        key={schedule.id}
                        className={`absolute left-2 right-2 rounded-lg cursor-pointer text-xs border-l-3 modern-calendar-event ${scheduleHelpers.getEventColor(scheduleHelpers.getEventType(schedule), schedule.status)}`}
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
                        <div className="h-full flex p-2 relative overflow-hidden">
                          {/* Single Horizontal Row - All Components */}
                          <div className="flex items-center gap-1.5 flex-1 min-h-0">
                            {/* Event Type Badge */}
                            <div className="flex-shrink-0 text-xs event-type-badge rounded-full w-4 h-4 flex items-center justify-center">
                              {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                            </div>
                            
                            {/* Title and Time Combined */}
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="event-title text-xs leading-tight truncate font-semibold">
                                {schedule.title}
                              </div>
                              <div className="event-time text-xs leading-tight opacity-90">
                                {formatTime(schedule.start_time)}
                              </div>
                            </div>

                            {/* Location - Horizontal if space */}
                            {schedule.location && eventWidth > 120 && (
                              <div className="event-location text-xs leading-tight truncate flex-shrink-0 max-w-16">
                                {schedule.location}
                              </div>
                            )}
                          </div>
                        </div>
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
          <div className="flex" style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}>
            {/* Time Column */}
            <div className="w-24 border-r border-gray-200 flex-shrink-0">
              {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                <div key={time} className="h-16 px-3 py-2 text-sm text-gray-500 border-b border-gray-100">
                  {formatTime(time)}
                </div>
              ))}
            </div>
            
            {/* Day Content */}
            <div className="flex-1 relative overflow-y-auto min-w-0" style={{ height: '100%' }}>
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
                    className={`absolute left-3 right-3 rounded-lg cursor-pointer shadow-md border-l-4 modern-calendar-event ${scheduleHelpers.getEventColor(scheduleHelpers.getEventType(schedule), schedule.status)}`}
                    style={{
                      top: position.top,
                      height: Math.max(position.height, 80),
                      zIndex: 10
                    }}
                    onClick={() => onEditEvent?.(schedule)}
                    onMouseEnter={() => setHoveredEvent(schedule.id)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    title={`${schedule.title} (${scheduleHelpers.getEventType(schedule)})`}
                  >
                    <div className="h-full flex flex-col p-3 relative overflow-hidden">
                      {/* Main Horizontal Row - All Key Components */}
                      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                        {/* Event Type Badge */}
                        <div className="flex-shrink-0 text-xs event-type-badge rounded-full w-6 h-6 flex items-center justify-center">
                          {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Title and Time Combined Column */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="event-title text-sm leading-tight truncate font-semibold">
                            {schedule.title}
                          </div>
                          <div className="event-time text-xs leading-tight">
                            {formatTime(schedule.start_time)}
                            {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                          </div>
                        </div>

                        {/* Location - Horizontal if there's space */}
                        {schedule.location && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <MapPin className="w-2.5 h-2.5 icon flex-shrink-0" />
                            <span className="event-location text-xs leading-tight truncate max-w-20">
                              {schedule.location}
                            </span>
                          </div>
                        )}
                        
                        {/* Action Buttons - Horizontal */}
                        {hoveredEvent === schedule.id && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent?.(schedule);
                              }}
                              className="p-1 hover:bg-white hover:bg-opacity-20 rounded icon"
                              title="Edit event"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (schedule.status !== 'cancelled' && schedule.status !== 'completed') {
                                  console.log('Cancel event:', schedule.id);
                                }
                              }}
                              className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-orange-400 icon"
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
                              className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-red-600 icon"
                              title="Delete event"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status Badge - Secondary Row if needed */}
                      {schedule.status && schedule.status !== 'scheduled' && (
                        <div className="status-badge text-xs px-2 py-1 rounded-full self-start">
                          {schedule.status.replace('_', ' ').toUpperCase()}
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