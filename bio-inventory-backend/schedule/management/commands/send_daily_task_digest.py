from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import date, timedelta
import logging

from notifications.models import NotificationPreference
from notifications.email_service import EmailNotificationService
from schedule.services.notification_service import TaskNotificationService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send daily task digest emails to users who have opted in'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be sent without actually sending emails',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Send digest to specific user only (for testing)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        specific_user_id = options.get('user_id')
        
        self.stdout.write(self.style.SUCCESS('Starting daily task digest...'))
        
        # Get users who have enabled daily digests
        if specific_user_id:
            users_with_digest = User.objects.filter(
                id=specific_user_id,
                is_active=True
            )
        else:
            users_with_digest = User.objects.filter(
                is_active=True,
                notification_preferences__enable_daily_digest=True
            )
        
        if not users_with_digest.exists():
            self.stdout.write(self.style.WARNING('No users have enabled daily digest'))
            return
        
        sent_count = 0
        error_count = 0
        
        for user in users_with_digest:
            try:
                # Create digest summary
                digest_data = TaskNotificationService.create_digest_summary(
                    user=user,
                    period_days=1  # Daily digest
                )
                
                # Skip if no relevant content
                if (digest_data['stats']['total_active'] == 0 and 
                    digest_data['stats']['total_overdue'] == 0 and 
                    digest_data['stats']['total_upcoming'] == 0):
                    continue
                
                if dry_run:
                    self.stdout.write(
                        f"Would send digest to {user.username}:\n"
                        f"  - Active tasks: {digest_data['stats']['total_active']}\n"
                        f"  - Overdue tasks: {digest_data['stats']['total_overdue']}\n"
                        f"  - Upcoming tasks: {digest_data['stats']['total_upcoming']}\n"
                        f"  - Pending swaps: {digest_data['stats']['total_pending_swaps']}"
                    )
                    sent_count += 1
                    continue
                
                # Prepare email context
                email_context = {
                    'user': user,
                    'digest_data': digest_data,
                    'date': date.today(),
                    'site_name': 'Quartzy Bio-Inventory',
                    'action_url': '/schedule/my-tasks/'
                }
                
                # Send digest email
                EmailNotificationService.send_email_notification(
                    recipients=[user],
                    subject=f"Daily Task Digest - {date.today().strftime('%B %d, %Y')}",
                    template_name='notifications/emails/daily_task_digest',
                    context=email_context
                )
                
                sent_count += 1
                logger.info(f"Sent daily digest to {user.username}")
                
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"Failed to send digest to {user.username}: {str(e)}")
                )
                logger.error(f"Failed to send digest to {user.username}: {str(e)}")
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'DRY RUN: Would send {sent_count} digest emails')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Daily digest completed: {sent_count} sent, {error_count} errors'
                )
            )
            
            if error_count > 0:
                self.stdout.write(
                    self.style.WARNING(f'{error_count} digest emails failed to send')
                )