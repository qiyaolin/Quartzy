from django.core.management.base import BaseCommand
from django.utils import timezone
from items.models import Item
from notifications.services import NotificationService


class Command(BaseCommand):
    help = 'Check for expired and low stock items and create notifications'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without creating notifications',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No notifications will be created'))
        
        # Get all items that need attention
        items = Item.objects.filter(is_active=True)
        
        expired_count = 0
        expiring_soon_count = 0
        low_stock_count = 0
        
        for item in items:
            notifications_created = []
            
            # Check for expired items
            if item.expiration_status == 'EXPIRED':
                if not dry_run:
                    NotificationService.create_inventory_alert(
                        item=item,
                        alert_type='expired'
                    )
                notifications_created.append('EXPIRED')
                expired_count += 1
            
            # Check for expiring soon items
            elif item.expiration_status == 'EXPIRING_SOON':
                if not dry_run:
                    NotificationService.create_inventory_alert(
                        item=item,
                        alert_type='expiring_soon'
                    )
                notifications_created.append('EXPIRING_SOON')
                expiring_soon_count += 1
            
            # Check for low stock items
            if item.is_low_stock:
                if not dry_run:
                    NotificationService.create_inventory_alert(
                        item=item,
                        alert_type='low_stock'
                    )
                notifications_created.append('LOW_STOCK')
                low_stock_count += 1
            
            # Log what was done for this item
            if notifications_created:
                status_str = ', '.join(notifications_created)
                action = 'Would create' if dry_run else 'Created'
                self.stdout.write(
                    f'{action} notifications for item "{item.name}" '
                    f'(ID: {item.id}): {status_str}'
                )
        
        # Summary
        total_notifications = expired_count + expiring_soon_count + low_stock_count
        
        self.stdout.write('\n' + '='*50)
        self.stdout.write(f'Summary:')
        self.stdout.write(f'  Expired items: {expired_count}')
        self.stdout.write(f'  Expiring soon items: {expiring_soon_count}')
        self.stdout.write(f'  Low stock items: {low_stock_count}')
        self.stdout.write(f'  Total notifications: {total_notifications}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nRun without --dry-run to create notifications'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nSuccessfully created {total_notifications} notifications'))