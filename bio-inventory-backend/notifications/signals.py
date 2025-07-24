from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import NotificationPreference
from .services import NotificationService


@receiver(post_save, sender=User)
def create_notification_preferences(sender, instance, created, **kwargs):
    """Create notification preferences when a new user is created"""
    if created:
        NotificationPreference.objects.get_or_create(user=instance)


# Automatic notification creation signals

@receiver(post_save, sender='items.Item')
def check_item_alerts(sender, instance, created, **kwargs):
    """Check for inventory alerts when item is updated"""
    if not created:  # Only check on updates, not creation
        if instance.expiration_status == 'EXPIRED':
            NotificationService.create_inventory_alert(
                item=instance,
                alert_type='expired'
            )
        elif instance.expiration_status == 'EXPIRING_SOON':
            NotificationService.create_inventory_alert(
                item=instance,
                alert_type='expiring_soon'
            )
        elif instance.is_low_stock:
            NotificationService.create_inventory_alert(
                item=instance,
                alert_type='low_stock'
            )


@receiver(post_save, sender='requests.Request')
def notify_request_status_change(sender, instance, created, **kwargs):
    """Send notification when request status changes"""
    if not created and hasattr(instance, '_previous_status'):
        # Only notify if status actually changed
        if instance.status != instance._previous_status:
            action_map = {
                'APPROVED': 'approved',
                'REJECTED': 'rejected',
                'ORDERED': 'ordered',
                'RECEIVED': 'received'
            }
            
            action = action_map.get(instance.status)
            if action:
                NotificationService.create_request_notification(
                    request_obj=instance,
                    action=action
                )


@receiver(pre_save, sender='requests.Request')
def store_previous_status(sender, instance, **kwargs):
    """Store previous status before saving to detect changes"""
    if instance.pk:
        try:
            previous = sender.objects.get(pk=instance.pk)
            instance._previous_status = previous.status
        except sender.DoesNotExist:
            instance._previous_status = None