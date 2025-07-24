from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from notifications.email_service import EmailNotificationService
from requests.models import Request
from items.models import Vendor
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Test email notification functionality'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email address to send test email to (must be a user in the system)',
            required=True
        )
        parser.add_argument(
            '--type',
            type=str,
            choices=['new_request', 'order_placed', 'item_received', 'weekly_summary'],
            help='Type of email to test',
            default='new_request'
        )

    def handle(self, *args, **options):
        email = options['email']
        email_type = options['type']
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Testing {email_type} email notification to {email}'
            )
        )

        # Find user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(
                    f'No user found with email: {email}'
                )
            )
            return

        # Create test data if needed
        test_vendor, _ = Vendor.objects.get_or_create(
            name='Test Vendor',
            defaults={'website': 'https://test-vendor.com'}
        )

        # Create a test request for email testing
        test_request, _ = Request.objects.get_or_create(
            item_name='Test Item for Email',
            requested_by=user,
            defaults={
                'vendor': test_vendor,
                'catalog_number': 'TEST-001',
                'quantity': 10,
                'unit_size': 'mL',
                'unit_price': 25.50,
                'status': 'NEW',
                'url': 'https://example.com/test-product'
            }
        )

        try:
            success = False
            
            if email_type == 'new_request':
                success = EmailNotificationService.send_new_request_notification(test_request)
                
            elif email_type == 'order_placed':
                test_request.status = 'ORDERED'
                test_request.save()
                success = EmailNotificationService.send_order_placed_notification(
                    test_request, 
                    placed_by_user=user
                )
                
            elif email_type == 'item_received':
                test_request.status = 'RECEIVED'
                test_request.save()
                success = EmailNotificationService.send_item_received_notification(
                    test_request,
                    received_by_user=user,
                    quantity_received=10
                )
                
            elif email_type == 'weekly_summary':
                success = EmailNotificationService.send_weekly_inventory_summary()

            if success:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Test email sent successfully to {email}!'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'Email was not sent. Check user notification preferences and email configuration.'
                    )
                )
                
        except Exception as e:
            logger.error(f'Error sending test email: {e}')
            self.stdout.write(
                self.style.ERROR(
                    f'Error sending test email: {e}'
                )
            )
            raise

        # Clean up test request if it was created for this test
        if test_request.item_name == 'Test Item for Email':
            self.stdout.write('Cleaning up test request...')
            test_request.delete()