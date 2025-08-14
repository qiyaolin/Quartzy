import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatDateET, isTodayET, formatDateForInput, formatTimeET, formatDateTimeET, EASTERN_TIME_ZONE, getCurrentDateET, parseDateET } from '../utils/timezone.ts';
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
    const date = parseDateET(selectedDate);
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
    const date = parseDateET(selectedDate);
    
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
    const d = parseDateET(date);
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

  // Helpers for optional fields coming from different APIs
  const getEquipmentName = useCallback((schedule: Schedule): string | null => {
    const s: any = schedule as any;
    const eq: any = s.equipment ?? s.equipment_name ?? s.equipmentName ?? s.resource ?? s.resource_name ?? s.resourceName ?? s.device ?? s.device_name ?? s.instrument ?? s.instrument_name;
    if (eq) {
      if (typeof eq === 'string') return eq;
      if (typeof eq === 'object' && (eq.name || eq.title)) return String(eq.name || eq.title);
      return String(eq);
    }
    // Fallback: extract equipment from title like "Ti2E Booking" => "Ti2E"
    if (typeof s.title === 'string') {
      const lower = s.title.toLowerCase();
      const idx = lower.indexOf('booking');
      if (idx > 0) {
        const name = s.title.slice(0, idx).trim();
        if (name) return name;
      }
    }
    return null;
  }, []);

  const getAssignedUserName = useCallback((schedule: Schedule): string | null => {
    const u: any = (schedule as any).assigned_user || (schedule as any).assignee || (schedule as any).user;
    if (!u) return null;
    if (typeof u === 'string') return u;
    if (typeof u === 'object') return String(u.username || u.name || u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim());
    return String(u);
  }, []);

  // Deterministic equipment color mapping (stable per equipment name)
  const EQUIPMENT_COLOR_MAP: Record<string, { solid: string; light: string; border: string }> = {
    blue:    { solid: 'bg-blue-600',    light: 'bg-blue-50 text-blue-900 border-blue-200',       border: 'border-blue-600'    },
    indigo:  { solid: 'bg-indigo-600',  light: 'bg-indigo-50 text-indigo-900 border-indigo-200', border: 'border-indigo-600'  },
    amber:   { solid: 'bg-amber-600',   light: 'bg-amber-50 text-amber-900 border-amber-200',    border: 'border-amber-600'   },
    emerald: { solid: 'bg-emerald-600', light: 'bg-emerald-50 text-emerald-900 border-emerald-200', border: 'border-emerald-600' },
    cyan:    { solid: 'bg-cyan-600',    light: 'bg-cyan-50 text-cyan-900 border-cyan-200',       border: 'border-cyan-600'    },
    red:     { solid: 'bg-red-600',     light: 'bg-red-50 text-red-900 border-red-200',          border: 'border-red-600'     },
    violet:  { solid: 'bg-violet-600',  light: 'bg-violet-50 text-violet-900 border-violet-200', border: 'border-violet-600'  },
    teal:    { solid: 'bg-teal-600',    light: 'bg-teal-50 text-teal-900 border-teal-200',       border: 'border-teal-600'    },
    rose:    { solid: 'bg-rose-600',    light: 'bg-rose-50 text-rose-900 border-rose-200',       border: 'border-rose-600'    },
    fuchsia: { solid: 'bg-fuchsia-600', light: 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200', border: 'border-fuchsia-600' },
    lime:    { solid: 'bg-lime-600',    light: 'bg-lime-50 text-lime-900 border-lime-200',       border: 'border-lime-600'    },
    sky:     { solid: 'bg-sky-600',     light: 'bg-sky-50 text-sky-900 border-sky-200',          border: 'border-sky-600'     },
    orange:  { solid: 'bg-orange-600',  light: 'bg-orange-50 text-orange-900 border-orange-200', border: 'border-orange-600'  },
    pink:    { solid: 'bg-pink-600',    light: 'bg-pink-50 text-pink-900 border-pink-200',       border: 'border-pink-600'    }
  };
  const EQUIPMENT_COLOR_KEYS = Object.keys(EQUIPMENT_COLOR_MAP);
  // Explicit override keywords -> color keys to guarantee distinct colors for common equipment
  const EQUIPMENT_COLOR_OVERRIDES: Array<{ keywords: string[]; colorKey: keyof typeof EQUIPMENT_COLOR_MAP }> = [
    { keywords: ['bsc', 'biosafety', 'hood'], colorKey: 'blue' },
    { keywords: ['ti2e', 'ti-e', 'nikon', 'microscope', 'scope', 'confocal'], colorKey: 'violet' },
    { keywords: ['incubator'], colorKey: 'amber' },
    { keywords: ['centrifuge'], colorKey: 'emerald' },
    { keywords: ['freezer', 'fridge'], colorKey: 'cyan' },
    { keywords: ['pcr', 'rt-pcr', 'thermocycler'], colorKey: 'red' },
    { keywords: ['spectrometer', 'spectro'], colorKey: 'fuchsia' },
    { keywords: ['shaker', 'mixer'], colorKey: 'teal' }
  ];
  const hashStringToNumber = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };
  const resolveEquipmentColorKey = (equipmentName: string): keyof typeof EQUIPMENT_COLOR_MAP => {
    const name = equipmentName.toLowerCase();
    for (const rule of EQUIPMENT_COLOR_OVERRIDES) {
      if (rule.keywords.some(k => name.includes(k))) return rule.colorKey;
    }
    return EQUIPMENT_COLOR_KEYS[hashStringToNumber(name) % EQUIPMENT_COLOR_KEYS.length] as keyof typeof EQUIPMENT_COLOR_MAP;
  };
  const getEquipmentColorVariant = (equipmentName: string, variant: 'solid' | 'light' | 'border' = 'solid'): string => {
    const key = resolveEquipmentColorKey(equipmentName);
    return EQUIPMENT_COLOR_MAP[key][variant];
  };

  const getEventColor = (schedule: Schedule) => {
    const eventType = scheduleHelpers.getEventType(schedule);
    const equipmentName = getEquipmentName(schedule);
    if ((eventType === 'booking' || eventType === 'equipment') && equipmentName) {
      return getEquipmentColorVariant(equipmentName, 'solid');
    }
    return scheduleHelpers.getEventColor(eventType, schedule.status);
  };

  const getEventColorLight = (schedule: Schedule) => {
    const eventType = scheduleHelpers.getEventType(schedule);
    const equipmentName = getEquipmentName(schedule);
    if ((eventType === 'booking' || eventType === 'equipment') && equipmentName) {
      return getEquipmentColorVariant(equipmentName, 'light');
    }
    return scheduleHelpers.getEventColorLight(eventType, schedule.status);
  };

  // Render overlapping events for a week day column (0-24h grid)
  const renderWeekColumnEvents = useCallback((day: { schedules: Schedule[] }) => {
    // Pre-process events to calculate positions and overlaps
    const processedEvents = day.schedules.map((schedule: any, eventIndex: number) => {
      const startHour = schedule.start_time ? parseInt(schedule.start_time.split(':')[0]) : 9;
      const startMinute = schedule.start_time ? parseInt(schedule.start_time.split(':')[1]) : 0;
      const endHour = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) : startHour + 1;
      const endMinute = schedule.end_time ? parseInt(schedule.end_time.split(':')[1]) : 0;
      const startPx = startHour * hourHeightWeek + (startMinute / 60) * hourHeightWeek;
      const endPx = endHour * hourHeightWeek + (endMinute / 60) * hourHeightWeek;
      const barHeight = Math.max(endPx - startPx, 56);
      return { ...schedule, eventIndex, startPx, endPx, barHeight } as any;
    });

    // Group overlapping events
    const eventGroups: any[][] = [];
    const processed = new Set<number>();

    processedEvents.forEach((event, index) => {
      if (processed.has(index)) return;
      const group = [event];
      processed.add(index);
      for (let i = index + 1; i < processedEvents.length; i++) {
        if (processed.has(i)) continue;
        const otherEvent = processedEvents[i];
        const hasOverlap = group.some(groupEvent => groupEvent.startPx < otherEvent.endPx && groupEvent.endPx > otherEvent.startPx);
        if (hasOverlap) {
          group.push(otherEvent);
          processed.add(i);
        }
      }
      eventGroups.push(group);
    });

    // Render with proper positioning
    return eventGroups.flatMap(group => {
      const groupWidth = Math.max(30, 96 / group.length);
      return group.map((schedule: any, groupIndex: number) => {
        const leftOffset = groupIndex * groupWidth;
        return (
          <div
            key={schedule.id}
            className={`absolute rounded-lg p-2 cursor-pointer text-white shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-105 modern-calendar-event ${getEventColor(schedule)}`}
            style={{
              top: schedule.startPx,
              height: schedule.barHeight,
              left: `${leftOffset}%`,
              width: `${groupWidth - 1}%`,
              zIndex: 10 + schedule.eventIndex,
              minWidth: 'max(60px, 15%)',
              maxWidth: 'calc(100% - 4px)'
            }}
            onClick={() => {
              setLocalSelectedEventId(schedule.id);
              onSelectEvent?.(schedule);
            }}
            title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
          >
            <div className="h-full flex flex-col p-1 relative overflow-hidden">
              <div className="flex items-center gap-1 flex-1 min-h-0">
                <div className="flex-shrink-0 text-xs font-bold event-type-badge rounded-full w-4 h-4 flex items-center justify-center">
                  {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="event-title text-xs leading-tight truncate font-semibold">{schedule.title}</div>
                  <div className="event-time text-xs leading-tight opacity-90">{formatTime(schedule.start_time)}</div>
                </div>
                {group.length <= 2 && (
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
                )}
              </div>
              {schedule.location && schedule.barHeight > 70 && (
                <div className="flex items-center gap-1 mt-1 flex-shrink-0">
                  <MapPin className="w-2 h-2 icon flex-shrink-0" />
                  <span className="event-location text-xs truncate">{schedule.location}</span>
                </div>
              )}
              {schedule.status !== 'scheduled' && schedule.barHeight > 60 && (
                <div className="absolute bottom-1 right-1">
                  <span className="text-xs font-medium px-1.5 py-0.5 bg-white bg-opacity-20 rounded text-white">
                    {schedule.status.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white bg-opacity-50"></div>
            </div>
          </div>
        );
      });
    });
  }, [hourHeightWeek, getEventColor, formatTime, onEditEvent, onSelectEvent]);

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
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Today's Overview
                </h3>
                {schedules.filter(s => s.date === getCurrentDateET()).length === 0 ? (
                  <p className="text-gray-500 text-sm">No events today</p>
                ) : (
                  <div className="space-y-1.5">
                    {schedules
                      .filter(s => s.date === getCurrentDateET())
                      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                      .map(schedule => (
                        <div key={schedule.id} className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-gray-50 transition-colors">
                          <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                            (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                              ? getEquipmentColorVariant(getEquipmentName(schedule) as string, 'solid')
                              : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500' :
                                scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500' :
                                scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500' :
                                scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500' :
                                'bg-indigo-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-xs text-gray-700">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium">
                                {formatTime(schedule.start_time)}
                                {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm text-gray-900 truncate" title={`${schedule.title} (${scheduleHelpers.getEventType(schedule)})`}>
                                {schedule.title}
                              </p>
                              {getEquipmentName(schedule) && (
                                <span className="text-[10px] px-1 py-0.5 bg-white bg-opacity-70 text-gray-700 rounded">
                                  {getEquipmentName(schedule)}
                                </span>
                              )}
                            </div>
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
          {/* Month View - Grid Layout */}
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
                            (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                              ? getEquipmentColorVariant(getEquipmentName(schedule) as string, 'solid')
                              : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500' :
                                scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500' :
                                scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500' :
                                scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500' :
                                'bg-indigo-500'
                          }`}></div>
                          
                          <div className="pl-5 overflow-hidden">
                            <div className="font-medium truncate leading-tight">
                              <span className="text-xs font-bold mr-1">
                                {formatTime(schedule.start_time)}{schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                              </span>
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

          {/* Month View - List Layout */}
          {viewMode === 'month' && calendarLayout === 'list' && (
            <div className="h-full overflow-hidden" style={{ height: availableHeight }}>
              <div className="h-full overflow-y-auto calendar-scroll-container p-6">
                <div className="space-y-6">
                  {calendarDays
                    .filter(day => day.schedules.length > 0 && day.isCurrentMonth)
                    .map((day) => (
                      <div key={day.date} className="card p-6">
                        {/* Day Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                              day.isToday 
                                ? 'bg-primary-600 text-white' 
                                : day.isWeekend 
                                ? 'bg-gray-200 text-gray-700' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {day.dayNumber}
                            </div>
                            <div>
                              <h3 className={`text-lg font-semibold ${
                                day.isToday ? 'text-primary-700' : 'text-gray-900'
                              }`}>
                                {formatDate(day.date).dayName}, {formatDate(day.date).monthName} {day.dayNumber}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {day.schedules.length} event{day.schedules.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => onCreateEvent?.(day.date)}
                            className="btn btn-sm btn-outline"
                          >
                            <Plus className="w-4 h-4" />
                            Add Event
                          </button>
                        </div>

                        {/* Compact Events Grid */}
                        <div className="grid gap-2">
                          {day.schedules
                            .sort((a, b) => {
                              if (!a.start_time || !b.start_time) return 0;
                              return a.start_time.localeCompare(b.start_time);
                            })
                            .map((schedule) => (
                              <div
                                key={schedule.id}
                                className={`p-3 rounded-lg cursor-pointer transition-all duration-150 hover:shadow-sm calendar-list-event ${getEventColorLight(schedule)} border-l-4 ${
                                  (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                                    ? getEquipmentColorVariant(getEquipmentName(schedule) as string, 'border')
                                    : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'border-purple-500' :
                                      scheduleHelpers.getEventType(schedule) === 'booking' ? 'border-blue-500' :
                                      scheduleHelpers.getEventType(schedule) === 'task' ? 'border-orange-500' :
                                      scheduleHelpers.getEventType(schedule) === 'equipment' ? 'border-emerald-500' :
                                      'border-indigo-500'
                                }`}
                                onClick={() => {
                                  setLocalSelectedEventId(schedule.id);
                                  onSelectEvent?.(schedule);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Compact Badge */}
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white ${
                                      (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                                        ? getEventColor(schedule)
                                        : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500' :
                                          scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500' :
                                          scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500' :
                                          scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500' :
                                          'bg-indigo-500'
                                    }`}>
                                      {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                                    </div>
                                    
                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-sm truncate">
                                          {schedule.title}
                                        </h4>
                                        {getEquipmentName(schedule) && (
                                          <span className="text-xs px-1.5 py-0.5 bg-white bg-opacity-60 text-gray-700 rounded font-medium">
                                            {getEquipmentName(schedule)}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-3 mt-1">
                                     <div className="flex items-center gap-1 text-xs text-gray-600">
                                       <Clock className="w-3 h-3" />
                                       <span className="font-medium">
                                         {formatTime(schedule.start_time)}
                                         {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                       </span>
                                     </div>
                                        
                                        {schedule.location && (
                                          <div className="flex items-center gap-1 text-xs text-gray-600">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate max-w-24">{schedule.location}</span>
                                          </div>
                                        )}
                                        
                                         {schedule.status !== 'scheduled' && (
                                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                            {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                                          </span>
                                       )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Compact Action Buttons */}
                                  <div className="flex items-center gap-1 ml-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditEvent?.(schedule);
                                      }}
                                      className="p-1 hover:bg-white hover:bg-opacity-60 rounded transition-colors"
                                      title="Edit event"
                                    >
                                      <Edit3 className="w-3 h-3 text-gray-600" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteEvent?.(schedule.id);
                                      }}
                                      className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                                      title="Delete event"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  
                  {/* Empty State */}
                  {calendarDays.filter(day => day.schedules.length > 0 && day.isCurrentMonth).length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No events this month</h3>
                      <p className="text-gray-500 mb-6">Create your first event to get started</p>
                      <button
                        onClick={() => onCreateEvent?.(selectedDate)}
                        className="btn btn-primary"
                      >
                        <Plus className="w-4 h-4" />
                        Create Event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Day View - List Layout */}
          {viewMode === 'day' && calendarLayout === 'list' && (
            <div className="h-full overflow-hidden" style={{ height: availableHeight }}>
              <div className="h-full overflow-y-auto calendar-scroll-container p-6">
                <div className="space-y-6">
                  {calendarDays
                    .filter(day => day.schedules.length > 0)
                    .map((day) => (
                      <div key={day.date} className="space-y-4">
                        {/* Day Header */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold ${
                              day.isToday 
                                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white' 
                                : day.isWeekend 
                                ? 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700' 
                                : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800'
                            } shadow-sm`}>
                              {day.dayNumber}
                            </div>
                            <div>
                              <h2 className={`text-2xl font-bold ${
                                day.isToday ? 'text-primary-700' : 'text-gray-900'
                              }`}>
                                {formatDate(day.date).fullDate}
                              </h2>
                              <p className="text-gray-600 font-medium">
                                {day.schedules.length} event{day.schedules.length !== 1 ? 's' : ''} scheduled
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => onCreateEvent?.(day.date)}
                            className="btn btn-primary"
                          >
                            <Plus className="w-4 h-4" />
                            Add Event
                          </button>
                        </div>

                        {/* Timeline Layout */}
                        <div className="space-y-1">
                          {day.schedules
                            .sort((a, b) => {
                              if (!a.start_time || !b.start_time) return 0;
                              return a.start_time.localeCompare(b.start_time);
                            })
                            .map((schedule, index) => (
                              <div
                                key={schedule.id}
                                className="flex items-start gap-3 p-2.5 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                onClick={() => {
                                  setLocalSelectedEventId(schedule.id);
                                  onSelectEvent?.(schedule);
                                }}
                              >
                                {/* Timeline Connector */}
                                <div className="flex flex-col items-center">
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 ${
                                    scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500 border-purple-500' :
                                    scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500 border-blue-500' :
                                    scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500 border-orange-500' :
                                    scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500 border-emerald-500' :
                                    'bg-indigo-500 border-indigo-500'
                                  } shadow-sm`} />
                                  {index < day.schedules.length - 1 && (
                                    <div className="w-0.5 h-10 bg-gray-200 mt-1" />
                                  )}
                                </div>

                                {/* Compact Event Card */}
                                <div className={`flex-1 p-2 rounded-lg ${getEventColorLight(schedule)} border-l-3 ${
                                  (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                                    ? getEquipmentColorVariant(getEquipmentName(schedule) as string, 'border')
                                    : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'border-purple-500' :
                                      scheduleHelpers.getEventType(schedule) === 'booking' ? 'border-blue-500' :
                                      scheduleHelpers.getEventType(schedule) === 'task' ? 'border-orange-500' :
                                      scheduleHelpers.getEventType(schedule) === 'equipment' ? 'border-emerald-500' :
                                      'border-indigo-500'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      {/* Event Header */}
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-3 h-3 text-gray-600" />
                                          <span className="font-bold text-gray-900 text-sm">
                                            {formatTime(schedule.start_time)}
                                            {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                          </span>
                                        </div>
                                          {getEquipmentName(schedule) && (
                                          <span className="text-xs px-1.5 py-0.5 bg-white bg-opacity-60 text-gray-700 rounded font-medium">
                                              {getEquipmentName(schedule)}
                                          </span>
                                        )}
                                        {schedule.status !== 'scheduled' && (
                                          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium">
                                            {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Event Details */}
                                      <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                                        {schedule.title}
                                      </h3>
                                      
                                      {/* Event Meta - Compact */}
                                      <div className="flex items-center gap-2 text-xs text-gray-600">
                                        {schedule.location && (
                                          <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate max-w-32">{schedule.location}</span>
                                          </div>
                                        )}
                                        {getAssignedUserName(schedule) && (
                                          <div className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            <span className="truncate max-w-24">{getAssignedUserName(schedule)}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {schedule.description && (
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-1 leading-relaxed">
                                          {schedule.description}
                                        </p>
                                      )}
                                    </div>
                                    
                                    {/* Compact Action Buttons */}
                                    <div className="flex items-center gap-1 ml-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEditEvent?.(schedule);
                                        }}
                                        className="p-1 hover:bg-white hover:bg-opacity-60 rounded transition-colors"
                                        title="Edit event"
                                      >
                                        <Edit3 className="w-3 h-3 text-gray-600" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteEvent?.(schedule.id);
                                        }}
                                        className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                                        title="Delete event"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  
                  {/* Empty State */}
                  {calendarDays.filter(day => day.schedules.length > 0).length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No events today</h3>
                      <p className="text-gray-500 mb-6">Create your first event to get started</p>
                      <button
                        onClick={() => onCreateEvent?.(selectedDate)}
                        className="btn btn-primary"
                      >
                        <Plus className="w-4 h-4" />
                        Create Event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Week View - Grid Layout */}
          {viewMode === 'week' && calendarLayout === 'grid' && (
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
                      
                      {/* Events with smart overlap handling */}
                      {renderWeekColumnEvents(day)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Week View - List Layout */}
          {viewMode === 'week' && calendarLayout === 'list' && (
            <div className="h-full overflow-hidden" style={{ height: availableHeight }}>
              <div className="h-full overflow-y-auto calendar-scroll-container p-6">
                <div className="space-y-6">
                  {/* Week Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
                        {formatDate(selectedDate).dayNumber}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          Week of {formatDate(selectedDate).monthName} {formatDate(selectedDate).dayNumber}
                        </h2>
                        <p className="text-gray-600 font-medium">
                          {schedules.length} event{schedules.length !== 1 ? 's' : ''} this week
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onCreateEvent?.(selectedDate)}
                      className="btn btn-primary"
                    >
                      <Plus className="w-4 h-4" />
                      Add Event
                    </button>
                  </div>

                  {/* Days List */}
                  {calendarDays.slice(0, 7).map((day) => (
                    <div key={day.date} className={day.schedules.length > 0 ? "space-y-4" : "hidden"}>
                      {/* Day Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                            day.isToday 
                              ? 'bg-primary-600 text-white' 
                              : day.isWeekend 
                              ? 'bg-gray-200 text-gray-700' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {day.dayNumber}
                          </div>
                          <div>
                            <h3 className={`text-lg font-semibold ${
                              day.isToday ? 'text-primary-700' : 'text-gray-900'
                            }`}>
                              {formatDate(day.date).dayName}, {formatDate(day.date).monthName} {day.dayNumber}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {day.schedules.length} event{day.schedules.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => onCreateEvent?.(day.date)}
                          className="btn btn-sm btn-ghost"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Compact Day Events */}
                      <div className="grid gap-2 ml-13">
                        {day.schedules
                          .sort((a, b) => {
                            if (!a.start_time || !b.start_time) return 0;
                            return a.start_time.localeCompare(b.start_time);
                          })
                          .map((schedule) => (
                                <div
                                  key={schedule.id}
                                className={`p-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:shadow-sm calendar-list-event ${getEventColorLight(schedule)} border-l-3 ${
                                  (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                                    ? getEquipmentColorVariant(getEquipmentName(schedule) as string, 'border')
                                    : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'border-purple-500' :
                                      scheduleHelpers.getEventType(schedule) === 'booking' ? 'border-blue-500' :
                                      scheduleHelpers.getEventType(schedule) === 'task' ? 'border-orange-500' :
                                      scheduleHelpers.getEventType(schedule) === 'equipment' ? 'border-emerald-500' :
                                      'border-indigo-500'
                              }`}
                              onClick={() => {
                                setLocalSelectedEventId(schedule.id);
                                onSelectEvent?.(schedule);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {/* Compact Badge */}
                                    <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white ${
                                      (['booking','equipment'].includes(scheduleHelpers.getEventType(schedule)) && getEquipmentName(schedule))
                                      ? getEventColor(schedule)
                                      : scheduleHelpers.getEventType(schedule) === 'meeting' ? 'bg-purple-500' :
                                        scheduleHelpers.getEventType(schedule) === 'booking' ? 'bg-blue-500' :
                                        scheduleHelpers.getEventType(schedule) === 'task' ? 'bg-orange-500' :
                                        scheduleHelpers.getEventType(schedule) === 'equipment' ? 'bg-emerald-500' :
                                        'bg-indigo-500'
                                  }`}>
                                    {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                                  </div>
                                  
                                  {/* Main Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium text-sm truncate">
                                        {schedule.title}
                                      </h4>
                                      {getEquipmentName(schedule) && (
                                        <span className="text-xs px-1.5 py-0.5 bg-white bg-opacity-60 text-gray-700 rounded font-medium">
                                          {getEquipmentName(schedule)}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <Clock className="w-3 h-3" />
                                        <span className="font-medium">
                                          {formatTime(schedule.start_time)}
                                          {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                                        </span>
                                      </div>
                                      
                                      {schedule.location && (
                                        <div className="flex items-center gap-1 text-xs text-gray-600">
                                          <MapPin className="w-3 h-3" />
                                          <span className="truncate max-w-20">{schedule.location}</span>
                                        </div>
                                      )}
                                      
                                      {schedule.status !== 'scheduled' && (
                                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Compact Action Buttons */}
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditEvent?.(schedule);
                                    }}
                                    className="p-1 hover:bg-white hover:bg-opacity-60 rounded transition-colors"
                                    title="Edit event"
                                  >
                                    <Edit3 className="w-3 h-3 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteEvent?.(schedule.id);
                                    }}
                                    className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                                    title="Delete event"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty State */}
                  {calendarDays.slice(0, 7).every(day => day.schedules.length === 0) && (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No events this week</h3>
                      <p className="text-gray-500 mb-6">Create your first event to get started</p>
                      <button
                        onClick={() => onCreateEvent?.(selectedDate)}
                        className="btn btn-primary"
                      >
                        <Plus className="w-4 h-4" />
                        Create Event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Day View - Grid Layout */}
          {viewMode === 'day' && calendarLayout === 'grid' && (
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
                
                {/* Events with enhanced layout and true side-by-side handling */}
                {(() => {
                  // 1) Prepare and de-duplicate all events for the day with pixel positions
                  const uniqueEvents: Schedule[] = schedules
                    .filter(s => s.date === selectedDate)
                    .reduce((unique: Schedule[], schedule) => {
                      const exists = unique.some(
                        existing => existing.title === schedule.title &&
                                   existing.date === schedule.date &&
                                   existing.start_time === schedule.start_time
                      );
                      if (!exists) unique.push(schedule);
                      return unique;
                    }, []);

                  const processedEvents = uniqueEvents.map((schedule, eventIndex) => {
                    const startHour = schedule.start_time ? parseInt(schedule.start_time.split(':')[0]) : 9;
                    const startMinute = schedule.start_time ? parseInt(schedule.start_time.split(':')[1]) : 0;
                    const endHour = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) : startHour + 1;
                    const endMinute = schedule.end_time ? parseInt(schedule.end_time.split(':')[1]) : 0;

                    const adjustedStartHour = startHour >= 6 ? startHour - 6 : startHour + 24 - 6;
                    const adjustedEndHour = endHour >= 6 ? endHour - 6 : endHour + 24 - 6;
                    const startPx = adjustedStartHour * hourHeightDay + (startMinute / 60) * hourHeightDay;
                    const endPx = adjustedEndHour * hourHeightDay + (endMinute / 60) * hourHeightDay;
                    const barHeight = Math.max(endPx - startPx, 90);
                    return { ...schedule, eventIndex, startPx, endPx, barHeight } as any;
                  });

                  // 2) Group overlapping events so each group can be evenly divided horizontally
                  const groups: any[][] = [];
                  const visited = new Set<number>();

                  processedEvents.forEach((evt, idx) => {
                    if (visited.has(idx)) return;
                    const group = [evt];
                    visited.add(idx);

                    for (let j = idx + 1; j < processedEvents.length; j++) {
                      if (visited.has(j)) continue;
                      const other = processedEvents[j];
                      const overlaps = group.some(e => e.startPx < other.endPx && e.endPx > other.startPx);
                      if (overlaps) {
                        group.push(other);
                        visited.add(j);
                      }
                    }
                    groups.push(group);
                  });

                  // 3) Render each group with equal widths and small gaps
                  return groups.flatMap(group => {
                    const groupWidth = Math.max(28, 96 / group.length);
                    return group.map((schedule: any, groupIndex: number) => {
                      const leftOffset = groupIndex * groupWidth;
                      return (
                        <div
                          key={schedule.id}
                          className={`absolute rounded-xl p-5 cursor-pointer text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] modern-calendar-event ${getEventColor(schedule)}`}
                          style={{
                            top: schedule.startPx,
                            height: schedule.barHeight,
                            left: `${leftOffset}%`,
                            width: `${groupWidth - 1}%`,
                            zIndex: 10 + schedule.eventIndex,
                            minWidth: 'max(110px, 18%)',
                            maxWidth: 'calc(100% - 16px)'
                          }}
                          onClick={() => {
                            setLocalSelectedEventId(schedule.id);
                            onSelectEvent?.(schedule);
                          }}
                          title={`${schedule.title} - ${formatTime(schedule.start_time)} (${scheduleHelpers.getEventType(schedule)})`}
                        >
                          <div className="h-full flex flex-col p-3 relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                              <div className="flex-shrink-0 text-xs event-type-badge rounded-full w-6 h-6 flex items-center justify-center">
                                {scheduleHelpers.getEventType(schedule).charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="event-title text-sm leading-tight truncate font-semibold">
                                  {schedule.title}
                                </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 icon flex-shrink-0" />
                    <span className="text-xs event-time truncate">
                      {formatTime(schedule.start_time)}
                      {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                    </span>
                  </div>
                              </div>
                              {schedule.location && groupWidth > 60 && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <MapPin className="w-2.5 h-2.5 icon flex-shrink-0" />
                                  <span className="text-xs event-location truncate max-w-24">
                                    {schedule.location}
                                  </span>
                                </div>
                              )}
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
                            {schedule.location && groupWidth <= 60 && schedule.barHeight > 60 && (
                              <div className="flex items-center gap-1 mb-2 flex-shrink-0">
                                <MapPin className="w-3 h-3 icon flex-shrink-0" />
                                <span className="text-xs event-location truncate">{schedule.location}</span>
                              </div>
                            )}
                            {schedule.description && schedule.barHeight > 100 && (
                              <div className="text-xs text-white opacity-80 line-clamp-2 flex-1 overflow-hidden leading-relaxed">
                                {schedule.description}
                              </div>
                            )}
                            {schedule.status !== 'scheduled' && (
                              <div className="absolute bottom-2 right-2">
                                <span className="text-xs status-badge px-2 py-1 rounded-full">
                                  {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                                </span>
                              </div>
                            )}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white bg-opacity-50 rounded-r-sm"></div>
                          </div>
                          <div className="absolute left-0 top-0 bottom-0 w-2 bg-white bg-opacity-50 rounded-r-lg"></div>
                        </div>
                      );
                    });
                  });
                })()}
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