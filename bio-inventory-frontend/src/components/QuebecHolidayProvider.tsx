import React, { createContext, useContext, useState, useEffect } from 'react';
import { QuebecHoliday } from '../types/intelligentMeeting';
import { quebecHolidayService } from '../services/rotationAlgorithm';

/**
 * Quebec Holiday Provider Component
 * Provides Quebec holiday information and date validation throughout the app
 * All content in English as per system requirements
 */

interface QuebecHolidayContextType {
  holidays: QuebecHoliday[];
  isHoliday: (date: Date) => boolean;
  getHolidayName: (date: Date) => string | null;
  getNextMeetingDate: (preferredDate: Date) => Date;
  getHolidaysInRange: (startDate: Date, endDate: Date) => QuebecHoliday[];
  loading: boolean;
  error: string | null;
  refreshHolidays: (year?: number) => void;
}

const QuebecHolidayContext = createContext<QuebecHolidayContextType | undefined>(undefined);

interface QuebecHolidayProviderProps {
  children: React.ReactNode;
  initialYear?: number;
}

export const QuebecHolidayProvider: React.FC<QuebecHolidayProviderProps> = ({
  children,
  initialYear = new Date().getFullYear()
}) => {
  const [holidays, setHolidays] = useState<QuebecHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(initialYear);

  // Load holidays for the current year
  useEffect(() => {
    loadHolidays(currentYear);
  }, [currentYear]);

  const loadHolidays = async (year: number) => {
    try {
      setLoading(true);
      setError(null);

      // Load holidays for current year and next year to handle year transitions
      const currentYearHolidays = getHolidaysForYear(year);
      const nextYearHolidays = getHolidaysForYear(year + 1);
      
      const allHolidays = [...currentYearHolidays, ...nextYearHolidays];
      setHolidays(allHolidays);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holidays');
      console.error('Error loading Quebec holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate holidays for a specific year
  const getHolidaysForYear = (year: number): QuebecHoliday[] => {
    const holidays: QuebecHoliday[] = [];

    // Fixed holidays
    const fixedHolidays = [
      { name: "New Year's Day", date: "01-01" },
      { name: "Quebec National Holiday", date: "06-24" },
      { name: "Canada Day", date: "07-01" },
      { name: "Christmas Day", date: "12-25" },
      { name: "Boxing Day", date: "12-26" }
    ];

    fixedHolidays.forEach(holiday => {
      holidays.push({
        id: `${year}-${holiday.date}`,
        name: holiday.name,
        date: holiday.date,
        year,
        is_moveable: false
      });
    });

    // Moveable holidays
    holidays.push(
      calculateGoodFriday(year),
      calculateEasterMonday(year),
      calculateVictoriaDay(year),
      calculateLabourDay(year),
      calculateThanksgiving(year)
    );

    return holidays;
  };

  // Calculate Good Friday (Friday before Easter)
  const calculateGoodFriday = (year: number): QuebecHoliday => {
    const easter = calculateEaster(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);

    return {
      id: `${year}-good-friday`,
      name: "Good Friday",
      date: `${String(goodFriday.getMonth() + 1).padStart(2, '0')}-${String(goodFriday.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  };

  // Calculate Easter Monday (Monday after Easter)
  const calculateEasterMonday = (year: number): QuebecHoliday => {
    const easter = calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    return {
      id: `${year}-easter-monday`,
      name: "Easter Monday",
      date: `${String(easterMonday.getMonth() + 1).padStart(2, '0')}-${String(easterMonday.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  };

  // Calculate Victoria Day (Monday preceding May 25)
  const calculateVictoriaDay = (year: number): QuebecHoliday => {
    const may25 = new Date(year, 4, 25); // May 25
    const dayOfWeek = may25.getDay();
    let victoriaDay = new Date(may25);

    // Find the Monday on or before May 25
    if (dayOfWeek === 1) {
      // May 25 is already a Monday
      victoriaDay = may25;
    } else {
      // Calculate days to subtract to get to the previous Monday
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      victoriaDay.setDate(25 - daysToSubtract);
    }

    return {
      id: `${year}-victoria-day`,
      name: "Victoria Day",
      date: `${String(victoriaDay.getMonth() + 1).padStart(2, '0')}-${String(victoriaDay.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  };

  // Calculate Labour Day (first Monday in September)
  const calculateLabourDay = (year: number): QuebecHoliday => {
    const september1 = new Date(year, 8, 1); // September 1
    const dayOfWeek = september1.getDay();
    const labourDay = new Date(september1);

    // Calculate days to add to get to the first Monday
    const daysToAdd = dayOfWeek === 1 ? 0 : (7 - dayOfWeek + 1) % 7;
    labourDay.setDate(1 + daysToAdd);

    return {
      id: `${year}-labour-day`,
      name: "Labour Day",
      date: `${String(labourDay.getMonth() + 1).padStart(2, '0')}-${String(labourDay.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  };

  // Calculate Thanksgiving (second Monday in October)
  const calculateThanksgiving = (year: number): QuebecHoliday => {
    const october1 = new Date(year, 9, 1); // October 1
    const dayOfWeek = october1.getDay();
    const firstMonday = new Date(october1);

    // Calculate days to add to get to the first Monday
    const daysToFirstMonday = dayOfWeek === 1 ? 0 : (7 - dayOfWeek + 1) % 7;
    firstMonday.setDate(1 + daysToFirstMonday);

    // Second Monday is 7 days later
    const thanksgiving = new Date(firstMonday);
    thanksgiving.setDate(firstMonday.getDate() + 7);

    return {
      id: `${year}-thanksgiving`,
      name: "Thanksgiving",
      date: `${String(thanksgiving.getMonth() + 1).padStart(2, '0')}-${String(thanksgiving.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  };

  // Calculate Easter date using the Anonymous Gregorian algorithm
  const calculateEaster = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
  };

  // Check if a date is a Quebec holiday
  const isHoliday = (date: Date): boolean => {
    return quebecHolidayService.isHoliday(date);
  };

  // Get holiday name for a specific date
  const getHolidayName = (date: Date): string | null => {
    return quebecHolidayService.getHolidayName(date);
  };

  // Get next available meeting date (skipping holidays)
  const getNextMeetingDate = (preferredDate: Date): Date => {
    return quebecHolidayService.getNextMeetingDate(preferredDate);
  };

  // Get holidays in a date range
  const getHolidaysInRange = (startDate: Date, endDate: Date): QuebecHoliday[] => {
    return quebecHolidayService.getHolidaysInRange(startDate, endDate);
  };

  // Refresh holidays for a specific year
  const refreshHolidays = (year?: number) => {
    const targetYear = year || new Date().getFullYear();
    setCurrentYear(targetYear);
  };

  const contextValue: QuebecHolidayContextType = {
    holidays,
    isHoliday,
    getHolidayName,
    getNextMeetingDate,
    getHolidaysInRange,
    loading,
    error,
    refreshHolidays
  };

  return (
    <QuebecHolidayContext.Provider value={contextValue}>
      {children}
    </QuebecHolidayContext.Provider>
  );
};

// Custom hook to use Quebec Holiday context
export const useQuebecHolidays = (): QuebecHolidayContextType => {
  const context = useContext(QuebecHolidayContext);
  if (context === undefined) {
    throw new Error('useQuebecHolidays must be used within a QuebecHolidayProvider');
  }
  return context;
};

// Holiday display component
interface HolidayIndicatorProps {
  date: Date;
  showName?: boolean;
  className?: string;
}

export const HolidayIndicator: React.FC<HolidayIndicatorProps> = ({
  date,
  showName = false,
  className = ''
}) => {
  const { isHoliday, getHolidayName } = useQuebecHolidays();

  if (!isHoliday(date)) {
    return null;
  }

  const holidayName = getHolidayName(date);

  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
      {showName && holidayName && (
        <span className="text-xs text-red-600 font-medium">{holidayName}</span>
      )}
    </div>
  );
};

// Date picker component with holiday awareness
interface HolidayAwareDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  skipHolidays?: boolean;
  highlightHolidays?: boolean;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export const HolidayAwareDatePicker: React.FC<HolidayAwareDatePickerProps> = ({
  value,
  onChange,
  skipHolidays = false,
  highlightHolidays = true,
  className = '',
  disabled = false,
  min,
  max
}) => {
  const { isHoliday, getNextMeetingDate, getHolidayName } = useQuebecHolidays();
  const [selectedDate, setSelectedDate] = useState(value);

  const handleDateChange = (dateString: string) => {
    const selectedDate = new Date(dateString);
    
    if (skipHolidays && isHoliday(selectedDate)) {
      // Find next non-holiday date
      const nextAvailableDate = getNextMeetingDate(selectedDate);
      const nextDateString = nextAvailableDate.toISOString().split('T')[0];
      setSelectedDate(nextDateString);
      onChange(nextDateString);
    } else {
      setSelectedDate(dateString);
      onChange(dateString);
    }
  };

  const selectedDateObj = new Date(selectedDate);
  const isSelectedHoliday = isHoliday(selectedDateObj);
  const holidayName = isSelectedHoliday ? getHolidayName(selectedDateObj) : null;

  return (
    <div className="space-y-2">
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => handleDateChange(e.target.value)}
        className={`${className} ${isSelectedHoliday && highlightHolidays ? 'border-red-300 bg-red-50' : ''}`}
        disabled={disabled}
        min={min}
        max={max}
      />
      
      {isSelectedHoliday && highlightHolidays && (
        <div className="flex items-center text-sm text-red-600">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
          <span>
            {holidayName} - {skipHolidays ? 'Date will be adjusted' : 'Quebec holiday'}
          </span>
        </div>
      )}
    </div>
  );
};

// Holiday calendar component
interface HolidayCalendarProps {
  year?: number;
  className?: string;
  onHolidayClick?: (holiday: QuebecHoliday) => void;
}

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  year = new Date().getFullYear(),
  className = '',
  onHolidayClick
}) => {
  const { holidays, loading, error } = useQuebecHolidays();

  const yearHolidays = holidays.filter(h => h.year === year);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="text-sm">Failed to load holidays: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Quebec Holidays {year}</h3>
        <div className="flex items-center text-sm text-gray-500">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
          <span>{yearHolidays.length} holidays</span>
        </div>
      </div>

      <div className="space-y-2">
        {yearHolidays.length === 0 ? (
          <p className="text-gray-500 text-sm">No holidays found for {year}</p>
        ) : (
          yearHolidays
            .sort((a, b) => {
              const dateA = new Date(`${a.year}-${a.date}`);
              const dateB = new Date(`${b.year}-${b.date}`);
              return dateA.getTime() - dateB.getTime();
            })
            .map((holiday) => {
              const holidayDate = new Date(`${holiday.year}-${holiday.date}`);
              return (
                <div
                  key={holiday.id}
                  className={`flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors ${
                    onHolidayClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onHolidayClick?.(holiday)}
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{holiday.name}</p>
                      <p className="text-xs text-gray-500">
                        {holidayDate.toLocaleDateString('en-CA', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  {holiday.is_moveable && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                      Moveable
                    </span>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default QuebecHolidayProvider;