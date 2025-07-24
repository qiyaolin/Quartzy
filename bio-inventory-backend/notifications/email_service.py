from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q
from .models import NotificationPreference
import logging

logger = logging.getLogger(__name__)


class EmailNotificationService:
    """Service for sending email notifications"""
    
    @staticmethod
    def get_base_context():
        """Get base context for all email templates"""
        return {
            'base_url': getattr(settings, 'FRONTEND_URL', 'http://localhost:3000'),
            'site_name': 'Quartzy Bio-Inventory',
        }
    
    @staticmethod
    def send_email_notification(
        recipients,
        subject,
        template_name,
        context=None,
        from_email=None
    ):
        """
        Send email notification using HTML template
        
        Args:
            recipients: List of User objects or email addresses
            subject: Email subject
            template_name: Template name (without .html extension)
            context: Template context dictionary
            from_email: From email address (optional)
        """
        if not recipients:
            logger.warning("No recipients provided for email notification")
            return False
            
        if context is None:
            context = {}
            
        # Add base context
        context.update(EmailNotificationService.get_base_context())
        
        # Prepare from email
        if not from_email:
            from_email = settings.DEFAULT_FROM_EMAIL
            
        # Add subject prefix
        if not subject.startswith(settings.EMAIL_SUBJECT_PREFIX):
            subject = f"{settings.EMAIL_SUBJECT_PREFIX}{subject}"
        
        # Render HTML template
        html_template = f'notifications/emails/{template_name}.html'
        try:
            html_content = render_to_string(html_template, context)
            
            # Create a more readable plain text version
            import re
            from html import unescape
            
            # Remove HTML tags and decode entities
            plain_text = re.sub('<[^<]+?>', '', html_content)
            plain_text = unescape(plain_text)
            
            # Clean up whitespace and formatting
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            plain_text = re.sub(r' {2,}', ' ', plain_text)
            
            # Add some basic formatting for readability
            plain_text = plain_text.replace('Request Details', '\n--- REQUEST DETAILS ---\n')
            plain_text = plain_text.replace('Order Details', '\n--- ORDER DETAILS ---\n')
            plain_text = plain_text.replace('Additional Notes', '\n--- ADDITIONAL NOTES ---\n')
            plain_text = plain_text.replace('Hayer Lab - McGill University', '\n\nHayer Lab - McGill University')
            
            # Ensure it starts and ends cleanly 
            plain_text = plain_text.strip()
            
        except Exception as e:
            logger.error(f"Error rendering email template {html_template}: {e}")
            return False
        
        # Prepare recipient emails
        recipient_emails = []
        for recipient in recipients:
            if isinstance(recipient, User):
                if recipient.email:
                    recipient_emails.append(recipient.email)
                else:
                    logger.warning(f"User {recipient.username} has no email address")
            elif isinstance(recipient, str):
                recipient_emails.append(recipient)
        
        if not recipient_emails:
            logger.warning("No valid email addresses found in recipients")
            return False
        
        try:
            # Create email message with both plain text and HTML
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text,  # Plain text version as primary
                from_email=from_email,
                to=recipient_emails
            )
            msg.attach_alternative(html_content, "text/html")
            
            # Add headers to improve deliverability and avoid spam filters
            msg.extra_headers.update({
                'X-Mailer': 'Quartzy Bio-Inventory System',
                'X-Priority': '3',  # Normal priority
                'X-MSMail-Priority': 'Normal',
                'Importance': 'Normal',
                'List-Unsubscribe': f'<{settings.FRONTEND_URL}/settings>',
                'List-Id': 'Quartzy Lab Notifications <notifications.quartzy>',
                'Organization': 'Hayer Lab - McGill University',
                'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN',
                'Reply-To': from_email,
            })
            
            # Send email
            sent_count = msg.send()
            logger.info(f"Sent email '{subject}' to {len(recipient_emails)} recipients")
            return sent_count > 0
            
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    @staticmethod
    def should_send_email(user, notification_type):
        """
        Check if user wants to receive email for this notification type
        
        Args:
            user: User object
            notification_type: Type of notification (request_updates, inventory_alerts, etc.)
        """
        try:
            prefs = NotificationPreference.objects.get(user=user)
            pref_value = getattr(prefs, notification_type, 'web')
            return pref_value in ['email', 'both']
        except NotificationPreference.DoesNotExist:
            # Default to web-only if no preferences set
            return False
    
    @staticmethod
    def send_new_request_notification(request_obj):
        """Send email notification to admins when new request is created"""
        # Get admin users
        admin_users = User.objects.filter(
            Q(is_staff=True) | Q(is_superuser=True), 
            is_active=True
        )
        
        # Filter admins who want email notifications
        email_recipients = [
            user for user in admin_users 
            if EmailNotificationService.should_send_email(user, 'request_updates')
        ]
        
        if not email_recipients:
            logger.info("No admin users configured to receive email notifications for new requests")
            return False
        
        # Calculate total cost
        total_cost = (request_obj.quantity or 0) * (request_obj.unit_price or 0)
        
        context = {
            'request': request_obj,
            'total_cost': total_cost,
        }
        
        # Send individual emails to maintain privacy
        success_count = 0
        for recipient in email_recipients:
            context['recipient'] = recipient
            if EmailNotificationService.send_email_notification(
                recipients=[recipient],
                subject=f"New Request: {request_obj.item_name}",
                template_name='new_request',
                context=context
            ):
                success_count += 1
        
        logger.info(f"Sent new request notifications to {success_count}/{len(email_recipients)} admins")
        return success_count > 0
    
    @staticmethod
    def send_order_placed_notification(request_obj, placed_by_user=None):
        """Send email notification to requester when order is placed"""
        if not request_obj.requested_by:
            logger.warning(f"Request {request_obj.id} has no requester")
            return False
            
        # Check if user wants email notifications
        if not EmailNotificationService.should_send_email(request_obj.requested_by, 'request_updates'):
            logger.info(f"User {request_obj.requested_by.username} doesn't want email notifications")
            return False
        
        # Calculate total cost
        total_cost = (request_obj.quantity or 0) * (request_obj.unit_price or 0)
        
        context = {
            'request': request_obj,
            'total_cost': total_cost,
            'placed_by': placed_by_user,
            'recipient': request_obj.requested_by,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[request_obj.requested_by],
            subject=f"Order Placed: {request_obj.item_name}",
            template_name='order_placed',
            context=context
        )
    
    @staticmethod
    def send_item_received_notification(request_obj, received_by_user=None, quantity_received=None, location=None):
        """Send email notification to requester when item is received"""
        if not request_obj.requested_by:
            logger.warning(f"Request {request_obj.id} has no requester")
            return False
            
        # Check if user wants email notifications
        if not EmailNotificationService.should_send_email(request_obj.requested_by, 'request_updates'):
            logger.info(f"User {request_obj.requested_by.username} doesn't want email notifications")
            return False
        
        # Check for partial delivery
        quantity_received = quantity_received or request_obj.quantity
        partial_delivery = quantity_received < request_obj.quantity
        remaining_quantity = request_obj.quantity - quantity_received if partial_delivery else 0
        
        context = {
            'request': request_obj,
            'received_by': received_by_user,
            'quantity_received': quantity_received,
            'location': location,
            'partial_delivery': partial_delivery,
            'remaining_quantity': remaining_quantity,
            'recipient': request_obj.requested_by,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[request_obj.requested_by],
            subject=f"Item Received: {request_obj.item_name}",
            template_name='item_received',
            context=context
        )
    
    @staticmethod
    def send_weekly_inventory_summary():
        """Send weekly inventory summary to all users who want it"""
        from items.models import Item
        from datetime import timedelta
        
        # Get users who want weekly digest
        users_for_digest = User.objects.filter(
            is_active=True,
            notification_preferences__enable_weekly_digest=True
        )
        
        if not users_for_digest.exists():
            logger.info("No users configured to receive weekly inventory digest")
            return False
        
        # Get inventory data
        now = timezone.now()
        thirty_days_from_now = now + timedelta(days=30)
        
        # Get expired items
        expired_items = Item.objects.filter(
            expiration_date__lt=now.date(),
            quantity__gt=0
        ).select_related('location', 'vendor')
        
        # Get items expiring soon
        expiring_soon_items = Item.objects.filter(
            expiration_date__gte=now.date(),
            expiration_date__lte=thirty_days_from_now.date(),
            quantity__gt=0
        ).select_related('location', 'vendor')
        
        # Get low stock items (quantity <= 5 as example threshold)
        low_stock_items = Item.objects.filter(
            quantity__lte=5,
            quantity__gt=0
        ).select_related('location', 'vendor')
        
        # Calculate stats
        total_items = Item.objects.filter(quantity__gt=0).count()
        items_needing_attention = (
            expired_items.count() + 
            expiring_soon_items.count() + 
            low_stock_items.count()
        )
        
        context = {
            'expired_items': expired_items,
            'expiring_soon_items': expiring_soon_items,
            'low_stock_items': low_stock_items,
            'total_items': total_items,
            'items_needing_attention': items_needing_attention,
            'report_date': now,
        }
        
        # Send individual emails
        success_count = 0
        for user in users_for_digest:
            context['recipient'] = user
            if EmailNotificationService.send_email_notification(
                recipients=[user],
                subject="Weekly Inventory Summary",
                template_name='weekly_inventory_summary',
                context=context
            ):
                success_count += 1
        
        logger.info(f"Sent weekly inventory summary to {success_count}/{users_for_digest.count()} users")
        return success_count > 0