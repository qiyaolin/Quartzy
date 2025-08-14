import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatDateET, isTodayET, formatDateForInput, formatTimeET, formatDateTimeET, EASTERN_TIME_ZONE, getCurrentDateET } from '../utils/timezone.ts';
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
import '../styles/enhanced-calendar.css';

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

  // Enhanced fit-to-viewport height calculations
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number>(700);
  const recomputeHeight = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const bottomPadding = 24; // breathing space
    const headerHeight = 120; // approximate header height
    const h = Math.max(600, window.innerHeight - rect.top - bottomPadding - headerHeight);
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
  const workingHours = 18; // 6 AM to 12 AM (6-24)
  const hourHeightWeek = Math.max(24, (availableHeight - weekHeaderPx) / 24);
  const hourHeightDay = Math.max(32, availableHeight / workingHours);
  const monthHeaderPx = 48; // approx header row height in month grid

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
    
    const todayET = getCurrentDateET();
    
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
          schedules: daySchedules,
          dayNumber: currentDate.getDate(),
          isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
        });
      }
    } else if (viewMode === 'day') {
      // Day view: just the selected day
      const dateStr = formatDateET(date);
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
        isToday: isTodayET(date),
        isSelected: true,
        schedules: daySchedules,
        dayNumber: date.getDate(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    return days;
  }, [selectedDate, schedules, viewMode]);

  const monthWeeks = useMemo(() => Math.max(1, Math.ceil(calendarDays.length / 7)), [calendarDays]);
  const monthDayCellHeight = Math.max(140, (availableHeight - monthHeaderPx) / monthWeeks);

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
      monthFullName: d.toLocaleDateString('en-US', { 
        timeZone: EASTERN_TIME_ZONE,
        month: 'long' 
      }),
      year: d.toLocaleDateString('en-US', { 
        timeZone: EASTERN_TIME_ZONE,
        year: 'numeric' 
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
    <div className="card overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '600px', marginBottom: '80px' }}>
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
            {/* Sidebar Toggle */}
            <button
              onClick={() => setShowMiniCalendar(!showMiniCalendar)}
              className="btn btn-ghost btn-sm text-white hover:bg-white/20"
              title={showMiniCalendar ? 'Hide sidebar' : 'Show sidebar'}
            >
              <Filter className="w-4 h-4" />
            </button>

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
        {/* Sidebar - Mini Calendar & Quick Info - Collapsible */}
        {showMiniCalendar && (
          <div className="block w-64 lg:w-72 border-r border-gray-100 bg-gray-50 flex-shrink-0 calendar-sidebar" style={{ height: availableHeight }}>
            <div className="p-6 space-y-6 h-full overflow-y-auto calendar-scroll-container" style={{ paddingBottom: '2rem' }}>
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
                {schedules.filter(s => s.date === getCurrentDateET()).length === 0 ? (
                  <p className="text-gray-500 text-sm">No events today</p>
                ) : (
                  <div className="space-y-2">
                    {schedules
                      .filter(s => s.date === getCurrentDateET())
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

        {/* Main Calendar Area - maximized space utilization */}
        <div className="flex-1 overflow-hidden min-w-0" ref={containerRef}>
          {/* Month View - Expanded */}
          {viewMode === 'month' && calendarLayout === 'grid' && (
            <div className="h-full overflow-hidden" style={{ height: availableHeight }}>
              {/* Month Grid View */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <div key={day} className="p-4 bg-gray-50 border-r border-gray-100 last:border-r-0">
                    <div className="text-sm font-semibold text-gray-700">{day}</div>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7" style={{ height: availableHeight - monthHeaderPx }}>
                {calendarDays.map((day) => (
                  <div
                    key={day.date}
                    className={`border-r border-b border-gray-100 last:border-r-0 p-4 cursor-pointer group relative overflow-hidden ${
                      !day.isCurrentMonth ? 'bg-gray-50' : 'hover:bg-primary-50'
                    } ${day.isSelected ? 'bg-primary-100' : ''} ${day.isToday ? 'bg-gradient-to-br from-primary-50 to-primary-100' : ''}`}
                    style={{ height: Math.max(monthDayCellHeight, 120) }}
                    onClick={() => onDateChange(day.date)}
                    onDoubleClick={() => onCreateEvent?.(day.date)}
                  >
                    {/* Day Number */}
                    <div className={`text-sm font-semibold mb-3 flex items-center justify-between ${
                      !day.isCurrentMonth ? 'text-gray-400' : 
                      day.isToday ? 'text-primary-700' : 
                      day.isWeekend ? 'text-gray-600' : 'text-gray-900'
                    }`}>
                      <span className={day.isToday ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold' : 'text-lg font-bold'}>
                        {day.dayNumber}
                      </span>
                      {day.schedules.length > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full font-medium">
                          {day.schedules.length}
                        </span>
                      )}
                    </div>
                    
                    {/* Events with enhanced styling and better spacing */}
                    <div className="space-y-2 overflow-hidden flex-1 min-h-0">
                      {day.schedules.slice(0, Math.min(4, Math.floor((monthDayCellHeight - 80) / 32))).map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`text-xs p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] modern-calendar-event ${getEventColorLight(schedule)} relative border border-opacity-20 border-gray-400`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocalSelectedEventId(schedule.id);
                            onSelectEvent?.(schedule);
                          }}
                          title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                          style={{ maxHeight: '36px', minHeight: '36px' }}
                        >
                          {/* Event type indicator dot */}
                          <div className={`absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full flex-shrink-0 ${
                            scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500' :
                            scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500' :
                            scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500' :
                            scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500' :
                            'bg-indigo-500'
                          }`}></div>
                          
                          <div className="pl-5 overflow-hidden">
                            <div className="font-medium truncate leading-tight">
                              <span className="text-xs font-bold mr-1">{formatTime(schedule.start_time)}</span>
                              <span className="text-xs">{schedule.title}</span>
                            </div>
                            {schedule.status !== 'scheduled' && (
                              <div className="text-xs opacity-75 truncate leading-tight">
                                {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {day.schedules.length > Math.min(4, Math.floor((monthDayCellHeight - 80) / 32)) && (
                        <div className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-lg truncate">
                          +{day.schedules.length - Math.min(4, Math.floor((monthDayCellHeight - 80) / 32))} more
                        </div>
                      )}
                    </div>

                    {/* Quick Add Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateEvent?.(day.date);
                      }}
                      className="absolute bottom-3 right-3 w-6 h-6 bg-primary-600 text-white rounded-full items-center justify-center hover:bg-primary-700 transition-all duration-200 opacity-0 group-hover:opacity-100 flex shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Week View - Enhanced */}
          {viewMode === 'week' && (
            <div className="h-full flex overflow-hidden" style={{ height: availableHeight }}>
              {/* Time Column - Optimized */}
              <div className="w-16 lg:w-20 border-r border-gray-100 bg-gray-50 flex-shrink-0">
                <div className="h-16"></div> {/* Header spacer */}
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="px-3 py-2 text-sm text-gray-500 border-b border-gray-100" style={{ height: hourHeightWeek }}>
                    {i.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              
              {/* Week Days - Maximized */}
              <div className="flex-1 min-w-0 overflow-hidden">
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
                
                {/* Day Columns - Full height utilization */}
                <div className="grid grid-cols-7 relative calendar-scroll-container overflow-y-auto" style={{ height: availableHeight - weekHeaderPx }}>
                  {calendarDays.slice(0, 7).map((day) => (
                    <div key={`column-${day.date}`} className="relative border-r border-gray-100 last:border-r-0 calendar-day-column">
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
                        const barHeight = Math.max(endPx - startPx, 56); // Increased minimum height for better text display
                        
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
                        const eventWidth = Math.max(30, 98 - (overlapCount * 10)); // Allow narrower events
                        const leftOffset = overlapCount * 6; // Minimal stagger for maximum space
                        
                        return (
                          <div
                            key={schedule.id}
                            className={`absolute rounded-lg p-2 cursor-pointer text-white shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-105 modern-calendar-event ${getEventColor(schedule)}`}
                            style={{
                              top: startPx,
                              height: barHeight,
                              left: `${2 + leftOffset}px`, // Minimal left margin
                              right: `${2}px`, // Use right positioning for better space usage
                              width: `calc(${eventWidth}% - ${leftOffset + 4}px)`,
                              zIndex: 10 + eventIndex,
                              minWidth: eventWidth < 60 ? '80px' : eventWidth < 85 ? '120px' : '160px', // Adaptive minimum width
                              maxWidth: 'calc(100% - 4px)'
                            }}
                            onClick={() => {
                              setLocalSelectedEventId(schedule.id);
                              onSelectEvent?.(schedule);
                            }}
                            title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                          >
                            {/* Horizontal-First Layout Event Card */}
                            <div className="h-full flex flex-col p-2 relative overflow-hidden">
                              {/* Single Horizontal Row - All Components */}
                              <div className="flex items-center gap-1.5 flex-1 min-h-0">
                                {/* Event Type Badge */}
                                <div className="flex-shrink-0 text-xs font-bold event-type-badge rounded-full w-5 h-5 flex items-center justify-center">
                                  {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                                </div>
                                
                                {/* Title and Time Combined */}
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="event-title text-xs leading-tight truncate font-semibold">
                                    {schedule.title}
                                  </div>
                                  <div className="event-time text-xs leading-tight opacity-90">
                                    {formatTime(schedule.start_time)}
                                    {schedule.end_time && eventWidth > 120 && ` - ${formatTime(schedule.end_time)}`}
                                  </div>
                                </div>

                                {/* Location - Horizontal if space allows */}
                                {schedule.location && eventWidth > 140 && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <MapPin className="w-2.5 h-2.5 icon flex-shrink-0" />
                                    <span className="event-location text-xs truncate max-w-16">
                                      {schedule.location}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Quick Edit Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditEvent?.(schedule);
                                  }}
                                  className="flex-shrink-0 p-0.5 hover:bg-white hover:bg-opacity-25 rounded transition-all bg-white bg-opacity-10 icon"
                                  title="Edit event"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              {/* Secondary Row - Only for Very Tall Events */}
                              {barHeight > 80 && schedule.location && eventWidth <= 140 && (
                                <div className="flex items-center gap-1 mt-1 flex-shrink-0">
                                  <MapPin className="w-2.5 h-2.5 icon flex-shrink-0" />
                                  <span className="event-location text-xs truncate">
                                    {schedule.location}
                                  </span>
                                </div>
                              )}

                              {/* Status Badge - Bottom Corner for taller events */}
                              {schedule.status !== 'scheduled' && barHeight > 60 && (
                                <div className="absolute bottom-1 right-1">
                                  <span className="text-xs font-medium px-1.5 py-0.5 bg-white bg-opacity-20 rounded text-white">
                                    {schedule.status.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}

                              {/* Left Border Accent */}
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white bg-opacity-50"></div>
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

          {/* Day View - Enhanced */}
          {viewMode === 'day' && (
            <div className="h-full flex overflow-hidden" style={{ height: availableHeight }}>
              {/* Time Column - Optimized for Working Hours */}
              <div className="w-20 lg:w-24 border-r border-gray-100 bg-gray-50 flex-shrink-0">
                {Array.from({ length: workingHours }, (_, i) => {
                  const hour = i + 6; // Start from 6 AM
                  const displayHour = hour > 24 ? hour - 24 : hour;
                  return (
                    <div key={hour} className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100" style={{ height: hourHeightDay }}>
                      {displayHour.toString().padStart(2, '0')}:00
                    </div>
                  );
                })}
              </div>
              
              {/* Day Content - Maximized */}
              <div className="flex-1 relative min-w-0 overflow-y-auto calendar-scroll-container calendar-day-column" style={{ height: availableHeight }}>
                {/* Time Grid for Working Hours */}
                {Array.from({ length: workingHours }, (_, i) => {
                  const hour = i + 6; // Start from 6 AM
                  const displayHour = hour > 24 ? hour - 24 : hour;
                  return (
                    <div 
                      key={hour} 
                      className="border-b border-gray-100 cursor-pointer hover:bg-primary-50"
                      style={{ height: hourHeightDay }}
                      onDoubleClick={() => onCreateEvent?.(selectedDate, `${displayHour.toString().padStart(2, '0')}:00`)}
                    ></div>
                  );
                })}
                
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
                  
                  // Adjust position calculation for working hours (6 AM - 12 AM)
                  const adjustedStartHour = startHour >= 6 ? startHour - 6 : startHour + 24 - 6;
                  const adjustedEndHour = endHour >= 6 ? endHour - 6 : endHour + 24 - 6;
                  const startPosition = adjustedStartHour * hourHeightDay + (startMinute / 60) * hourHeightDay;
                  const endPosition = adjustedEndHour * hourHeightDay + (endMinute / 60) * hourHeightDay;
                  const height = Math.max(endPosition - startPosition, 90); // Increased minimum height for better layout
                  
                  // Calculate overlaps for proper positioning
                  const overlappingEvents = allEvents.filter((otherSchedule, otherIndex) => {
                    if (otherIndex >= eventIndex) return false;
                    const otherStartHour = otherSchedule.start_time ? parseInt(otherSchedule.start_time.split(':')[0]) : 9;
                    const otherStartMinute = otherSchedule.start_time ? parseInt(otherSchedule.start_time.split(':')[1]) : 0;
                    const otherEndHour = otherSchedule.end_time ? parseInt(otherSchedule.end_time.split(':')[0]) : otherStartHour + 1;
                    const otherEndMinute = otherSchedule.end_time ? parseInt(otherSchedule.end_time.split(':')[1]) : 0;
                    const adjustedOtherStartHour = otherStartHour >= 6 ? otherStartHour - 6 : otherStartHour + 24 - 6;
                    const adjustedOtherEndHour = otherEndHour >= 6 ? otherEndHour - 6 : otherEndHour + 24 - 6;
                    const otherStartPosition = adjustedOtherStartHour * hourHeightDay + (otherStartMinute / 60) * hourHeightDay;
                    const otherEndPosition = adjustedOtherEndHour * hourHeightDay + (otherEndMinute / 60) * hourHeightDay;
                    
                    return startPosition < otherEndPosition && endPosition > otherStartPosition;
                  });
                  
                  const overlapCount = overlappingEvents.length;
                  const eventWidth = Math.max(30, 96 - (overlapCount * 8)); // Allow narrower events for horizontal layout
                  const leftOffset = overlapCount * 4; // Minimal offset for maximum space
                  
                  return (
                    <div
                      key={schedule.id}
                      className={`absolute rounded-xl p-5 cursor-pointer text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] modern-calendar-event ${getEventColor(schedule)}`}
                      style={{
                        top: startPosition,
                        height: height,
                        left: `${8 + leftOffset}px`, // Minimal left margin
                        right: `8px`, // Use right positioning
                        width: `calc(${eventWidth}% - ${leftOffset + 16}px)`,
                        zIndex: 10 + eventIndex,
                        minWidth: eventWidth < 60 ? '150px' : eventWidth < 85 ? '200px' : '320px', // Adaptive minimum width
                        maxWidth: 'calc(100% - 16px)' // Ensure it doesn't overflow
                      }}
                      onClick={() => {
                        setLocalSelectedEventId(schedule.id);
                        onSelectEvent?.(schedule);
                      }}
                      title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                    >
                      {/* Horizontal-First Day View Event Card Layout */}
                      <div className="h-full flex flex-col p-3 relative overflow-hidden">
                        {/* Main Horizontal Row - Badge, Title, Time, Location, Button */}
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
                            <div className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 icon flex-shrink-0" />
                              <span className="text-xs event-time truncate">
                                {formatTime(schedule.start_time)}
                                {schedule.end_time && eventWidth > 200 && ` - ${formatTime(schedule.end_time)}`}
                              </span>
                            </div>
                          </div>

                          {/* Location - Horizontal if space allows */}
                          {schedule.location && eventWidth > 250 && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <MapPin className="w-2.5 h-2.5 icon flex-shrink-0" />
                              <span className="text-xs event-location truncate max-w-24">
                                {schedule.location}
                              </span>
                            </div>
                          )}
                          
                          {/* Quick Action Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEvent?.(schedule);
                            }}
                            className="flex-shrink-0 p-1 hover:bg-white hover:bg-opacity-25 rounded-md transition-all bg-white bg-opacity-10 icon"
                            title="Edit event"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Secondary Row - Only for location when not shown horizontally */}
                        {schedule.location && eventWidth <= 250 && height > 60 && (
                          <div className="flex items-center gap-1 mb-2 flex-shrink-0">
                            <MapPin className="w-3 h-3 icon flex-shrink-0" />
                            <span className="text-xs event-location truncate">
                              {schedule.location}
                            </span>
                          </div>
                        )}

                        {/* Description - Only for tall events */}
                        {schedule.description && height > 100 && (
                          <div className="text-xs text-white opacity-80 line-clamp-2 flex-1 overflow-hidden leading-relaxed">
                            {schedule.description}
                          </div>
                        )}

                        {/* Status Badge - Bottom Corner */}
                        {schedule.status !== 'scheduled' && (
                          <div className="absolute bottom-2 right-2">
                            <span className="text-xs status-badge px-2 py-1 rounded-full">
                              {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                            </span>
                          </div>
                        )}

                        {/* Left Border Accent */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white bg-opacity-50 rounded-r-sm"></div>
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

        {/* Right Detail Panel (collapsible on smaller screens) */}
        <div className="hidden lg:block w-64 xl:w-80 border-l border-gray-100 bg-white flex-shrink-0" style={{ height: availableHeight }}>
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