"""
Django management command to clean up expired swap requests and update overdue tasks
Usage: python manage.py cleanup_periodic_tasks --days-back 30 --update-overdue
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, date, timedelta
from django.db import transaction
from schedule.models import (
    TaskSwapRequest, PeriodicTaskInstance, StatusChangeRecord,
    NotificationRecord
)


class Command(BaseCommand):
    help = 'Clean up expired swap requests and update overdue task statuses'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--days-back',
            type=int,
            default=30,
            help='Number of days to look back for cleanup (default: 30)'
        )
        parser.add_argument(
            '--expire-swap-requests',
            action='store_true',
            default=True,
            help='Clean up expired swap requests (default: True)'
        )
        parser.add_argument(
            '--update-overdue',
            action='store_true',
            default=True,
            help='Update overdue task statuses (default: True)'
        )
        parser.add_argument(
            '--archive-completed',
            action='store_true',
            help='Archive old completed tasks'
        )
        parser.add_argument(
            '--cleanup-notifications',
            action='store_true',
            help='Clean up old notification records'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned up without making changes'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed cleanup information'
        )
    
    def handle(self, *args, **options):
        cutoff_date = date.today() - timedelta(days=options['days_back'])
        cutoff_datetime = timezone.now() - timedelta(days=options['days_back'])
        
        self.stdout.write(f"Starting cleanup for items older than {cutoff_date}")
        
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )
        
        cleanup_stats = {
            'expired_swaps': 0,
            'overdue_tasks': 0,
            'archived_tasks': 0,
            'cleaned_notifications': 0,
            'errors': []
        }
        
        with transaction.atomic():
            # Clean up expired swap requests
            if options['expire_swap_requests']:
                cleanup_stats['expired_swaps'] = self._cleanup_expired_swaps(
                    cutoff_datetime, options
                )
            
            # Update overdue task statuses
            if options['update_overdue']:
                cleanup_stats['overdue_tasks'] = self._update_overdue_tasks(
                    options
                )
            
            # Archive old completed tasks
            if options['archive_completed']:
                cleanup_stats['archived_tasks'] = self._archive_completed_tasks(
                    cutoff_date, options
                )
            
            # Clean up old notification records
            if options['cleanup_notifications']:
                cleanup_stats['cleaned_notifications'] = self._cleanup_notifications(
                    cutoff_datetime, options
                )
        
        # Display results
        self._display_cleanup_results(cleanup_stats, options)
    
    def _cleanup_expired_swaps(self, cutoff_datetime, options):
        """Clean up expired swap requests"""
        self.stdout.write("\n--- Cleaning up expired swap requests ---")
        
        # Find expired swap requests that are still pending
        expired_swaps = TaskSwapRequest.objects.filter(
            status='pending',
            created_at__lt=cutoff_datetime
        )
        
        count = expired_swaps.count()
        
        if options['verbose']:
            for swap in expired_swaps:
                self.stdout.write(
                    f"  - Swap #{swap.id}: {swap.from_user.username} → "
                    f"{swap.to_user.username if swap.to_user else 'public pool'} "
                    f"(created: {swap.created_at.date()})"
                )
        
        if not options['dry_run'] and count > 0:
            # Update status to expired and log the change
            for swap in expired_swaps:
                # Create status change record
                StatusChangeRecord.objects.create(
                    task_instance=swap.task_instance,
                    from_status=swap.status,
                    to_status='expired',
                    changed_by=None,  # System change
                    reason=f"Automatic cleanup - swap request expired after {options['days_back']} days"
                )
                
                swap.status = 'expired'
                swap.save()
        
        self.stdout.write(
            f"{'Would expire' if options['dry_run'] else 'Expired'} {count} swap requests"
        )
        
        return count
    
    def _update_overdue_tasks(self, options):
        """Update overdue task statuses"""
        self.stdout.write("\n--- Updating overdue tasks ---")
        
        today = date.today()
        
        # Find tasks that are past their execution end date and still scheduled/in_progress
        overdue_tasks = PeriodicTaskInstance.objects.filter(
            status__in=['scheduled', 'in_progress'],
            execution_end_date__lt=today
        )
        
        count = overdue_tasks.count()
        
        if options['verbose']:
            for task in overdue_tasks:
                days_overdue = (today - task.execution_end_date).days
                assignees = task.get_assignees()
                assignee_names = [u.username for u in assignees]
                
                self.stdout.write(
                    f"  - Task #{task.id}: {task.template_name} → "
                    f"{', '.join(assignee_names)} "
                    f"(overdue by {days_overdue} days)"
                )
        
        if not options['dry_run'] and count > 0:
            for task in overdue_tasks:
                # Create status change record
                StatusChangeRecord.objects.create(
                    task_instance=task,
                    from_status=task.status,
                    to_status='overdue',
                    changed_by=None,  # System change
                    reason="Automatic status update - task execution period has passed"
                )
                
                task.status = 'overdue'
                task.save()
        
        self.stdout.write(
            f"{'Would mark' if options['dry_run'] else 'Marked'} {count} tasks as overdue"
        )
        
        return count
    
    def _archive_completed_tasks(self, cutoff_date, options):
        """Archive old completed tasks"""
        self.stdout.write("\n--- Archiving old completed tasks ---")
        
        # Find tasks completed more than X days ago
        old_completed_tasks = PeriodicTaskInstance.objects.filter(
            status='completed',
            completed_at__date__lt=cutoff_date
        )
        
        count = old_completed_tasks.count()
        
        if options['verbose']:
            for task in old_completed_tasks:
                self.stdout.write(
                    f"  - Task #{task.id}: {task.template_name} "
                    f"(completed: {task.completed_at.date()})"
                )
        
        if not options['dry_run'] and count > 0:
            # For now, we'll just add metadata to mark them as archived
            # In the future, these could be moved to an archive table
            for task in old_completed_tasks:
                if not task.assignment_metadata:
                    task.assignment_metadata = {}
                
                task.assignment_metadata['archived_at'] = timezone.now().isoformat()
                task.assignment_metadata['archived_by'] = 'system_cleanup'
                task.save(update_fields=['assignment_metadata'])
        
        self.stdout.write(
            f"{'Would archive' if options['dry_run'] else 'Archived'} {count} completed tasks"
        )
        
        return count
    
    def _cleanup_notifications(self, cutoff_datetime, options):
        """Clean up old notification records"""
        self.stdout.write("\n--- Cleaning up old notifications ---")
        
        # Find old notification records
        old_notifications = NotificationRecord.objects.filter(
            sent_at__lt=cutoff_datetime
        )
        
        count = old_notifications.count()
        
        if options['verbose']:
            # Group by notification type for summary
            notification_summary = {}
            for notification in old_notifications:
                notification_type = notification.get_notification_type_display()
                notification_summary[notification_type] = notification_summary.get(notification_type, 0) + 1
            
            for notification_type, type_count in notification_summary.items():
                self.stdout.write(f"  - {notification_type}: {type_count} records")
        
        if not options['dry_run'] and count > 0:
            old_notifications.delete()
        
        self.stdout.write(
            f"{'Would delete' if options['dry_run'] else 'Deleted'} {count} notification records"
        )
        
        return count
    
    def _display_cleanup_results(self, stats, options):
        """Display cleanup results summary"""
        self.stdout.write(f"\n{'=' * 50}")
        self.stdout.write(
            self.style.SUCCESS("Cleanup Summary:")
        )
        
        prefix = "Would clean up" if options['dry_run'] else "Cleaned up"
        
        self.stdout.write(f"  - {prefix} {stats['expired_swaps']} expired swap requests")
        self.stdout.write(f"  - {prefix} {stats['overdue_tasks']} overdue tasks")
        self.stdout.write(f"  - {prefix} {stats['archived_tasks']} completed tasks")
        self.stdout.write(f"  - {prefix} {stats['cleaned_notifications']} notification records")
        
        if stats['errors']:
            self.stdout.write(
                self.style.ERROR(f"Encountered {len(stats['errors'])} errors:")
            )
            for error in stats['errors']:
                self.stdout.write(f"  - {error}")