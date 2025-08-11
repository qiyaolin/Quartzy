import React, { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';
import { clsx } from 'clsx';
import '../calendar.css';

export interface MonthCalendarProps {
  initialDate?: Date;
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
  className?: string;
}

const WEEKDAY_LABELS_SUN_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  initialDate,
  weekStartsOn = 1,
  className,
}) => {
  const [cursor, setCursor] = useState<Date>(initialDate ?? new Date());
  const today = useMemo(() => new Date(), []);

  const startOfCurrentMonth = startOfMonth(cursor);
  const endOfCurrentMonth = endOfMonth(cursor);

  const weekStartIndex = weekStartsOn === 1 ? 1 : 0;
  const gridStart = startOfWeek(startOfCurrentMonth, { weekStartsOn: weekStartIndex });
  const gridEnd = endOfWeek(endOfCurrentMonth, { weekStartsOn: weekStartIndex });

  const days: Date[] = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }

  const monthTitle = format(cursor, 'MMMM yyyy');
  const weekdayLabels = weekStartsOn === 1 ? WEEKDAY_LABELS_MON_FIRST : WEEKDAY_LABELS_SUN_FIRST;

  return (
    <div className={clsx('cal-wrapper', className)}>
      <div className="cal-header">
        <div className="cal-title">{monthTitle}</div>
        <div className="cal-actions">
          <button className="cal-btn" onClick={() => setCursor(subMonths(cursor, 1))} aria-label="Previous month">
            ◀
          </button>
          <button className="cal-btn cal-btn-primary" onClick={() => setCursor(new Date())} aria-label="Go to today">
            Today
          </button>
          <button className="cal-btn" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
            ▶
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {weekdayLabels.map((label) => (
          <div key={label} className="cal-weekday" aria-hidden>
            {label}
          </div>
        ))}

        {days.map((date) => {
          const muted = !isSameMonth(date, cursor);
          const isToday = isSameDay(date, today);
          return (
            <div key={date.toISOString()} className={clsx('cal-cell', { 'is-muted': muted, today: isToday })}>
              <div className="cal-date-badge">{format(date, 'd')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;


