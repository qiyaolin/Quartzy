from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import models
from django.db.models import Q
import logging
import re
from html import unescape

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
    def should_send_email(user, notification_type='request_updates'):
        """
        Check if user wants to receive email for this notification type
        Always return True for now (can be enhanced later with user preferences)
        """
        # Simple check - only send to admin users for now
        return user.is_staff and user.email
    
    @staticmethod
    def send_new_request_notification(request_obj):
        """Send email notification to admins when new request is created"""
        # Get admin users with email addresses
        admin_users = User.objects.filter(
            Q(is_staff=True) | Q(is_superuser=True), 
            is_active=True,
            email__isnull=False
        ).exclude(email='')
        
        if not admin_users:
            logger.info("No admin users with email addresses found")
            return False
        
        # Calculate total cost
        total_cost = (request_obj.quantity or 0) * (request_obj.unit_price or 0)
        
        context = {
            'request': request_obj,
            'total_cost': total_cost,
        }
        
        # Send individual emails to maintain privacy
        success_count = 0
        for admin_user in admin_users:
            context['recipient'] = admin_user
            if EmailNotificationService.send_email_notification(
                recipients=[admin_user],
                subject=f"New Request: {request_obj.item_name}",
                template_name='new_request',
                context=context
            ):
                success_count += 1
        
        logger.info(f"Sent new request notifications to {success_count}/{admin_users.count()} admins")
        return success_count > 0
    
    @staticmethod
    def send_order_placed_notification(request_obj, placed_by_user=None):
        """Send email notification to requester when order is placed"""
        if not request_obj.requested_by or not request_obj.requested_by.email:
            logger.warning(f"Request {request_obj.id} has no requester or requester has no email")
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
        if not request_obj.requested_by or not request_obj.requested_by.email:
            logger.warning(f"Request {request_obj.id} has no requester or requester has no email")
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
    def send_booking_confirmation(booking):
        """Send booking confirmation email to user"""
        if not booking.user or not booking.user.email:
            logger.warning(f"Booking {booking.id} has no user or user has no email")
            return False
        
        context = {
            'booking': booking,
            'recipient': booking.user,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[booking.user],
            subject=f"Booking Confirmed: {booking.equipment.name}",
            template_name='booking_confirmation',
            context=context
        )

    @staticmethod
    def send_booking_reminder(booking, minutes_until=15):
        """Send booking reminder email to user"""
        if not booking.user or not booking.user.email:
            logger.warning(f"Booking {booking.id} has no user or user has no email")
            return False
        
        context = {
            'booking': booking,
            'recipient': booking.user,
            'minutes_until': minutes_until,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[booking.user],
            subject=f"Reminder: {booking.equipment.name} booking in {minutes_until} minutes",
            template_name='booking_reminder',
            context=context
        )

    @staticmethod
    def send_journal_club_submission_reminder(presenter, days_remaining):
        """Send Journal Club paper submission reminder"""
        if not presenter.user or not presenter.user.email:
            logger.warning(f"Presenter {presenter.id} has no user or user has no email")
            return False
        
        context = {
            'presenter': presenter,
            'meeting': presenter.meeting_instance,
            'days_remaining': days_remaining,
            'recipient': presenter.user,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[presenter.user],
            subject=f"Journal Club Paper Submission - {days_remaining} Days Remaining",
            template_name='jc_materials_submission_reminder',
            context=context
        )

    @staticmethod
    def send_journal_club_final_reminder(presenter, admins=None):
        """Send Journal Club paper final deadline reminder"""
        recipients = [presenter.user] if presenter.user and presenter.user.email else []
        
        if admins:
            recipients.extend([admin for admin in admins if admin.email])
        
        if not recipients:
            logger.warning(f"No valid recipients for final reminder for presenter {presenter.id}")
            return False
        
        context = {
            'presenter': presenter,
            'meeting': presenter.meeting_instance,
            'recipient': presenter.user,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=recipients,
            subject="URGENT: Journal Club Paper - Final Reminder",
            template_name='jc_materials_submission_request',
            context=context
        )

    @staticmethod
    def send_research_update_reminder(presenters):
        """Send Research Update presentation reminder"""
        if not presenters:
            return False
        
        valid_presenters = [p for p in presenters if p.user and p.user.email]
        if not valid_presenters:
            logger.warning("No presenters with valid email addresses")
            return False
        
        context = {
            'presenters': valid_presenters,
            'meeting': valid_presenters[0].meeting_instance,
        }
        
        recipients = [p.user for p in valid_presenters]
        
        return EmailNotificationService.send_email_notification(
            recipients=recipients,
            subject="Research Update - 3 Day Reminder",
            template_name='presenter_special_reminder',
            context=context
        )

    @staticmethod
    def send_meeting_reminder_24h(meeting, all_members):
        """Send 24-hour meeting reminder to all members"""
        valid_members = [m for m in all_members if m.email]
        if not valid_members:
            logger.warning("No members with valid email addresses")
            return False
        
        context = {
            'meeting': meeting,
            'presenters': list(meeting.presenters.all()),
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=valid_members,
            subject=f"{meeting.get_meeting_type_display()} Tomorrow - {meeting.date}",
            template_name='meeting_reminder',
            context=context
        )

    @staticmethod
    def send_meeting_reminder_1h(meeting, all_members):
        """Send 1-hour meeting reminder to all members"""
        valid_members = [m for m in all_members if m.email]
        if not valid_members:
            logger.warning("No members with valid email addresses")
            return False
        
        context = {
            'meeting': meeting,
            'presenters': list(meeting.presenters.all()),
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=valid_members,
            subject=f"{meeting.get_meeting_type_display()} Starting in 1 Hour",
            template_name='meeting_reminder',
            context=context
        )

    @staticmethod
    def send_paper_distribution(meeting, all_members):
        """Send Journal Club paper distribution to all members"""
        valid_members = [m for m in all_members if m.email]
        if not valid_members:
            logger.warning("No members with valid email addresses")
            return False
        
        presenters_with_papers = meeting.presenters.filter(
            models.Q(paper_file__isnull=False) | models.Q(paper_url__isnull=False),
            materials_submitted_at__isnull=False
        )
        
        context = {
            'meeting': meeting,
            'presenters': list(presenters_with_papers),
            'papers': [
                {
                    'presenter': p.user.get_full_name() or p.user.username,
                    'title': p.paper_title,
                    'file': p.paper_file,
                    'url': p.paper_url
                }
                for p in presenters_with_papers
            ]
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=valid_members,
            subject=f"Journal Club Paper for {meeting.date}",
            template_name='jc_materials_distributed',
            context=context
        )

    @staticmethod
    def send_swap_request_notification(swap_request):
        """Send swap request notification to target user"""
        if not swap_request.target_presentation or not swap_request.target_presentation.user or not swap_request.target_presentation.user.email:
            logger.warning(f"Swap request {swap_request.id} has no valid target user email")
            return False
        
        context = {
            'swap_request': swap_request,
            'recipient': swap_request.target_presentation.user,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[swap_request.target_presentation.user],
            subject=f"Presentation Swap Request from {swap_request.requester.get_full_name() or swap_request.requester.username}",
            template_name='swap_request_notification',
            context=context
        )

    @staticmethod
    def send_postpone_request_notification(swap_request, admins):
        """Send postpone request notification to admins"""
        valid_admins = [admin for admin in admins if admin.email]
        if not valid_admins:
            logger.warning("No admins with valid email addresses")
            return False
        
        context = {
            'swap_request': swap_request,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=valid_admins,
            subject=f"Presentation Postponement Request from {swap_request.requester.get_full_name() or swap_request.requester.username}",
            template_name='postpone_request_notification',
            context=context
        )

    @staticmethod
    def send_swap_approved_notification(swap_request):
        """Send swap approval notification"""
        recipients = []
        
        if swap_request.requester and swap_request.requester.email:
            recipients.append(swap_request.requester)
        
        if swap_request.target_presentation and swap_request.target_presentation.user and swap_request.target_presentation.user.email:
            recipients.append(swap_request.target_presentation.user)
        
        if not recipients:
            logger.warning(f"No valid recipients for swap approval notification {swap_request.id}")
            return False
        
        context = {
            'swap_request': swap_request,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=recipients,
            subject="Presentation Swap Approved",
            template_name='booking_replaced_notification',
            context=context
        )

    @staticmethod
    def send_presenter_assignment_notification(presenter):
        """Send presenter assignment notification"""
        if not presenter.user or not presenter.user.email:
            logger.warning(f"Presenter {presenter.id} has no user or user has no email")
            return False
        
        context = {
            'presenter': presenter,
            'meeting': presenter.meeting_instance,
            'recipient': presenter.user,
        }
        
        return EmailNotificationService.send_email_notification(
            recipients=[presenter.user],
            subject=f"You have been assigned to present at {presenter.meeting_instance.get_meeting_type_display()}",
            template_name='presenter_assignment',
            context=context
        )