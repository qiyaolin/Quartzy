"""
Django management command to sync schedule data with Google Calendar
Usage: python manage.py sync_google_calendar [options]
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import datetime, timedelta
from schedule.services.calendar_sync_service import CalendarSyncService
from schedule.services.google_calendar_service import GoogleCalendarService
from schedule.models import CalendarSyncRecord


class Command(BaseCommand):
    help = 'Sync schedule data with Google Calendar'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--start-date',
            type=str,
            help='Start date for sync (YYYY-MM-DD format, default: today)'
        )
        parser.add_argument(
            '--end-date', 
            type=str,
            help='End date for sync (YYYY-MM-DD format, default: 3 months from start)'
        )
        parser.add_argument(
            '--sync-type',
            choices=['all', 'events', 'meetings', 'tasks'],
            default='all',
            help='Type of objects to sync (default: all)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force sync even if already synced'
        )
        parser.add_argument(
            '--cleanup',
            action='store_true',
            help='Clean up orphaned Google Calendar events'
        )
        parser.add_argument(
            '--status',
            action='store_true',
            help='Show sync status report'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be synced without actually syncing'
        )
        parser.add_argument(
            '--credentials-path',
            type=str,
            help='Path to Google Calendar credentials file'
        )
        parser.add_argument(
            '--calendar-id',
            type=str,
            help='Google Calendar ID to sync to (default: primary)'
        )
    
    def handle(self, *args, **options):
        # Parse dates
        start_date = None
        end_date = None
        
        if options['start_date']:
            try:
                start_date = datetime.strptime(options['start_date'], '%Y-%m-%d').date()
            except ValueError:
                raise CommandError("Invalid start date format. Use YYYY-MM-DD")
        
        if options['end_date']:
            try:
                end_date = datetime.strptime(options['end_date'], '%Y-%m-%d').date()
            except ValueError:
                raise CommandError("Invalid end date format. Use YYYY-MM-DD")
        
        # Initialize services
        gcal_service = GoogleCalendarService(
            credentials_path=options.get('credentials_path'),
            calendar_id=options.get('calendar_id')
        )
        
        sync_service = CalendarSyncService(gcal_service)
        
        # Check if Google Calendar service is available
        if not gcal_service.get_service():
            self.stdout.write(
                self.style.ERROR(
                    "Failed to initialize Google Calendar service. "
                    "Please check credentials and configuration."
                )
            )
            return
        
        # Handle status report
        if options['status']:
            self.show_sync_status(sync_service, start_date)
            return
        
        # Handle cleanup
        if options['cleanup']:
            self.cleanup_orphaned_events(sync_service)
            return
        
        # Handle dry run
        if options['dry_run']:
            self.show_dry_run_info(start_date, end_date, options['sync_type'])
            return
        
        # Perform sync
        self.stdout.write(
            self.style.SUCCESS(
                f"Starting Google Calendar sync..."
            )
        )
        
        if options['sync_type'] == 'all':
            stats = sync_service.sync_all_events(start_date, end_date)
        else:
            # Individual sync type logic would go here
            # For now, we'll just use sync_all_events
            stats = sync_service.sync_all_events(start_date, end_date)
        
        # Display results
        self.stdout.write(
            self.style.SUCCESS(
                f"Sync completed successfully!\n"
                f"Events synced: {stats['events_synced']}\n"
                f"Meetings synced: {stats['meetings_synced']}\n"
                f"Tasks synced: {stats['tasks_synced']}\n"
                f"Errors: {stats['errors']}"
            )
        )
    
    def show_sync_status(self, sync_service, start_date=None):
        """Show sync status report"""
        status = sync_service.get_sync_status(start_date)
        
        self.stdout.write(
            self.style.SUCCESS("=== Google Calendar Sync Status ===")
        )
        self.stdout.write(f"Date range: {status['date_range']}")
        self.stdout.write(f"Total events: {status['total_events']}")
        self.stdout.write(f"Total meetings: {status['total_meetings']}")
        self.stdout.write(f"Total tasks: {status['total_tasks']}")
        self.stdout.write("")
        self.stdout.write("Sync Coverage:")
        self.stdout.write(f"  Events: {status['sync_coverage']['events']}")
        self.stdout.write(f"  Meetings: {status['sync_coverage']['meetings']}")
        self.stdout.write(f"  Tasks: {status['sync_coverage']['tasks']}")
        self.stdout.write("")
        
        if status['sync_errors'] > 0:
            self.stdout.write(
                self.style.WARNING(f"Sync errors: {status['sync_errors']}")
            )
            
            # Show recent errors
            recent_errors = CalendarSyncRecord.objects.filter(
                sync_status='error'
            ).order_by('-created_at')[:5]
            
            if recent_errors.exists():
                self.stdout.write("\nRecent errors:")
                for error_record in recent_errors:
                    self.stdout.write(
                        f"  - {error_record.content_type} {error_record.object_id}: "
                        f"{error_record.error_message}"
                    )
    
    def cleanup_orphaned_events(self, sync_service):
        """Clean up orphaned Google Calendar events"""
        self.stdout.write("Cleaning up orphaned Google Calendar events...")
        
        cleanup_count = sync_service.cleanup_orphaned_events()
        
        self.stdout.write(
            self.style.SUCCESS(
                f"Cleaned up {cleanup_count} orphaned events"
            )
        )
    
    def show_dry_run_info(self, start_date, end_date, sync_type):
        """Show what would be synced in dry run mode"""
        from schedule.models import Event, MeetingInstance, PeriodicTaskInstance
        
        if start_date is None:
            start_date = timezone.now().date()
        if end_date is None:
            end_date = start_date + timedelta(days=90)
        
        self.stdout.write(
            self.style.SUCCESS("=== Dry Run - What would be synced ===")
        )
        self.stdout.write(f"Date range: {start_date} to {end_date}")
        self.stdout.write(f"Sync type: {sync_type}")
        self.stdout.write("")
        
        if sync_type in ['all', 'events']:
            events = Event.objects.filter(
                start_time__date__gte=start_date,
                start_time__date__lte=end_date
            )
            self.stdout.write(f"Events to sync: {events.count()}")
            for event in events[:5]:  # Show first 5
                self.stdout.write(f"  - {event.title} ({event.start_time})")
            if events.count() > 5:
                self.stdout.write(f"  ... and {events.count() - 5} more")
            self.stdout.write("")
        
        if sync_type in ['all', 'meetings']:
            meetings = MeetingInstance.objects.filter(
                date__gte=start_date,
                date__lte=end_date
            )
            self.stdout.write(f"Meetings to sync: {meetings.count()}")
            for meeting in meetings[:5]:  # Show first 5
                self.stdout.write(f"  - {meeting.get_meeting_type_display()} ({meeting.date})")
            if meetings.count() > 5:
                self.stdout.write(f"  ... and {meetings.count() - 5} more")
            self.stdout.write("")
        
        if sync_type in ['all', 'tasks']:
            tasks = PeriodicTaskInstance.objects.filter(
                execution_end_date__gte=start_date,
                execution_end_date__lte=end_date
            )
            self.stdout.write(f"Tasks to sync: {tasks.count()}")
            for task in tasks[:5]:  # Show first 5
                self.stdout.write(f"  - {task.template.title} (due: {task.execution_end_date})")
            if tasks.count() > 5:
                self.stdout.write(f"  ... and {tasks.count() - 5} more")
        
        self.stdout.write("")
        self.stdout.write("Use --force to sync even if already synced")
        self.stdout.write("Remove --dry-run to perform actual sync")