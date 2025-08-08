# Services package for intelligent meeting management

from .meeting_generation import MeetingGenerationService
from .notification_service import NotificationService
# from .task_assignment_service import TaskAssignmentService
from .periodic_task_rotation import FairRotationService
from .calendar_sync_service import CalendarSyncService
from .google_calendar_service import GoogleCalendarService
from .quebec_holidays import QuebecHolidayService
from .fair_rotation import FairRotationAlgorithm

__all__ = [
    'MeetingGenerationService',
    'NotificationService', 
    # 'TaskAssignmentService',
    'FairRotationService',
    'CalendarSyncService',
    'GoogleCalendarService',
    'QuebecHolidayService',
    'FairRotationAlgorithm',
]
