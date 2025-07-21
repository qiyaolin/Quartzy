# requests/signals.py
from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Request, RequestHistory

@receiver(pre_save, sender=Request)
def log_request_status_change(sender, instance, **kwargs):
    """
    Log the status change of a Request to RequestHistory before it is saved.
    """
    # We only care about existing instances that are being updated
    if instance.pk:
        try:
            old_instance = Request.objects.get(pk=instance.pk)
            # Check if the status has actually changed
            if old_instance.status != instance.status:
                RequestHistory.objects.create(
                    request=instance,
                    # In a real app, you'd get the user from the request context
                    user=instance.requested_by, 
                    old_status=old_instance.status,
                    new_status=instance.status
                )
        except Request.DoesNotExist:
            # This is a new instance, so there's no history to log
            pass
