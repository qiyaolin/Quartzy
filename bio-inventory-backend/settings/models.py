from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator


class SystemSetting(models.Model):
    """System-wide settings that only admins can modify"""
    SETTING_TYPES = [
        ('TEXT', 'Text'),
        ('NUMBER', 'Number'),
        ('BOOLEAN', 'Boolean'),
        ('EMAIL', 'Email'),
    ]
    
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    setting_type = models.CharField(max_length=10, choices=SETTING_TYPES, default='TEXT')
    description = models.TextField(blank=True)
    is_admin_only = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'system_settings'
        ordering = ['key']

    def __str__(self):
        return f"{self.key}: {self.value}"


class UserPreference(models.Model):
    """User-specific preferences that users can modify"""
    THEME_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('auto', 'Auto'),
    ]
    
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('fr', 'French'),
        ('zh', 'Chinese'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='light')
    language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='en')
    email_notifications = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)
    items_per_page = models.IntegerField(
        default=10, 
        validators=[MinValueValidator(5), MaxValueValidator(100)]
    )
    auto_refresh_interval = models.IntegerField(
        default=30,  # seconds
        validators=[MinValueValidator(10), MaxValueValidator(300)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_preferences'

    def __str__(self):
        return f"{self.user.username} preferences"