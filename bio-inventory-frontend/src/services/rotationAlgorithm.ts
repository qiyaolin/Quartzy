import {
  User,
  QueueEntry,
  FairRotationAlgorithm,
  RotationScore,
  QuebecHoliday
} from '../types/intelligentMeeting';

/**
 * Fair Rotation Algorithm Implementation
 * Ensures equitable presenter assignments with intelligent scheduling
 * All content in English as per system requirements
 */

export class FairRotationAlgorithmImpl implements FairRotationAlgorithm {
  private readonly DEFAULT_MIN_GAP = 4; // minimum weeks between presentations
  private readonly POSTPONE_PENALTY = 20; // score penalty for postponements
  private readonly FAIRNESS_BONUS_MULTIPLIER = 10; // bonus for longer gaps

  /**
   * Calculate next presenters based on fairness algorithm
   */
  calculateNextPresenters(
    queue: QueueEntry[],
    meetingDate: string,
    requiredCount: number
  ): User[] {
    // Filter out unavailable users and calculate scores
    const availableScores = queue
      .filter(entry => this.isUserAvailable(entry, meetingDate))
      .map(entry => this.calculateRotationScore(entry, meetingDate))
      .sort((a, b) => b.score - a.score);

    // Select top candidates up to required count
    return availableScores
      .slice(0, requiredCount)
      .map(scored => scored.user);
  }

  /**
   * Update queue after presenter assignment
   */
  updateQueueAfterAssignment(
    queue: QueueEntry[],
    assignedUsers: User[],
    meetingDate: string
  ): QueueEntry[] {
    return queue.map(entry => {
      const wasAssigned = assignedUsers.find(user => user.id === entry.user.id);
      if (wasAssigned) {
        return {
          ...entry,
          lastPresentedDate: meetingDate,
          nextScheduledDate: undefined,
          postponeCount: 0, // reset postpone count on successful presentation
          priority: this.calculateBasePriority(entry, meetingDate)
        };
      }
      return {
        ...entry,
        priority: this.calculateBasePriority(entry, meetingDate)
      };
    });
  }

  /**
   * Handle postpone requests and queue adjustments
   */
  handlePostponeRequest(
    queue: QueueEntry[],
    user: User,
    originalDate: string,
    strategy: 'skip' | 'cascade'
  ): QueueEntry[] {
    return queue.map(entry => {
      if (entry.user.id === user.id) {
        return {
          ...entry,
          postponeCount: entry.postponeCount + 1,
          nextScheduledDate: strategy === 'cascade' ? this.calculateNextAvailableDate(originalDate) : undefined,
          priority: this.calculateBasePriority(entry, originalDate) - this.POSTPONE_PENALTY
        };
      }
      
      // If cascade strategy, adjust other users' priorities
      if (strategy === 'cascade') {
        return {
          ...entry,
          priority: this.calculateBasePriority(entry, originalDate)
        };
      }
      
      return entry;
    });
  }

  /**
   * Check if user is available for the meeting date
   */
  private isUserAvailable(entry: QueueEntry, meetingDate: string): boolean {
    // Check minimum gap requirement
    if (entry.lastPresentedDate) {
      const weeksSinceLastPresentation = this.calculateWeeksBetween(
        entry.lastPresentedDate,
        meetingDate
      );
      if (weeksSinceLastPresentation < this.DEFAULT_MIN_GAP) {
        return false;
      }
    }

    // Check if user is explicitly scheduled for a different date
    if (entry.nextScheduledDate && entry.nextScheduledDate !== meetingDate) {
      return false;
    }

    // User is not active
    if (!entry.user.is_active) {
      return false;
    }

    return true;
  }

  /**
   * Calculate rotation score for a user
   */
  private calculateRotationScore(entry: QueueEntry, targetDate: string): RotationScore {
    let score = 100; // base score

    // Factor 1: Time since last presentation (highest weight)
    const weeksSinceLastPresentation = entry.lastPresentedDate 
      ? this.calculateWeeksBetween(entry.lastPresentedDate, targetDate)
      : 12; // assume 12 weeks if never presented

    const timeBonus = weeksSinceLastPresentation * this.FAIRNESS_BONUS_MULTIPLIER;
    score += timeBonus;

    // Factor 2: Postpone count penalty
    const postponePenalty = entry.postponeCount * this.POSTPONE_PENALTY;
    score -= postponePenalty;

    // Factor 3: Fairness bonus for users who haven't presented in a long time
    const fairnessBonus = weeksSinceLastPresentation > 8 ? 50 : 0;
    score += fairnessBonus;

    // Factor 4: Priority adjustment from manual assignments
    score += entry.priority;

    // Ensure score doesn't go negative
    score = Math.max(score, 0);

    return {
      user: entry.user,
      score,
      factors: {
        weeksSinceLastPresentation,
        postponeCount: entry.postponeCount,
        fairnessBonus,
        availabilityScore: score
      }
    };
  }

  /**
   * Calculate base priority for queue ordering
   */
  private calculateBasePriority(entry: QueueEntry, referenceDate: string): number {
    const weeksSinceLastPresentation = entry.lastPresentedDate 
      ? this.calculateWeeksBetween(entry.lastPresentedDate, referenceDate)
      : 12;

    // Base priority increases with time since last presentation
    return Math.floor(weeksSinceLastPresentation / 2) - entry.postponeCount;
  }

  /**
   * Calculate weeks between two dates
   */
  private calculateWeeksBetween(dateString1: string, dateString2: string): number {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const timeDifference = date2.getTime() - date1.getTime();
    const daysDifference = timeDifference / (1000 * 3600 * 24);
    return Math.floor(Math.abs(daysDifference) / 7);
  }

  /**
   * Calculate next available date (for cascade postponement)
   */
  private calculateNextAvailableDate(originalDate: string): string {
    const date = new Date(originalDate);
    date.setDate(date.getDate() + 7); // Move to next week
    return date.toISOString().split('T')[0];
  }
}

/**
 * Quebec Holiday Service Implementation
 * Handles Quebec-specific holiday calculations and meeting scheduling
 */
export class QuebecHolidayService {
  private readonly FIXED_HOLIDAYS = [
    { name: "New Year's Day", date: "01-01", movable: false },
    { name: "Quebec National Holiday", date: "06-24", movable: false },
    { name: "Canada Day", date: "07-01", movable: false },
    { name: "Christmas Day", date: "12-25", movable: false },
    { name: "Boxing Day", date: "12-26", movable: false }
  ];

  /**
   * Check if a date is a Quebec holiday
   */
  isHoliday(date: Date): boolean {
    const year = date.getFullYear();
    const holidays = this.getHolidaysForYear(year);
    
    return holidays.some(holiday => {
      const holidayDate = new Date(holiday.year || year, 
        parseInt(holiday.date.split('-')[0]) - 1, 
        parseInt(holiday.date.split('-')[1]));
      return this.isSameDate(date, holidayDate);
    });
  }

  /**
   * Get next meeting date that's not a holiday
   */
  getNextMeetingDate(preferredDate: Date): Date {
    let date = new Date(preferredDate);
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (this.isHoliday(date) && attempts < maxAttempts) {
      date.setDate(date.getDate() + 7); // Move to next week (same day)
      attempts++;
    }

    return date;
  }

  /**
   * Get holidays in a date range
   */
  getHolidaysInRange(startDate: Date, endDate: Date): QuebecHoliday[] {
    const holidays: QuebecHoliday[] = [];
    const currentYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = currentYear; year <= endYear; year++) {
      const yearHolidays = this.getHolidaysForYear(year);
      holidays.push(...yearHolidays.filter(holiday => {
        const holidayDate = new Date(holiday.year || year, 
          parseInt(holiday.date.split('-')[0]) - 1, 
          parseInt(holiday.date.split('-')[1]));
        return holidayDate >= startDate && holidayDate <= endDate;
      }));
    }

    return holidays;
  }

  /**
   * Get holiday name for a specific date
   */
  getHolidayName(date: Date): string | null {
    const year = date.getFullYear();
    const holidays = this.getHolidaysForYear(year);
    
    const holiday = holidays.find(holiday => {
      const holidayDate = new Date(holiday.year || year, 
        parseInt(holiday.date.split('-')[0]) - 1, 
        parseInt(holiday.date.split('-')[1]));
      return this.isSameDate(date, holidayDate);
    });

    return holiday ? holiday.name : null;
  }

  /**
   * Get all holidays for a specific year
   */
  private getHolidaysForYear(year: number): QuebecHoliday[] {
    const holidays: QuebecHoliday[] = [];

    // Add fixed holidays
    this.FIXED_HOLIDAYS.forEach(holiday => {
      holidays.push({
        id: `${year}-${holiday.date}`,
        name: holiday.name,
        date: holiday.date,
        year,
        is_moveable: false
      });
    });

    // Add moveable holidays
    holidays.push(
      this.getGoodFriday(year),
      this.getEasterMonday(year),
      this.getVictoriaDay(year),
      this.getLabourDay(year),
      this.getThanksgiving(year)
    );

    return holidays;
  }

  /**
   * Calculate Good Friday (Friday before Easter)
   */
  private getGoodFriday(year: number): QuebecHoliday {
    const easter = this.calculateEaster(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);

    return {
      id: `${year}-good-friday`,
      name: "Good Friday",
      date: `${String(goodFriday.getMonth() + 1).padStart(2, '0')}-${String(goodFriday.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  }

  /**
   * Calculate Easter Monday (Monday after Easter)
   */
  private getEasterMonday(year: number): QuebecHoliday {
    const easter = this.calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    return {
      id: `${year}-easter-monday`,
      name: "Easter Monday",
      date: `${String(easterMonday.getMonth() + 1).padStart(2, '0')}-${String(easterMonday.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  }

  /**
   * Calculate Victoria Day (Monday preceding May 25)
   */
  private getVictoriaDay(year: number): QuebecHoliday {
    const may25 = new Date(year, 4, 25); // May 25
    const dayOfWeek = may25.getDay();
    const mondayOffset = dayOfWeek === 1 ? 0 : 7 - dayOfWeek + 1;
    const victoriaDay = new Date(may25);
    victoriaDay.setDate(25 - (7 - mondayOffset));

    return {
      id: `${year}-victoria-day`,
      name: "Victoria Day",
      date: `${String(victoriaDay.getMonth() + 1).padStart(2, '0')}-${String(victoriaDay.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  }

  /**
   * Calculate Labour Day (first Monday in September)
   */
  private getLabourDay(year: number): QuebecHoliday {
    const september1 = new Date(year, 8, 1); // September 1
    const dayOfWeek = september1.getDay();
    const mondayOffset = dayOfWeek === 1 ? 0 : 7 - dayOfWeek + 1;
    const labourDay = new Date(september1);
    labourDay.setDate(1 + mondayOffset);

    return {
      id: `${year}-labour-day`,
      name: "Labour Day",
      date: `${String(labourDay.getMonth() + 1).padStart(2, '0')}-${String(labourDay.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  }

  /**
   * Calculate Thanksgiving (second Monday in October)
   */
  private getThanksgiving(year: number): QuebecHoliday {
    const october1 = new Date(year, 9, 1); // October 1
    const dayOfWeek = october1.getDay();
    const mondayOffset = dayOfWeek === 1 ? 0 : 7 - dayOfWeek + 1;
    const firstMonday = new Date(october1);
    firstMonday.setDate(1 + mondayOffset);
    const thanksgiving = new Date(firstMonday);
    thanksgiving.setDate(firstMonday.getDate() + 7); // Second Monday

    return {
      id: `${year}-thanksgiving`,
      name: "Thanksgiving",
      date: `${String(thanksgiving.getMonth() + 1).padStart(2, '0')}-${String(thanksgiving.getDate()).padStart(2, '0')}`,
      year,
      is_moveable: true
    };
  }

  /**
   * Calculate Easter date using the algorithm
   */
  private calculateEaster(year: number): Date {
    // Using the Anonymous Gregorian algorithm
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
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}

/**
 * Meeting Generation Service
 * Handles automatic meeting generation with intelligent scheduling
 */
export class MeetingGenerationService {
  private holidayService: QuebecHolidayService;
  private rotationAlgorithm: FairRotationAlgorithmImpl;

  constructor() {
    this.holidayService = new QuebecHolidayService();
    this.rotationAlgorithm = new FairRotationAlgorithmImpl();
  }

  /**
   * Generate meetings for a date range with alternating RU/JC pattern
   */
  generateMeetingsForRange(
    startDate: string,
    endDate: string,
    dayOfWeek: number,
    startTime: string,
    location: string,
    skipHolidays: boolean = true
  ): Array<{
    date: string;
    type: 'Research Update' | 'Journal Club';
    startTime: string;
    location: string;
    duration: number;
  }> {
    const meetings = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Adjust start date to the correct day of week
    const daysToAdd = (dayOfWeek - start.getDay() + 7) % 7;
    start.setDate(start.getDate() + daysToAdd);

    let current = new Date(start);
    let isResearchUpdate = true; // Alternate between RU and JC
    let weekCount = 0;

    while (current <= end) {
      // Skip holidays if requested
      if (skipHolidays && this.holidayService.isHoliday(current)) {
        current.setDate(current.getDate() + 7);
        continue;
      }

      const meetingType = isResearchUpdate ? 'Research Update' : 'Journal Club';
      const duration = isResearchUpdate ? 120 : 60; // 2 hours for RU, 1 hour for JC

      meetings.push({
        date: current.toISOString().split('T')[0],
        type: meetingType,
        startTime,
        location,
        duration
      });

      // Alternate meeting type
      isResearchUpdate = !isResearchUpdate;
      
      // Move to next week
      current.setDate(current.getDate() + 7);
      weekCount++;
    }

    return meetings;
  }

  /**
   * Generate presenter assignments for generated meetings
   */
  assignPresentersToMeetings(
    meetings: Array<{ date: string; type: string }>,
    queue: QueueEntry[]
  ): Array<{
    date: string;
    type: string;
    presenters: User[];
  }> {
    let currentQueue = [...queue];
    
    return meetings.map(meeting => {
      const requiredCount = meeting.type === 'Research Update' ? 2 : 1; // 2 for RU, 1 for JC
      const presenters = this.rotationAlgorithm.calculateNextPresenters(
        currentQueue,
        meeting.date,
        requiredCount
      );

      // Update queue after assignment
      currentQueue = this.rotationAlgorithm.updateQueueAfterAssignment(
        currentQueue,
        presenters,
        meeting.date
      );

      return {
        date: meeting.date,
        type: meeting.type,
        presenters
      };
    });
  }

  /**
   * Validate meeting generation settings
   */
  validateGenerationSettings(settings: {
    startDate: string;
    endDate: string;
    dayOfWeek: number;
    activeMembers: User[];
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Date validation
    const start = new Date(settings.startDate);
    const end = new Date(settings.endDate);
    
    if (start >= end) {
      errors.push('End date must be after start date');
    }

    // Day of week validation
    if (settings.dayOfWeek < 0 || settings.dayOfWeek > 6) {
      errors.push('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Active members validation
    if (settings.activeMembers.length < 2) {
      errors.push('At least 2 active members are required for rotation');
    }

    // Time range validation (warn if too long)
    const timeDiff = end.getTime() - start.getTime();
    const weeksDiff = timeDiff / (1000 * 3600 * 24 * 7);
    if (weeksDiff > 52) {
      errors.push('Warning: Generating meetings for more than 1 year may create scheduling conflicts');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export services for use in components
export const fairRotationAlgorithm = new FairRotationAlgorithmImpl();
export const quebecHolidayService = new QuebecHolidayService();
export const meetingGenerationService = new MeetingGenerationService();