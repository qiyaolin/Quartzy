"""
Quebec Holiday Service
Handles Quebec provincial holidays and determines meeting availability
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional
import calendar


class QuebecHolidayService:
    """Service for managing Quebec provincial holidays"""
    
    # Fixed holidays (month-day format)
    FIXED_HOLIDAYS = [
        ("01-01", "New Year's Day"),
        ("06-24", "Quebec National Holiday"),
        ("07-01", "Canada Day"),
        ("12-25", "Christmas Day"),
        ("12-26", "Boxing Day"),
    ]
    
    def __init__(self):
        self.holidays_cache = {}
    
    def get_holidays_for_year(self, year: int) -> List[Dict[str, str]]:
        """Get all Quebec holidays for a specific year"""
        if year in self.holidays_cache:
            return self.holidays_cache[year]
        
        holidays = []
        
        # Add fixed holidays
        for date_str, name in self.FIXED_HOLIDAYS:
            month, day = map(int, date_str.split('-'))
            holiday_date = date(year, month, day)
            
            # Move to Monday if falls on weekend
            if holiday_date.weekday() >= 5:  # Saturday or Sunday
                days_to_add = 7 - holiday_date.weekday() + 1  # Move to next Monday
                holiday_date = holiday_date + timedelta(days=days_to_add)
            
            holidays.append({
                'date': holiday_date.strftime('%Y-%m-%d'),
                'name': name,
                'type': 'fixed'
            })
        
        # Add moveable holidays
        holidays.extend(self._get_moveable_holidays(year))
        
        # Sort by date
        holidays.sort(key=lambda x: x['date'])
        
        # Cache the result
        self.holidays_cache[year] = holidays
        return holidays
    
    def _get_moveable_holidays(self, year: int) -> List[Dict[str, str]]:
        """Calculate moveable holidays for the year"""
        holidays = []
        
        # Easter-based holidays
        easter_date = self._calculate_easter(year)
        
        # Good Friday (2 days before Easter)
        good_friday = easter_date - timedelta(days=2)
        holidays.append({
            'date': good_friday.strftime('%Y-%m-%d'),
            'name': 'Good Friday',
            'type': 'moveable'
        })
        
        # Easter Monday (1 day after Easter)
        easter_monday = easter_date + timedelta(days=1)
        holidays.append({
            'date': easter_monday.strftime('%Y-%m-%d'),
            'name': 'Easter Monday',
            'type': 'moveable'
        })
        
        # Victoria Day (last Monday before May 25)
        victoria_day = self._get_last_monday_before(year, 5, 25)
        holidays.append({
            'date': victoria_day.strftime('%Y-%m-%d'),
            'name': 'Victoria Day',
            'type': 'moveable'
        })
        
        # Labour Day (first Monday in September)
        labour_day = self._get_nth_weekday(year, 9, 0, 1)  # 0 = Monday, 1st occurrence
        holidays.append({
            'date': labour_day.strftime('%Y-%m-%d'),
            'name': 'Labour Day',
            'type': 'moveable'
        })
        
        # Thanksgiving (second Monday in October)
        thanksgiving = self._get_nth_weekday(year, 10, 0, 2)  # 0 = Monday, 2nd occurrence
        holidays.append({
            'date': thanksgiving.strftime('%Y-%m-%d'),
            'name': 'Thanksgiving',
            'type': 'moveable'
        })
        
        return holidays
    
    def _calculate_easter(self, year: int) -> date:
        """Calculate Easter date using the algorithm"""
        # This is a simplified Easter calculation
        # For production, consider using a library like dateutil
        a = year % 19
        b = year // 100
        c = year % 100
        d = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        n = (h + l - 7 * m + 114) // 31
        p = (h + l - 7 * m + 114) % 31
        return date(year, n, p + 1)
    
    def _get_last_monday_before(self, year: int, month: int, day: int) -> date:
        """Get the last Monday before a specific date"""
        target_date = date(year, month, day)
        days_back = (target_date.weekday() + 7) % 7  # Days to go back to Monday
        if days_back == 0:  # If it's already Monday
            days_back = 7
        return target_date - timedelta(days=days_back)
    
    def _get_nth_weekday(self, year: int, month: int, weekday: int, n: int) -> date:
        """Get the nth occurrence of a weekday in a month"""
        # weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday
        # n: 1=first, 2=second, etc.
        first_day = date(year, month, 1)
        first_weekday = first_day.weekday()
        
        # Calculate days to add to get to the first occurrence of the desired weekday
        days_to_first = (weekday - first_weekday) % 7
        first_occurrence = first_day + timedelta(days=days_to_first)
        
        # Add weeks to get to the nth occurrence
        nth_occurrence = first_occurrence + timedelta(weeks=n-1)
        
        return nth_occurrence
    
    def is_holiday(self, check_date: date) -> bool:
        """Check if a given date is a Quebec holiday"""
        holidays = self.get_holidays_for_year(check_date.year)
        date_str = check_date.strftime('%Y-%m-%d')
        return any(holiday['date'] == date_str for holiday in holidays)
    
    def get_holiday_name(self, check_date: date) -> Optional[str]:
        """Get the name of the holiday for a given date"""
        holidays = self.get_holidays_for_year(check_date.year)
        date_str = check_date.strftime('%Y-%m-%d')
        for holiday in holidays:
            if holiday['date'] == date_str:
                return holiday['name']
        return None
    
    def get_next_meeting_date(self, preferred_date: date, weekday: int = 1) -> date:
        """
        Get the next available meeting date (skipping holidays)
        weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday (default is Tuesday)
        """
        current_date = preferred_date
        
        # Ensure we start with the preferred weekday
        days_ahead = weekday - current_date.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        current_date = current_date + timedelta(days_ahead)
        
        # Keep checking until we find a non-holiday
        while self.is_holiday(current_date):
            current_date = current_date + timedelta(days=7)  # Move to next week
        
        return current_date
    
    def get_meeting_dates_in_range(self, start_date: date, end_date: date, weekday: int = 1) -> List[date]:
        """
        Get all possible meeting dates in a range (excluding holidays)
        weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday (default is Tuesday)
        """
        meeting_dates = []
        current_date = self.get_next_meeting_date(start_date, weekday)
        
        while current_date <= end_date:
            meeting_dates.append(current_date)
            # Move to next week
            next_date = current_date + timedelta(days=7)
            current_date = self.get_next_meeting_date(next_date - timedelta(days=1), weekday)
        
        return meeting_dates
    
    def is_academic_break(self, check_date: date) -> bool:
        """Check if date falls during typical academic breaks"""
        month = check_date.month
        day = check_date.day
        
        # Christmas break (mid-December to early January)
        if month == 12 and day >= 15:
            return True
        if month == 1 and day <= 7:
            return True
        
        # Summer break (July and August)
        if month in [7, 8]:
            return True
        
        # Spring break (varies, but typically around Easter)
        easter_date = self._calculate_easter(check_date.year)
        easter_week_start = easter_date - timedelta(days=easter_date.weekday())
        easter_week_end = easter_week_start + timedelta(days=6)
        
        if easter_week_start <= check_date <= easter_week_end:
            return True
        
        return False