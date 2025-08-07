"""
Google Calendar integration service for schedule synchronization
"""

import os
import json
import logging
from datetime import datetime, timezone as dt_timezone
from typing import Dict, List, Optional, Tuple
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from google.auth.exceptions import RefreshError
except ImportError:
    # Graceful fallback if Google libraries are not installed
    Credentials = None
    Flow = None
    build = None
    HttpError = Exception
    RefreshError = Exception

from ..models import Event, MeetingInstance, PeriodicTaskInstance

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    """Service for integrating with Google Calendar API"""
    
    SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ]
    
    def __init__(self, credentials_path: str = None, calendar_id: str = None):
        """
        Initialize Google Calendar service
        
        Args:
            credentials_path: Path to OAuth2 credentials file
            calendar_id: Target Google Calendar ID (uses primary if None)
        """
        self.credentials_path = credentials_path or getattr(settings, 'GOOGLE_CALENDAR_CREDENTIALS_PATH', None)
        self.calendar_id = calendar_id or getattr(settings, 'GOOGLE_CALENDAR_ID', 'primary')
        self.service = None
        self._credentials = None
        
        if not self.credentials_path:
            logger.warning("Google Calendar credentials path not configured")
            
    def _get_credentials(self) -> Optional[Credentials]:
        """Get valid OAuth2 credentials"""
        if not self.credentials_path or not os.path.exists(self.credentials_path):
            logger.error(f"Credentials file not found: {self.credentials_path}")
            return None
            
        try:
            with open(self.credentials_path, 'r') as token_file:
                creds_data = json.load(token_file)
                
            creds = Credentials.from_authorized_user_info(creds_data, self.SCOPES)
            
            # Refresh credentials if expired
            if not creds.valid and creds.expired and creds.refresh_token:
                try:
                    creds.refresh()
                    # Save refreshed credentials
                    self._save_credentials(creds)
                except RefreshError:
                    logger.error("Failed to refresh Google Calendar credentials")
                    return None
                    
            return creds
            
        except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error loading credentials: {e}")
            return None
    
    def _save_credentials(self, credentials: Credentials):
        """Save credentials to file"""
        if not self.credentials_path:
            return
            
        creds_data = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        try:
            with open(self.credentials_path, 'w') as token_file:
                json.dump(creds_data, token_file)
        except IOError as e:
            logger.error(f"Error saving credentials: {e}")
    
    def get_service(self):
        """Get authenticated Google Calendar service"""
        if not build:
            logger.error("Google Calendar libraries not available")
            return None
            
        if self.service is None:
            credentials = self._get_credentials()
            if credentials:
                self.service = build('calendar', 'v3', credentials=credentials)
            
        return self.service
    
    def create_event(self, event_data: Dict) -> Optional[str]:
        """
        Create event in Google Calendar
        
        Args:
            event_data: Dictionary containing event information
            
        Returns:
            Google Calendar event ID if successful, None otherwise
        """
        service = self.get_service()
        if not service:
            return None
            
        try:
            event = service.events().insert(
                calendarId=self.calendar_id,
                body=event_data
            ).execute()
            
            logger.info(f"Created Google Calendar event: {event.get('id')}")
            return event.get('id')
            
        except HttpError as error:
            logger.error(f"Error creating Google Calendar event: {error}")
            return None
    
    def update_event(self, event_id: str, event_data: Dict) -> bool:
        """
        Update event in Google Calendar
        
        Args:
            event_id: Google Calendar event ID
            event_data: Updated event data
            
        Returns:
            True if successful, False otherwise
        """
        service = self.get_service()
        if not service:
            return False
            
        try:
            service.events().update(
                calendarId=self.calendar_id,
                eventId=event_id,
                body=event_data
            ).execute()
            
            logger.info(f"Updated Google Calendar event: {event_id}")
            return True
            
        except HttpError as error:
            logger.error(f"Error updating Google Calendar event: {error}")
            return False
    
    def delete_event(self, event_id: str) -> bool:
        """
        Delete event from Google Calendar
        
        Args:
            event_id: Google Calendar event ID
            
        Returns:
            True if successful, False otherwise
        """
        service = self.get_service()
        if not service:
            return False
            
        try:
            service.events().delete(
                calendarId=self.calendar_id,
                eventId=event_id
            ).execute()
            
            logger.info(f"Deleted Google Calendar event: {event_id}")
            return True
            
        except HttpError as error:
            logger.error(f"Error deleting Google Calendar event: {error}")
            return False
    
    def get_event(self, event_id: str) -> Optional[Dict]:
        """
        Get event from Google Calendar
        
        Args:
            event_id: Google Calendar event ID
            
        Returns:
            Event data if found, None otherwise
        """
        service = self.get_service()
        if not service:
            return None
            
        try:
            event = service.events().get(
                calendarId=self.calendar_id,
                eventId=event_id
            ).execute()
            
            return event
            
        except HttpError as error:
            logger.error(f"Error getting Google Calendar event: {error}")
            return None
    
    def list_events(self, time_min: datetime = None, time_max: datetime = None, 
                   max_results: int = 100) -> List[Dict]:
        """
        List events from Google Calendar
        
        Args:
            time_min: Minimum time for events
            time_max: Maximum time for events  
            max_results: Maximum number of events to return
            
        Returns:
            List of event data
        """
        service = self.get_service()
        if not service:
            return []
            
        try:
            events_result = service.events().list(
                calendarId=self.calendar_id,
                timeMin=time_min.isoformat() if time_min else None,
                timeMax=time_max.isoformat() if time_max else None,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            return events
            
        except HttpError as error:
            logger.error(f"Error listing Google Calendar events: {error}")
            return []
    
    @staticmethod
    def format_event_for_google_calendar(event: Event) -> Dict:
        """
        Format Django Event for Google Calendar API
        
        Args:
            event: Django Event instance
            
        Returns:
            Dictionary formatted for Google Calendar API
        """
        # Convert to timezone-aware datetime if needed
        start_time = event.start_time
        end_time = event.end_time
        
        if timezone.is_naive(start_time):
            start_time = timezone.make_aware(start_time)
        if timezone.is_naive(end_time):
            end_time = timezone.make_aware(end_time)
        
        event_data = {
            'summary': event.title,
            'description': event.description or '',
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': str(start_time.tzinfo),
            },
            'end': {
                'dateTime': end_time.isoformat(), 
                'timeZone': str(end_time.tzinfo),
            },
            'source': {
                'title': 'Lab Schedule System',
                'url': f'/schedule/events/{event.id}/'
            }
        }
        
        # Add location for meetings
        if hasattr(event, 'group_meeting') and event.group_meeting:
            # Check if there's location information
            if event.description and 'Location:' in event.description:
                location = event.description.split('Location:')[1].split('\n')[0].strip()
                if location:
                    event_data['location'] = location
        
        # Add attendees for meetings
        if hasattr(event, 'group_meeting') and event.group_meeting:
            # For now, we'll add a generic lab meeting note
            # In a full implementation, you might want to add specific attendees
            event_data['description'] += '\n\nLab Group Meeting - All members invited'
        
        return event_data
    
    @staticmethod
    def format_meeting_for_google_calendar(meeting: MeetingInstance) -> Dict:
        """
        Format Django MeetingInstance for Google Calendar API
        
        Args:
            meeting: Django MeetingInstance
            
        Returns:
            Dictionary formatted for Google Calendar API
        """
        # Build title based on meeting type
        if meeting.meeting_type == 'research_update':
            title = f"Research Update - {meeting.date.strftime('%b %d, %Y')}"
        elif meeting.meeting_type == 'journal_club':
            title = f"Journal Club - {meeting.date.strftime('%b %d, %Y')}"
        else:
            title = f"Lab Meeting - {meeting.date.strftime('%b %d, %Y')}"
        
        # Build description
        description_parts = [f"Meeting Type: {meeting.get_meeting_type_display()}"]
        
        # Add presenters information
        presenters = meeting.presenters.filter(status='assigned')
        if presenters.exists():
            presenter_names = [p.user.get_full_name() or p.user.username for p in presenters]
            description_parts.append(f"Presenters: {', '.join(presenter_names)}")
        
        # Add paper information for Journal Club
        if meeting.meeting_type == 'journal_club' and meeting.paper_title:
            description_parts.append(f"Paper: {meeting.paper_title}")
            if meeting.paper_url:
                description_parts.append(f"Paper URL: {meeting.paper_url}")
        
        description = '\n'.join(description_parts)
        
        # Create datetime objects (assume default times if not set)
        meeting_date = meeting.date
        start_time = datetime.combine(meeting_date, datetime.min.time().replace(hour=14, minute=0))
        
        # Set duration based on meeting type
        if meeting.meeting_type == 'research_update':
            duration_hours = 2
        else:  # journal_club
            duration_hours = 1
            
        end_time = start_time.replace(hour=start_time.hour + duration_hours)
        
        # Make timezone aware
        start_time = timezone.make_aware(start_time)
        end_time = timezone.make_aware(end_time)
        
        return {
            'summary': title,
            'description': description,
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': str(start_time.tzinfo),
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': str(end_time.tzinfo),
            },
            'location': 'Laboratory Conference Room',
            'source': {
                'title': 'Lab Schedule System',
                'url': f'/schedule/meetings/{meeting.id}/'
            }
        }
    
    @staticmethod 
    def format_task_for_google_calendar(task: PeriodicTaskInstance) -> Dict:
        """
        Format Django PeriodicTaskInstance for Google Calendar API
        
        Args:
            task: Django PeriodicTaskInstance
            
        Returns:
            Dictionary formatted for Google Calendar API
        """
        # Get assignees
        assignees = task.get_assignees()
        assignee_names = [user.get_full_name() or user.username for user in assignees]
        
        title = f"{task.template.title}"
        if assignee_names:
            title += f" - {', '.join(assignee_names)}"
        
        description_parts = [
            f"Task Type: {task.template.get_category_display()}",
            f"Status: {task.get_status_display()}",
        ]
        
        if task.template.description:
            description_parts.append(f"Description: {task.template.description}")
            
        if assignee_names:
            description_parts.append(f"Assigned to: {', '.join(assignee_names)}")
        
        description = '\n'.join(description_parts)
        
        # For tasks, we'll create all-day events on the due date
        due_date = task.execution_end_date
        
        return {
            'summary': title,
            'description': description,
            'start': {
                'date': due_date.strftime('%Y-%m-%d'),
            },
            'end': {
                'date': due_date.strftime('%Y-%m-%d'),
            },
            'source': {
                'title': 'Lab Schedule System',
                'url': f'/schedule/tasks/{task.id}/'
            }
        }