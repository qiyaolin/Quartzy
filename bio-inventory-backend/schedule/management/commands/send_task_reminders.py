from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta, datetime
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:  # pragma: no cover
    ZoneInfo = None
import logging

from schedule.models import PeriodicTaskInstance
from schedule.services.notification_service import TaskNotificationService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send task deadline reminder notifications'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days-ahead',
            type=int,
            default=7,
            help='How many days ahead to look for upcoming deadlines (default: 7)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be sent without actually sending notifications',
        )
        parser.add_argument(
            '--overdue-only',
            action='store_true',
            help='Only send notifications for overdue tasks',
        )
        parser.add_argument(
            '--upcoming-only',
            action='store_true',
            help='Only send notifications for upcoming deadlines',
        )

    def handle(self, *args, **options):
        days_ahead = options['days_ahead']
        dry_run = options['dry_run']
        overdue_only = options['overdue_only']
        upcoming_only = options['upcoming_only']
        
        # Enforce business rule: only run on US/Eastern weekdays at/after 11:00am ET
        try:
            if ZoneInfo is not None:
                now_et = timezone.now().astimezone(ZoneInfo('America/New_York'))
            else:
                now_et = timezone.now()  # fallback
            # Monday=0..Sunday=6; weekdays 0-4
            if now_et.weekday() > 4:
                self.stdout.write(self.style.WARNING('Weekend detected in US/Eastern. Skipping reminders.'))
                return
            if now_et.hour < 11:
                self.stdout.write(self.style.WARNING('Before 11:00 AM US/Eastern. Skipping reminders until window.'))
                return
        except Exception:
            # If timezone conversion fails, proceed but still log
            self.stdout.write(self.style.WARNING('Timezone check failed; proceeding with sending.'))

        self.stdout.write(self.style.SUCCESS('Starting task reminder notifications (ET weekday window)...'))
        
        # Get overdue tasks
        overdue_tasks = []
        if not upcoming_only:
            overdue_tasks = list(PeriodicTaskInstance.objects.filter(
                status__in=['scheduled', 'pending', 'in_progress'],
                execution_end_date__lt=date.today()
            ).select_related('template'))
        
        # Get upcoming tasks
        upcoming_tasks = []
        if not overdue_only:
            upcoming_date = date.today() + timedelta(days=days_ahead)
            upcoming_tasks = list(PeriodicTaskInstance.objects.filter(
                status__in=['scheduled', 'pending'],
                execution_end_date__lte=upcoming_date,
                execution_end_date__gte=date.today()
            ).select_related('template'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No notifications will be sent'))
            
            if overdue_tasks:
                self.stdout.write(
                    self.style.ERROR(f'Found {len(overdue_tasks)} overdue tasks:')
                )
                for task in overdue_tasks:
                    days_overdue = (date.today() - task.execution_end_date).days
                    assignees = task.get_assignees()
                    assignee_names = [u.username for u in assignees] if assignees else ['No assignees']
                    
                    self.stdout.write(
                        f'  - {task.template_name} (Period: {task.scheduled_period}, '
                        f'{days_overdue} days overdue, Assignees: {", ".join(assignee_names)})'
                    )
            
            if upcoming_tasks:
                self.stdout.write(
                    self.style.WARNING(f'Found {len(upcoming_tasks)} upcoming deadlines:')
                )
                for task in upcoming_tasks:
                    days_remaining = (task.execution_end_date - date.today()).days
                    assignees = task.get_assignees()
                    assignee_names = [u.username for u in assignees] if assignees else ['No assignees']
                    
                    self.stdout.write(
                        f'  - {task.template_name} (Period: {task.scheduled_period}, '
                        f'{days_remaining} days remaining, Assignees: {", ".join(assignee_names)})'
                    )
            
            return
        
        # Send actual notifications
        try:
            result = TaskNotificationService.notify_task_deadline_approaching(
                overdue_tasks=overdue_tasks,
                upcoming_tasks=upcoming_tasks,
                days_ahead=days_ahead
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Sent {result["overdue_sent"]} overdue notifications and '
                    f'{result["upcoming_sent"]} upcoming deadline notifications'
                )
            )
            
            if result['overdue_sent'] > 0:
                self.stdout.write(
                    self.style.ERROR(
                        f'WARNING: {len(overdue_tasks)} tasks are overdue!'
                    )
                )
            
            # Log to file
            logger.info(
                f'Task reminders sent: {result["overdue_sent"]} overdue, '
                f'{result["upcoming_sent"]} upcoming (days_ahead={days_ahead})'
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error sending notifications: {str(e)}')
            )
            logger.error(f'Failed to send task reminders: {str(e)}')
            raise

        self.stdout.write(self.style.SUCCESS('Task reminder notifications completed!'))