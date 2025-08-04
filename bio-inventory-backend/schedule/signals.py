from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Booking, EquipmentUsageLog
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def send_booking_confirmation_email(sender, instance, created, **kwargs):
    """Send confirmation email when booking is created or confirmed"""
    from notifications.email_service import EmailNotificationService
    
    # Send confirmation email for new bookings or when status changes to confirmed
    if created or (instance.status == 'confirmed' and not getattr(instance, '_confirmation_sent', False)):
        try:
            EmailNotificationService.send_booking_confirmation(instance)
            # Mark as sent to avoid duplicate emails
            instance._confirmation_sent = True
            logger.info(f"Sent booking confirmation email for booking {instance.id}")
        except Exception as e:
            logger.error(f"Failed to send booking confirmation email for booking {instance.id}: {e}")


@receiver(post_save, sender=EquipmentUsageLog)
def handle_equipment_usage_notifications(sender, instance, created, **kwargs):
    """Handle notifications when equipment usage starts or ends"""
    
    # If this is a new check-in (created=True and is_active=True)
    if created and instance.is_active:
        logger.info(f"Equipment {instance.equipment.name} checked in by {instance.user.username}")
        
        # Could add check-in notification here if needed
        # EmailNotificationService.send_checkin_notification(instance)
    
    # If this is a check-out (usage session ended)
    elif not created and not instance.is_active and instance.check_out_time:
        logger.info(f"Equipment {instance.equipment.name} checked out by {instance.user.username}")
        
        # Check if any booking finished early and notify next user
        if hasattr(instance, 'booking') and instance.booking:
            instance.booking.actual_end_time = instance.check_out_time
            instance.booking.check_for_early_finish()


@receiver(pre_save, sender=Booking)
def track_booking_status_changes(sender, instance, **kwargs):
    """Track booking status changes to avoid duplicate confirmation emails"""
    if instance.pk:
        try:
            old_instance = Booking.objects.get(pk=instance.pk)
            # If status is changing from something other than confirmed to confirmed
            if old_instance.status != 'confirmed' and instance.status == 'confirmed':
                instance._status_changed_to_confirmed = True
            else:
                instance._status_changed_to_confirmed = False
        except Booking.DoesNotExist:
            instance._status_changed_to_confirmed = False
    else:
        instance._status_changed_to_confirmed = False