import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { Schedule, scheduleHelpers } from "../services/scheduleApi.ts";
import ScheduleDetailPanel from './ScheduleDetailPanel.tsx';
import EventColorLegend from './EventColorLegend.tsx';

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
  // Optional: external selected event for controlled detail panel
  selectedEventId?: number | null;
  onSelectEvent?: (event: Schedule | null) => void;
  onMarkComplete?: (eventId: number) => void;
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
  onDeleteEvent,
  selectedEventId,
  onSelectEvent,
  onMarkComplete
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);
  const [calendarLayout, setCalendarLayout] = useState<'grid' | 'list'>('grid');
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [localSelectedEventId, setLocalSelectedEventId] = useState<number | null>(null);

  const effectiveSelectedId = selectedEventId ?? localSelectedEventId;
  const selectedEvent = useMemo(() => {
    if (effectiveSelectedId == null) return null;
    return schedules.find(s => s.id === effectiveSelectedId) || null;
  }, [effectiveSelectedId, schedules]);

  // Fit-to-viewport height calculations
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number>(560);
  const recomputeHeight = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const bottomPadding = 16; // breathing space
    const h = Math.max(420, window.innerHeight - rect.top - bottomPadding);
    setAvailableHeight(h);
  }, []);

  useEffect(() => {
    recomputeHeight();
    const onResize = () => recomputeHeight();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeHeight]);

  useEffect(() => {
    const id = window.requestAnimationFrame(recomputeHeight);
    return () => window.cancelAnimationFrame(id);
  }, [showMiniCalendar, viewMode, calendarLayout, recomputeHeight]);

  const weekHeaderPx = 64; // h-16 header row
  const hourHeightWeek = Math.max(18, (availableHeight - weekHeaderPx) / 24);
  const hourHeightDay = Math.max(18, availableHeight / 24);
  const monthHeaderPx = 44; // approx header row height in month grid

  // Generate calendar days for different views
  const calendarDays = useMemo(() => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    let days: Array<{
      date: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      schedules: Schedule[];
      dayNumber: number;
      isWeekend: boolean;
    }> = [];
    
    const today = new Date();
    const selected = new Date(selectedDate + 'T00:00:00');
    
    if (viewMode === 'month') {
      // Month view: full calendar grid
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - firstDay.getDay());
      
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
      
      const currentDate = new Date(startDate);
      
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
          schedules: daySchedules,
          dayNumber: currentDate.getDate(),
          isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (viewMode === 'week') {
      // Week view: 7 days starting from Sunday
      const startOfWeek = new Date(date.getTime());
      startOfWeek.setDate(date.getDate() - date.getDay());
      
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek.getTime());
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
          schedules: daySchedules,
          dayNumber: currentDate.getDate(),
          isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
        });
      }
    } else if (viewMode === 'day') {
      // Day view: just the selected day
      const dateStr = date.toISOString().split('T')[0];
      const daySchedules = schedules
        .filter(s => s.date === dateStr)
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
        }, []);
      
      days.push({
        date: dateStr,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        isSelected: true,
        schedules: daySchedules,
        dayNumber: date.getDate(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    return days;
  }, [selectedDate, schedules, viewMode]);

  const monthWeeks = useMemo(() => Math.max(1, Math.ceil(calendarDays.length / 7)), [calendarDays]);
  const monthDayCellHeight = Math.max(56, (availableHeight - monthHeaderPx) / monthWeeks);

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
    return scheduleHelpers.getEventColor(scheduleHelpers.getEventType(schedule), schedule.status);
  };

  const getEventColorLight = (schedule: Schedule) => {
    return scheduleHelpers.getEventColorLight(scheduleHelpers.getEventType(schedule), schedule.status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Modern Header with enhanced styling */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white p-6 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-20 -translate-y-20"></div>
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-20 translate-y-20"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                className={`btn btn-xs ${calendarLayout === 'grid' ? 'btn-ghost bg-white/30 text-white' : 'btn-ghost text-white hover:bg-white/20'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarLayout('list')}
                className={`btn btn-xs ${calendarLayout === 'list' ? 'btn-ghost bg-white/30 text-white' : 'btn-ghost text-white hover:bg-white/20'}`}
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
                  className={`btn btn-xs capitalize ${viewMode === mode ? 'text-primary-700 bg-white' : 'btn-ghost text-white hover:bg-white/20'}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Quick Create Button */}
            <button
              onClick={() => onCreateEvent?.(selectedDate)}
              className="btn btn-sm bg-white text-primary-700 hover:bg-white/90"
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
          <div className="w-72 border-r border-gray-100 bg-gray-50 flex-shrink-0">
            <div className="p-6 space-y-6">
              {/* Mini Calendar */}
              <div className="card p-4">
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
              <div className="card p-4">
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
                        <div key={schedule.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className={`w-3 h-3 rounded-full shadow-sm ${
                            scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                            scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                            scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                            scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                            'bg-gradient-to-r from-indigo-500 to-indigo-600'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate" title={`${schedule.title} (${scheduleHelpers.getEventType(schedule)})`}>
                              {schedule.title}
                            </p>
                            <p className="text-xs text-gray-500">{formatTime(schedule.start_time)}</p>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Color Legend */}
              <EventColorLegend showTitle={true} />
            </div>
          </div>
        )}

        {/* Main Calendar Area - improved space utilization */}
        <div className="flex-1 overflow-y-auto min-w-0" ref={containerRef}>
          {/* Month View */}
          {viewMode === 'month' && calendarLayout === 'grid' && (
            <div className="h-full" style={{ height: availableHeight }}>
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
                    className={`border-r border-b border-gray-100 last:border-r-0 p-2 cursor-pointer group relative ${
                      !day.isCurrentMonth ? 'bg-gray-50' : 'hover:bg-primary-50'
                    } ${day.isSelected ? 'bg-primary-100' : ''} ${day.isToday ? 'bg-gradient-to-br from-primary-50 to-primary-100' : ''}`}
                    style={{ height: monthDayCellHeight }}
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
                    
                    {/* Events with enhanced styling */}
                    <div className="space-y-1">
                      {day.schedules.slice(0, 3).map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`text-xs p-2 rounded-lg cursor-pointer truncate transition-all duration-200 hover:shadow-md hover:scale-[1.02] modern-calendar-event ${getEventColorLight(schedule)} relative`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocalSelectedEventId(schedule.id);
                            onSelectEvent?.(schedule);
                          }}
                          title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                        >
                          {/* Event type indicator dot */}
                          <div className={`absolute left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full ${
                            scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500' :
                            scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500' :
                            scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500' :
                            scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500' :
                            'bg-indigo-500'
                          }`}></div>
                          
                          <div className="pl-4">
                            <div className="font-medium truncate">
                              {formatTime(schedule.start_time)} {schedule.title}
                            </div>
                            {schedule.status !== 'scheduled' && (
                              <div className="text-xs opacity-75 mt-1">
                                {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {day.schedules.length > 3 && (
                        <div className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-lg">
                          +{day.schedules.length - 3} more events
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

          {/* Week View */}
          {viewMode === 'week' && (
            <div className="h-full flex" style={{ height: availableHeight }}>
              {/* Time Column */}
              <div className="w-20 border-r border-gray-100 bg-gray-50">
                <div className="h-16"></div> {/* Header spacer */}
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="px-3 py-2 text-sm text-gray-500 border-b border-gray-100" style={{ height: hourHeightWeek }}>
                    {i.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              
              {/* Week Days */}
              <div className="flex-1">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {calendarDays.slice(0, 7).map((day) => (
                    <div key={`header-${day.date}`} className="h-16 p-3 bg-gray-50 border-r border-gray-100 last:border-r-0 text-center">
                      <div className={`text-sm font-medium ${day.isToday ? 'text-primary-700' : 'text-gray-900'}`}>
                        {formatDate(day.date).dayName}
                      </div>
                      <div className={`text-lg font-bold ${day.isToday ? 'text-primary-700' : 'text-gray-600'}`}>
                        {day.dayNumber}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Day Columns */}
                <div className="grid grid-cols-7 h-full relative">
                  {calendarDays.slice(0, 7).map((day) => (
                    <div key={`column-${day.date}`} className="relative border-r border-gray-100 last:border-r-0">
                      {/* Time Grid */}
                      {Array.from({ length: 24 }, (_, i) => (
                        <div 
                          key={i} 
                          className="border-b border-gray-100 hover:bg-primary-50 cursor-pointer"
                          style={{ height: hourHeightWeek }}
                          onDoubleClick={() => onCreateEvent?.(day.date, `${i.toString().padStart(2, '0')}:00`)}
                        ></div>
                      ))}
                      
                      {/* Events with improved overlap handling */}
                      {day.schedules.map((schedule, eventIndex) => {
                        const startHour = schedule.start_time ? parseInt(schedule.start_time.split(':')[0]) : 9;
                        const startMinute = schedule.start_time ? parseInt(schedule.start_time.split(':')[1]) : 0;
                        const endHour = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) : startHour + 1;
                        const endMinute = schedule.end_time ? parseInt(schedule.end_time.split(':')[1]) : 0;
                        const startPx = startHour * hourHeightWeek + (startMinute / 60) * hourHeightWeek;
                        const endPx = endHour * hourHeightWeek + (endMinute / 60) * hourHeightWeek;
                        const barHeight = Math.max(endPx - startPx, 48);
                        
                        // Calculate overlap with other events
                        const overlappingEvents = day.schedules.filter((otherSchedule, otherIndex) => {
                          if (otherIndex >= eventIndex) return false; // Only check previous events
                          const otherStartHour = otherSchedule.start_time ? parseInt(otherSchedule.start_time.split(':')[0]) : 9;
                          const otherStartMinute = otherSchedule.start_time ? parseInt(otherSchedule.start_time.split(':')[1]) : 0;
                          const otherEndHour = otherSchedule.end_time ? parseInt(otherSchedule.end_time.split(':')[0]) : otherStartHour + 1;
                          const otherEndMinute = otherSchedule.end_time ? parseInt(otherSchedule.end_time.split(':')[1]) : 0;
                          const otherStartPx = otherStartHour * hourHeightWeek + (otherStartMinute / 60) * hourHeightWeek;
                          const otherEndPx = otherEndHour * hourHeightWeek + (otherEndMinute / 60) * hourHeightWeek;
                          
                          // Check if events overlap
                          return startPx < otherEndPx && endPx > otherStartPx;
                        });
                        
                        const overlapCount = overlappingEvents.length;
                        const eventWidth = Math.max(55, 98 - (overlapCount * 10)); // Increased width utilization
                        const leftOffset = overlapCount * 8; // Reduced stagger for more space
                        
                        return (
                          <div
                            key={schedule.id}
                            className={`absolute rounded-lg p-2 cursor-pointer text-white shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-105 modern-calendar-event ${getEventColor(schedule)}`}
                            style={{
                              top: startPx,
                              height: barHeight,
                              left: `${1 + leftOffset}px`, // Reduced left margin
                              width: `calc(${eventWidth}% - ${leftOffset}px)`,
                              zIndex: 10 + eventIndex,
                              minWidth: '100px', // Increased minimum width
                              maxWidth: 'calc(100% - 2px)'
                            }}
                            onClick={() => {
                              setLocalSelectedEventId(schedule.id);
                              onSelectEvent?.(schedule);
                            }}
                            title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                          >
                            <div className="font-semibold text-sm truncate mb-1 leading-tight">{schedule.title}</div>
                            <div className="text-xs font-medium opacity-95 truncate mb-1">
                              {formatTime(schedule.start_time)}
                              {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                            </div>
                            {schedule.location && barHeight > 64 && (
                              <div className="text-xs opacity-85 truncate flex items-center gap-1">
                                📍 <span>{schedule.location}</span>
                              </div>
                            )}
                            {/* Event type indicator */}
                            <div className="absolute top-2 right-2 text-xs font-bold bg-white bg-opacity-25 rounded-full w-5 h-5 flex items-center justify-center">
                              {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Day View */}
          {viewMode === 'day' && (
            <div className="h-full flex" style={{ height: availableHeight }}>
              {/* Time Column */}
              <div className="w-24 border-r border-gray-100 bg-gray-50">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100" style={{ height: hourHeightDay }}>
                    {i.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              
              {/* Day Content */}
              <div className="flex-1 relative">
                {/* Time Grid */}
                {Array.from({ length: 24 }, (_, i) => (
                  <div 
                    key={i} 
                    className="border-b border-gray-100 cursor-pointer hover:bg-primary-50"
                    style={{ height: hourHeightDay }}
                    onDoubleClick={() => onCreateEvent?.(selectedDate, `${i.toString().padStart(2, '0')}:00`)}
                  ></div>
                ))}
                
                {/* Events with enhanced layout and overlap handling */}
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
                  .map((schedule, eventIndex, allEvents) => {
                  const startHour = schedule.start_time ? parseInt(schedule.start_time.split(':')[0]) : 9;
                  const startMinute = schedule.start_time ? parseInt(schedule.start_time.split(':')[1]) : 0;
                  const endHour = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) : startHour + 1;
                  const endMinute = schedule.end_time ? parseInt(schedule.end_time.split(':')[1]) : 0;
                  
                  const startPosition = startHour * hourHeightDay + (startMinute / 60) * hourHeightDay;
                  const endPosition = endHour * hourHeightDay + (endMinute / 60) * hourHeightDay;
                  const height = Math.max(endPosition - startPosition, 80); // Increased minimum height
                  
                  // Calculate overlaps for proper positioning
                  const overlappingEvents = allEvents.filter((otherSchedule, otherIndex) => {
                    if (otherIndex >= eventIndex) return false;
                    const otherStartHour = otherSchedule.start_time ? parseInt(otherSchedule.start_time.split(':')[0]) : 9;
                    const otherStartMinute = otherSchedule.start_time ? parseInt(otherSchedule.start_time.split(':')[1]) : 0;
                    const otherEndHour = otherSchedule.end_time ? parseInt(otherSchedule.end_time.split(':')[0]) : otherStartHour + 1;
                    const otherEndMinute = otherSchedule.end_time ? parseInt(otherSchedule.end_time.split(':')[1]) : 0;
                    const otherStartPosition = otherStartHour * hourHeightDay + (otherStartMinute / 60) * hourHeightDay;
                    const otherEndPosition = otherEndHour * hourHeightDay + (otherEndMinute / 60) * hourHeightDay;
                    
                    return startPosition < otherEndPosition && endPosition > otherStartPosition;
                  });
                  
                  const overlapCount = overlappingEvents.length;
                  const eventWidth = Math.max(65, 95 - (overlapCount * 8)); // Increased base width
                  const leftOffset = overlapCount * 6; // Reduced offset for more space
                  
                  return (
                    <div
                      key={schedule.id}
                      className={`absolute rounded-xl p-5 cursor-pointer text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] modern-calendar-event ${getEventColor(schedule)}`}
                      style={{
                        top: startPosition,
                        height: height,
                        left: `${12 + leftOffset}px`, // Reduced left margin
                        width: `calc(${eventWidth}% - ${leftOffset}px)`,
                        zIndex: 10 + eventIndex,
                        minWidth: '280px', // Increased minimum width
                        maxWidth: 'calc(100% - 24px)' // Ensure it doesn't overflow
                      }}
                      onClick={() => {
                        setLocalSelectedEventId(schedule.id);
                        onSelectEvent?.(schedule);
                      }}
                      title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                    >
                      <div className="flex items-start justify-between h-full">
                        <div className="flex-1 min-w-0 flex flex-col">
                          {/* Event type badge */}
                          <div className="inline-flex items-center gap-2 mb-3">
                            <span className="text-sm font-semibold px-3 py-1 bg-white bg-opacity-25 rounded-full backdrop-blur-sm">
                              {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase() + scheduleHelpers.getEventType(schedule).slice(1)}
                            </span>
                            {schedule.status !== 'scheduled' && (
                              <span className="text-sm font-medium px-3 py-1 bg-white bg-opacity-35 rounded-full backdrop-blur-sm">
                                {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                              </span>
                            )}
                          </div>
                          
                          <div className="font-bold text-xl mb-3 leading-tight">{schedule.title}</div>
                          <div className="text-base font-medium opacity-95 mb-3 flex items-center gap-2">
                            🕐 <span>{formatTime(schedule.start_time)}
                            {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}</span>
                          </div>
                          
                          {schedule.location && (
                            <div className="flex items-center gap-2 text-base opacity-90 mb-3">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate font-medium">{schedule.location}</span>
                            </div>
                          )}
                          
                          {schedule.description && height > 140 && (
                            <div className="text-base opacity-85 line-clamp-4 flex-1 overflow-hidden leading-relaxed">
                              {schedule.description}
                            </div>
                          )}
                        </div>
                        
                        {/* Action buttons - improved visibility */}
                        <div className="flex flex-col gap-2 ml-4 opacity-80 hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEvent?.(schedule);
                            }}
                            className="p-2.5 hover:bg-white hover:bg-opacity-25 rounded-xl transition-all transform hover:scale-110 bg-white bg-opacity-10"
                            title="Edit event"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEvent?.(schedule.id);
                            }}
                            className="p-2.5 hover:bg-white hover:bg-opacity-25 rounded-xl text-red-200 hover:text-red-100 transition-all transform hover:scale-110 bg-white bg-opacity-10"
                            title="Delete event"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Event connection line - enhanced */}
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-white bg-opacity-50 rounded-r-lg"></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Detail Panel (visible on large screens) */}
        <div className="hidden xl:block w-80 border-l border-gray-100 bg-white flex-shrink-0">
          <ScheduleDetailPanel
            schedule={selectedEvent}
            onClose={() => {
              setLocalSelectedEventId(null);
              onSelectEvent?.(null);
            }}
            onEdit={onEditEvent}
            onDelete={onDeleteEvent}
            onMarkComplete={onMarkComplete}
          />
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      {onCreateEvent && (
        <button
          onClick={() => onCreateEvent()}
          className="md:hidden fixed bottom-6 right-6 w-16 h-16 gradient-primary text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};

export default ModernCalendarView;