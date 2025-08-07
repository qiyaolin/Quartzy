"""
Calendar synchronization service for bidirectional sync with Google Calendar
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .google_calendar_service import GoogleCalendarService
from ..models import (
    Event, MeetingInstance, PeriodicTaskInstance, 
    CalendarSyncRecord
)

logger = logging.getLogger(__name__)


class CalendarSyncService:
    """Service for synchronizing schedule data with Google Calendar"""
    
    def __init__(self, google_calendar_service: GoogleCalendarService = None):
        """
        Initialize sync service
        
        Args:
            google_calendar_service: Google Calendar service instance
        """
        self.gcal_service = google_calendar_service or GoogleCalendarService()
        
    def sync_event_to_google(self, event: Event, force_update: bool = False) -> bool:
        """
        Sync a single Event to Google Calendar
        
        Args:
            event: Event instance to sync
            force_update: Force update even if already synced
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if already synced
            sync_record, created = CalendarSyncRecord.objects.get_or_create(
                content_type__model='event',
                object_id=event.id,
                defaults={
                    'content_object': event,
                    'sync_enabled': True
                }
            )
            
            if not sync_record.sync_enabled and not force_update:
                logger.info(f"Sync disabled for event {event.id}")
                return True
            
            # Format event for Google Calendar
            event_data = GoogleCalendarService.format_event_for_google_calendar(event)
            
            if sync_record.google_event_id and not created:
                # Update existing event
                success = self.gcal_service.update_event(sync_record.google_event_id, event_data)
                if success:
                    sync_record.last_synced_at = timezone.now()
                    sync_record.sync_status = 'success'
                    sync_record.error_message = None
                    sync_record.save()
                else:
                    sync_record.sync_status = 'error'
                    sync_record.error_message = 'Failed to update Google Calendar event'
                    sync_record.save()
            else:
                # Create new event
                google_event_id = self.gcal_service.create_event(event_data)
                if google_event_id:
                    sync_record.google_event_id = google_event_id
                    sync_record.last_synced_at = timezone.now()
                    sync_record.sync_status = 'success'
                    sync_record.error_message = None
                    sync_record.save()
                    success = True
                else:
                    sync_record.sync_status = 'error'
                    sync_record.error_message = 'Failed to create Google Calendar event'
                    sync_record.save()
                    success = False
                    
            return success
            
        except Exception as e:
            logger.error(f"Error syncing event {event.id} to Google Calendar: {e}")
            return False
    
    def sync_meeting_to_google(self, meeting: MeetingInstance, force_update: bool = False) -> bool:
        """
        Sync a MeetingInstance to Google Calendar
        
        Args:
            meeting: MeetingInstance to sync
            force_update: Force update even if already synced
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if already synced
            sync_record, created = CalendarSyncRecord.objects.get_or_create(
                content_type__model='meetinginstance',
                object_id=meeting.id,
                defaults={
                    'content_object': meeting,
                    'sync_enabled': True
                }
            )
            
            if not sync_record.sync_enabled and not force_update:
                logger.info(f"Sync disabled for meeting {meeting.id}")
                return True
            
            # Format meeting for Google Calendar
            event_data = GoogleCalendarService.format_meeting_for_google_calendar(meeting)
            
            if sync_record.google_event_id and not created:
                # Update existing event
                success = self.gcal_service.update_event(sync_record.google_event_id, event_data)
                if success:
                    sync_record.last_synced_at = timezone.now()
                    sync_record.sync_status = 'success'
                    sync_record.error_message = None
                    sync_record.save()
                else:
                    sync_record.sync_status = 'error'
                    sync_record.error_message = 'Failed to update Google Calendar event'
                    sync_record.save()
            else:
                # Create new event
                google_event_id = self.gcal_service.create_event(event_data)
                if google_event_id:
                    sync_record.google_event_id = google_event_id
                    sync_record.last_synced_at = timezone.now()
                    sync_record.sync_status = 'success'
                    sync_record.error_message = None
                    sync_record.save()
                    success = True
                else:
                    sync_record.sync_status = 'error'
                    sync_record.error_message = 'Failed to create Google Calendar event'
                    sync_record.save()
                    success = False
                    
            return success
            
        except Exception as e:
            logger.error(f"Error syncing meeting {meeting.id} to Google Calendar: {e}")
            return False
    
    def sync_task_to_google(self, task: PeriodicTaskInstance, force_update: bool = False) -> bool:
        """
        Sync a PeriodicTaskInstance to Google Calendar
        
        Args:
            task: PeriodicTaskInstance to sync
            force_update: Force update even if already synced
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if already synced
            sync_record, created = CalendarSyncRecord.objects.get_or_create(
                content_type__model='periodictaskinstance',
                object_id=task.id,
                defaults={
                    'content_object': task,
                    'sync_enabled': True
                }
            )
            
            if not sync_record.sync_enabled and not force_update:
                logger.info(f"Sync disabled for task {task.id}")
                return True
            
            # Format task for Google Calendar
            event_data = GoogleCalendarService.format_task_for_google_calendar(task)
            
            if sync_record.google_event_id and not created:
                # Update existing event
                success = self.gcal_service.update_event(sync_record.google_event_id, event_data)
                if success:
                    sync_record.last_synced_at = timezone.now()
                    sync_record.sync_status = 'success'
                    sync_record.error_message = None
                    sync_record.save()
                else:
                    sync_record.sync_status = 'error'
                    sync_record.error_message = 'Failed to update Google Calendar event'
                    sync_record.save()
            else:
                # Create new event
                google_event_id = self.gcal_service.create_event(event_data)
                if google_event_id:
                    sync_record.google_event_id = google_event_id
                    sync_record.last_synced_at = timezone.now()
                    sync_record.sync_status = 'success'
                    sync_record.error_message = None
                    sync_record.save()
                    success = True
                else:
                    sync_record.sync_status = 'error'
                    sync_record.error_message = 'Failed to create Google Calendar event'
                    sync_record.save()
                    success = False
                    
            return success
            
        except Exception as e:
            logger.error(f"Error syncing task {task.id} to Google Calendar: {e}")
            return False
    
    def delete_from_google(self, sync_record: 'CalendarSyncRecord') -> bool:
        """
        Delete event from Google Calendar
        
        Args:
            sync_record: CalendarSyncRecord instance
            
        Returns:
            True if successful, False otherwise
        """
        if not sync_record.google_event_id:
            return True
            
        success = self.gcal_service.delete_event(sync_record.google_event_id)
        if success:
            sync_record.delete()
        else:
            sync_record.sync_status = 'error'
            sync_record.error_message = 'Failed to delete Google Calendar event'
            sync_record.save()
            
        return success
    
    def sync_all_events(self, start_date: datetime = None, end_date: datetime = None) -> Dict[str, int]:
        """
        Sync all events in date range to Google Calendar
        
        Args:
            start_date: Start date for sync (defaults to today)
            end_date: End date for sync (defaults to 3 months from start)
            
        Returns:
            Dictionary with sync statistics
        """
        if start_date is None:
            start_date = timezone.now().date()
        if end_date is None:
            end_date = start_date + timedelta(days=90)
        
        stats = {
            'events_synced': 0,
            'meetings_synced': 0,
            'tasks_synced': 0,
            'errors': 0
        }
        
        # Sync Events
        events = Event.objects.filter(
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        )
        
        for event in events:
            if self.sync_event_to_google(event):
                stats['events_synced'] += 1
            else:
                stats['errors'] += 1
        
        # Sync MeetingInstances
        meetings = MeetingInstance.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        )
        
        for meeting in meetings:
            if self.sync_meeting_to_google(meeting):
                stats['meetings_synced'] += 1
            else:
                stats['errors'] += 1
        
        # Sync PeriodicTaskInstances  
        tasks = PeriodicTaskInstance.objects.filter(
            execution_end_date__gte=start_date,
            execution_end_date__lte=end_date
        )
        
        for task in tasks:
            if self.sync_task_to_google(task):
                stats['tasks_synced'] += 1
            else:
                stats['errors'] += 1
        
        logger.info(f"Sync completed: {stats}")
        return stats
    
    def cleanup_orphaned_events(self) -> int:
        """
        Remove Google Calendar events that no longer have corresponding local objects
        
        Returns:
            Number of events cleaned up
        """
        cleanup_count = 0
        
        # Get all sync records
        sync_records = CalendarSyncRecord.objects.filter(
            google_event_id__isnull=False
        )
        
        for record in sync_records:
            # Check if local object still exists
            if not record.content_object:
                # Local object was deleted, remove from Google Calendar
                if self.gcal_service.delete_event(record.google_event_id):
                    record.delete()
                    cleanup_count += 1
                    logger.info(f"Cleaned up orphaned Google Calendar event: {record.google_event_id}")
        
        return cleanup_count
    
    def get_sync_status(self, start_date: datetime = None, days: int = 30) -> Dict:
        """
        Get synchronization status report
        
        Args:
            start_date: Start date for report
            days: Number of days to include in report
            
        Returns:
            Dictionary with sync status information
        """
        if start_date is None:
            start_date = timezone.now().date()
        end_date = start_date + timedelta(days=days)
        
        # Count events in date range
        events_count = Event.objects.filter(
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        ).count()
        
        meetings_count = MeetingInstance.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).count()
        
        tasks_count = PeriodicTaskInstance.objects.filter(
            execution_end_date__gte=start_date,
            execution_end_date__lte=end_date
        ).count()
        
        # Count synced events
        synced_events = CalendarSyncRecord.objects.filter(
            content_type__model='event',
            sync_status='success',
            google_event_id__isnull=False
        ).count()
        
        synced_meetings = CalendarSyncRecord.objects.filter(
            content_type__model='meetinginstance',
            sync_status='success',
            google_event_id__isnull=False
        ).count()
        
        synced_tasks = CalendarSyncRecord.objects.filter(
            content_type__model='periodictaskinstance',
            sync_status='success',
            google_event_id__isnull=False
        ).count()
        
        # Count sync errors
        error_count = CalendarSyncRecord.objects.filter(
            sync_status='error'
        ).count()
        
        return {
            'date_range': f"{start_date} to {end_date}",
            'total_events': events_count,
            'total_meetings': meetings_count,
            'total_tasks': tasks_count,
            'synced_events': synced_events,
            'synced_meetings': synced_meetings,
            'synced_tasks': synced_tasks,
            'sync_errors': error_count,
            'sync_coverage': {
                'events': f"{synced_events}/{events_count}" if events_count > 0 else "0/0",
                'meetings': f"{synced_meetings}/{meetings_count}" if meetings_count > 0 else "0/0",
                'tasks': f"{synced_tasks}/{tasks_count}" if tasks_count > 0 else "0/0",
            }
        }