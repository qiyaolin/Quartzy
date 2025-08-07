from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class NotificationManager(models.Manager):
    def for_user(self, user):
        """Get notifications for a specific user"""
        return self.filter(recipient=user)
    
    def unread(self):
        """Get unread notifications"""
        return self.filter(is_read=False)
    
    def mark_all_read(self, user):
        """Mark all notifications as read for a user"""
        return self.filter(recipient=user, is_read=False).update(is_read=True)


class Notification(models.Model):
    TYPE_CHOICES = [
        ('info', 'Information'),
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('inventory_alert', 'Inventory Alert'),
        ('request_update', 'Request Update'),
        ('system', 'System'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    recipient = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='notifications',
        help_text="User who should receive this notification"
    )
    
    title = models.CharField(
        max_length=255,
        help_text="Short notification title"
    )
    
    message = models.TextField(
        help_text="Detailed notification message"
    )
    
    notification_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default='info',
        help_text="Type of notification"
    )
    
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='medium',
        help_text="Priority level of the notification"
    )
    
    is_read = models.BooleanField(
        default=False,
        help_text="Whether the notification has been read"
    )
    
    is_dismissed = models.BooleanField(
        default=False,
        help_text="Whether the notification has been dismissed"
    )
    
    # Generic relation to link to any model
    content_type = models.ForeignKey(
        ContentType, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        help_text="Type of related object"
    )
    object_id = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="ID of related object"
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Action URL for clickable notifications
    action_url = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        help_text="URL to navigate to when notification is clicked"
    )
    
    # Metadata for additional context
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata for the notification"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Expiry for temporary notifications
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this notification should expire (optional)"
    )
    
    objects = NotificationManager()
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
            models.Index(fields=['notification_type', 'priority']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.recipient.username}"
    
    def mark_as_read(self):
        """Mark this notification as read"""
        self.is_read = True
        self.save(update_fields=['is_read', 'updated_at'])
    
    def mark_as_dismissed(self):
        """Mark this notification as dismissed"""
        self.is_dismissed = True
        self.save(update_fields=['is_dismissed', 'updated_at'])
    
    @property
    def is_expired(self):
        """Check if notification has expired"""
        if not self.expires_at:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at


class NotificationPreference(models.Model):
    """User preferences for notification types"""
    
    DELIVERY_CHOICES = [
        ('web', 'Web Only'),
        ('email', 'Email Only'),
        ('both', 'Web and Email'),
        ('none', 'Disabled'),
    ]
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    
    # Inventory notifications
    inventory_alerts = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='web',
        help_text="How to receive inventory alerts (expired/low stock)"
    )
    
    # Request notifications
    request_updates = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='web',
        help_text="How to receive request status updates"
    )
    
    # System notifications
    system_notifications = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='web',
        help_text="How to receive system notifications"
    )
    
    # Budget/funding notifications
    funding_alerts = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='web',
        help_text="How to receive funding/budget alerts"
    )
    
    # Periodic task notifications
    task_assignments = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='both',
        help_text="How to receive task assignment notifications"
    )
    
    task_reminders = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='both',
        help_text="How to receive task deadline reminders"
    )
    
    task_swaps = models.CharField(
        max_length=10,
        choices=DELIVERY_CHOICES,
        default='web',
        help_text="How to receive task swap request notifications"
    )
    
    # Email digest settings
    enable_daily_digest = models.BooleanField(
        default=False,
        help_text="Send daily digest of notifications via email"
    )
    
    enable_weekly_digest = models.BooleanField(
        default=False,
        help_text="Send weekly digest of notifications via email"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Notification preferences for {self.user.username}"
    
    @classmethod
    def get_or_create_for_user(cls, user):
        """Get or create notification preferences for a user"""
        preferences, created = cls.objects.get_or_create(user=user)
        return preferences