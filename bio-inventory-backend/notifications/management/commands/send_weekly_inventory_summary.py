from django.core.management.base import BaseCommand
from django.utils import timezone
from notifications.email_service import EmailNotificationService
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send weekly inventory summary emails to users who have opted in'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be sent without actually sending emails',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force send even if not the scheduled day',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS(
                f'Starting weekly inventory summary at {timezone.now()}'
            )
        )

        dry_run = options['dry_run']
        force = options['force']

        # Check if it's the right day to send (e.g., Monday)
        if not force:
            current_weekday = timezone.now().weekday()  # 0 = Monday, 6 = Sunday
            if current_weekday != 0:  # Not Monday
                self.stdout.write(
                    self.style.WARNING(
                        f'Today is not Monday (current day: {current_weekday}). '
                        'Use --force to send anyway.'
                    )
                )
                return

        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No emails will be sent')
            )
            
            # Get preview of what would be sent
            from django.contrib.auth.models import User
            from items.models import Item
            from datetime import timedelta
            
            # Get users who want weekly digest
            users_for_digest = User.objects.filter(
                is_active=True,
                notification_preferences__enable_weekly_digest=True
            )
            
            self.stdout.write(f'Would send to {users_for_digest.count()} users:')
            for user in users_for_digest:
                self.stdout.write(f'  - {user.username} ({user.email})')
            
            # Get inventory statistics
            now = timezone.now()
            thirty_days_from_now = now + timedelta(days=30)
            
            expired_count = Item.objects.filter(
                expiration_date__lt=now.date(),
                quantity__gt=0
            ).count()
            
            expiring_soon_count = Item.objects.filter(
                expiration_date__gte=now.date(),
                expiration_date__lte=thirty_days_from_now.date(),
                quantity__gt=0
            ).count()
            
            low_stock_count = Item.objects.filter(
                quantity__lte=5,
                quantity__gt=0
            ).count()
            
            self.stdout.write(f'Inventory summary:')
            self.stdout.write(f'  - Expired items: {expired_count}')
            self.stdout.write(f'  - Expiring soon: {expiring_soon_count}')
            self.stdout.write(f'  - Low stock: {low_stock_count}')
            
            return

        # Send the actual emails
        try:
            success = EmailNotificationService.send_weekly_inventory_summary()
            
            if success:
                self.stdout.write(
                    self.style.SUCCESS(
                        'Weekly inventory summary emails sent successfully!'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        'No users configured to receive weekly inventory digest'
                    )
                )
                
        except Exception as e:
            logger.error(f'Error sending weekly inventory summary: {e}')
            self.stdout.write(
                self.style.ERROR(
                    f'Error sending weekly inventory summary: {e}'
                )
            )
            raise

        self.stdout.write(
            self.style.SUCCESS(
                f'Weekly inventory summary completed at {timezone.now()}'
            )
        )