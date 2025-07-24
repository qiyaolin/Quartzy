from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from datetime import timedelta
from .models import Notification, NotificationPreference
from .email_service import EmailNotificationService


class NotificationService:
    """Service class for creating and managing notifications"""
    
    @staticmethod
    def create_notification(
        recipient, 
        title, 
        message, 
        notification_type='info',
        priority='medium',
        related_object=None,
        action_url=None,
        metadata=None,
        expires_in_hours=None
    ):
        """
        Create a new notification
        
        Args:
            recipient: User who should receive the notification
            title: Short notification title
            message: Detailed notification message
            notification_type: Type of notification (info, success, warning, error, etc.)
            priority: Priority level (low, medium, high, urgent)
            related_object: Optional related model instance
            action_url: Optional URL for clickable notifications
            metadata: Optional additional data as dict
            expires_in_hours: Optional hours until notification expires
        
        Returns:
            Notification instance
        """
        
        # Calculate expiry date if specified
        expires_at = None
        if expires_in_hours:
            expires_at = timezone.now() + timedelta(hours=expires_in_hours)
        
        # Set up content type and object id for related object
        content_type = None
        object_id = None
        if related_object:
            content_type = ContentType.objects.get_for_model(related_object)
            object_id = related_object.id
        
        notification = Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            content_type=content_type,
            object_id=object_id,
            action_url=action_url,
            metadata=metadata or {},
            expires_at=expires_at
        )
        
        return notification
    
    @staticmethod
    def create_bulk_notification(
        recipients,
        title,
        message,
        notification_type='info',
        priority='medium',
        **kwargs
    ):
        """
        Create notifications for multiple recipients
        
        Args:
            recipients: List of User instances or queryset
            title: Notification title
            message: Notification message
            notification_type: Type of notification
            priority: Priority level
            **kwargs: Additional arguments passed to create_notification
            
        Returns:
            List of created Notification instances
        """
        
        notifications = []
        for recipient in recipients:
            notification = NotificationService.create_notification(
                recipient=recipient,
                title=title,
                message=message,
                notification_type=notification_type,
                priority=priority,
                **kwargs
            )
            notifications.append(notification)
        
        return notifications
    
    @staticmethod
    def create_inventory_alert(item, alert_type, recipients=None):
        """
        Create inventory-related alerts
        
        Args:
            item: Item instance that triggered the alert
            alert_type: Type of alert (expired, expiring_soon, low_stock)
            recipients: List of users to notify (defaults to all active users)
        """
        
        if recipients is None:
            recipients = User.objects.filter(is_active=True)
        
        alert_messages = {
            'expired': {
                'title': f'Item Expired: {item.name}',
                'message': f'The item "{item.name}" has expired on {item.expiration_date}. Please check inventory.',
                'priority': 'high'
            },
            'expiring_soon': {
                'title': f'Item Expiring Soon: {item.name}',
                'message': f'The item "{item.name}" will expire on {item.expiration_date}. Consider using or replacing it.',
                'priority': 'medium'
            },
            'low_stock': {
                'title': f'Low Stock Alert: {item.name}',
                'message': f'The item "{item.name}" is running low (current quantity: {item.quantity}). Consider reordering.',
                'priority': 'medium'
            }
        }
        
        alert_config = alert_messages.get(alert_type)
        if not alert_config:
            raise ValueError(f"Invalid alert type: {alert_type}")
        
        return NotificationService.create_bulk_notification(
            recipients=recipients,
            title=alert_config['title'],
            message=alert_config['message'],
            notification_type='inventory_alert',
            priority=alert_config['priority'],
            related_object=item,
            action_url=f'/inventory?item_id={item.id}',
            metadata={'alert_type': alert_type, 'item_id': item.id},
            expires_in_hours=72  # Expire after 3 days
        )
    
    @staticmethod
    def create_request_notification(request_obj, action, user=None, recipients=None):
        """
        Create request-related notifications
        
        Args:
            request_obj: Request instance
            action: Action performed (approved, rejected, ordered, received, etc.)
            user: User who performed the action
            recipients: List of users to notify (defaults to request requester)
        """
        
        if recipients is None:
            recipients = [request_obj.requester] if hasattr(request_obj, 'requester') else []
        
        action_messages = {
            'approved': {
                'title': f'Request Approved: {request_obj.item_name}',
                'message': f'Your request for "{request_obj.item_name}" has been approved.',
                'type': 'success'
            },
            'rejected': {
                'title': f'Request Rejected: {request_obj.item_name}',
                'message': f'Your request for "{request_obj.item_name}" has been rejected.',
                'type': 'warning'
            },
            'ordered': {
                'title': f'Request Ordered: {request_obj.item_name}',
                'message': f'Your request for "{request_obj.item_name}" has been ordered.',
                'type': 'info'
            },
            'received': {
                'title': f'Request Received: {request_obj.item_name}',
                'message': f'Your request for "{request_obj.item_name}" has been received and added to inventory.',
                'type': 'success'
            }
        }
        
        message_config = action_messages.get(action)
        if not message_config:
            raise ValueError(f"Invalid action: {action}")
        
        # Add user info if provided
        if user:
            message_config['message'] = f"{message_config['message']} (by {user.get_full_name() or user.username})"
        
        notifications = NotificationService.create_bulk_notification(
            recipients=recipients,
            title=message_config['title'],
            message=message_config['message'],
            notification_type='request_update',
            priority='medium',
            related_object=request_obj,
            action_url=f'/requests?request_id={request_obj.id}',
            metadata={'action': action, 'request_id': request_obj.id}
        )
        
        # Send email notifications based on action type
        if action == 'ordered':
            EmailNotificationService.send_order_placed_notification(request_obj, user)
        elif action == 'received':
            EmailNotificationService.send_item_received_notification(request_obj, user)
        
        return notifications
    
    @staticmethod
    def create_system_notification(
        title,
        message,
        recipients=None,
        priority='medium',
        notification_type='system',
        **kwargs
    ):
        """
        Create system-wide notifications
        
        Args:
            title: Notification title
            message: Notification message
            recipients: List of users to notify (defaults to all active users)
            priority: Priority level
            notification_type: Type of notification
            **kwargs: Additional arguments
        """
        
        if recipients is None:
            recipients = User.objects.filter(is_active=True)
        
        return NotificationService.create_bulk_notification(
            recipients=recipients,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            **kwargs
        )
    
    @staticmethod
    def cleanup_expired_notifications():
        """Remove expired notifications"""
        now = timezone.now()
        expired_count, _ = Notification.objects.filter(
            expires_at__lt=now
        ).delete()
        return expired_count
    
    @staticmethod
    def get_user_preferences(user):
        """Get notification preferences for a user"""
        preferences, created = NotificationPreference.objects.get_or_create(user=user)
        return preferences
    
    @staticmethod
    def notify_new_request_created(request_obj):
        """
        Send notifications when a new request is created
        
        Args:
            request_obj: Request instance that was created
        """
        # Send email notification to admins
        EmailNotificationService.send_new_request_notification(request_obj)
        
        # Create web notifications for admins
        admin_users = User.objects.filter(
            is_staff=True, is_active=True
        )
        
        if admin_users.exists():
            return NotificationService.create_bulk_notification(
                recipients=admin_users,
                title=f'New Request: {request_obj.item_name}',
                message=f'A new request for "{request_obj.item_name}" has been submitted by {request_obj.requested_by.get_full_name() or request_obj.requested_by.username} and requires approval.',
                notification_type='request_update',
                priority='medium',
                related_object=request_obj,
                action_url=f'/requests?request_id={request_obj.id}',
                metadata={'action': 'created', 'request_id': request_obj.id}
            )
        
        return []