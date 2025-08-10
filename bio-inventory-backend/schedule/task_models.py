# Enhanced Task Management Models
# This file extends the existing schedule models to support the improved task management system

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid


class TaskTemplate(models.Model):
    """
    Template for creating task instances (both recurring and one-time)
    Compatible with existing TaskTemplate model but with enhanced features
    """
    TASK_TYPE_CHOICES = [
        ('recurring', 'Recurring Task'),
        ('one_time', 'One-Time Task'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low Priority'),
        ('medium', 'Medium Priority'),
        ('high', 'High Priority'),
    ]
    
    CATEGORY_CHOICES = [
        ('system', 'System Generated'),
        ('custom', 'Custom Task'),
    ]
    
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
    ]

    # Basic Information
    name = models.CharField(max_length=200, help_text="Task name/title")
    description = models.TextField(help_text="Detailed task description")
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default='one_time')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='custom')
    
    # Scheduling (for recurring tasks)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, blank=True, null=True)
    interval = models.PositiveIntegerField(default=1, help_text="Repeat every N frequency units")
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(blank=True, null=True, help_text="Optional end date for recurring tasks")
    
    # Assignment Configuration
    min_people = models.PositiveIntegerField(default=1)
    max_people = models.PositiveIntegerField(default=1)
    default_people = models.PositiveIntegerField(default=1)
    
    # Additional Settings
    estimated_hours = models.DecimalField(max_digits=4, decimal_places=1, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'schedule_enhanced_task_template'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.get_task_type_display()})"
    
    def clean(self):
        """Validate model data"""
        if self.task_type == 'recurring' and not self.frequency:
            raise ValidationError('Frequency is required for recurring tasks')
        
        if self.min_people > self.max_people:
            raise ValidationError('Minimum people cannot exceed maximum people')
        
        if self.default_people < self.min_people or self.default_people > self.max_people:
            raise ValidationError('Default people must be between minimum and maximum')
        
        if self.end_date and self.end_date <= self.start_date:
            raise ValidationError('End date must be after start date')


class TaskInstance(models.Model):
    """
    Individual task instance (created from templates)
    Compatible with existing PeriodicTaskInstance but enhanced
    """
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('pending', 'Pending Assignment'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]

    # Core Information
    template = models.ForeignKey(TaskTemplate, on_delete=models.CASCADE, related_name='instances')
    template_name = models.CharField(max_length=200)  # Snapshot for history
    
    # Execution Window
    scheduled_period = models.CharField(max_length=50, blank=True)  # e.g., "2024-01-W4", "2024-01"
    execution_start_date = models.DateField()
    execution_end_date = models.DateField()
    
    # Assignment and Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    original_assignees = models.ManyToManyField(
        User, 
        related_name='original_task_assignments', 
        blank=True,
        help_text="Originally assigned users"
    )
    current_assignees = models.ManyToManyField(
        User, 
        related_name='current_task_assignments', 
        blank=True,
        help_text="Currently assigned users"
    )
    
    # Completion Information
    completed_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='completed_tasks'
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    completion_notes = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'schedule_enhanced_task_instance'
        ordering = ['execution_end_date', '-created_at']
        indexes = [
            models.Index(fields=['status', 'execution_end_date']),
            models.Index(fields=['template', 'scheduled_period']),
        ]
    
    def __str__(self):
        return f"{self.template_name} - {self.scheduled_period}"
    
    @property
    def is_overdue(self):
        """Check if task is overdue"""
        if self.status in ['completed', 'cancelled']:
            return False
        return timezone.now().date() > self.execution_end_date
    
    @property
    def days_until_due(self):
        """Calculate days until due (negative if overdue)"""
        today = timezone.now().date()
        return (self.execution_end_date - today).days
    
    def can_be_claimed(self, user):
        """Check if a user can claim this task"""
        if self.status != 'pending':
            return False
        if self.template.task_type != 'one_time':
            return False
        if self.current_assignees.count() >= self.template.max_people:
            return False
        return True
    
    def claim_task(self, user):
        """Claim task for a user"""
        if not self.can_be_claimed(user):
            raise ValidationError("Task cannot be claimed by this user")
        
        self.current_assignees.add(user)
        if self.status == 'pending':
            self.status = 'in_progress'
        self.save()
    
    def complete_task(self, user, notes=''):
        """Mark task as completed"""
        if user not in self.current_assignees.all():
            raise ValidationError("Only assigned users can complete the task")
        
        self.status = 'completed'
        self.completed_by = user
        self.completed_at = timezone.now()
        self.completion_notes = notes
        self.save()


class TaskAssignmentRotation(models.Model):
    """
    Manages rotation of task assignments for recurring tasks
    """
    template = models.OneToOneField(TaskTemplate, on_delete=models.CASCADE, related_name='rotation')
    eligible_users = models.ManyToManyField(User, related_name='task_rotations')
    last_assigned_users = models.ManyToManyField(
        User, 
        related_name='last_assigned_rotations', 
        blank=True
    )
    rotation_position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'schedule_task_assignment_rotation'
    
    def get_next_assignees(self, count=None):
        """Get next users in rotation"""
        if count is None:
            count = self.template.default_people
        
        eligible = list(self.eligible_users.all())
        if not eligible:
            return []
        
        # Simple rotation logic - can be enhanced with more sophisticated algorithms
        selected = []
        current_pos = self.rotation_position
        
        for i in range(count):
            if len(selected) < len(eligible):
                user = eligible[current_pos % len(eligible)]
                if user not in selected:
                    selected.append(user)
                current_pos += 1
        
        # Update rotation position
        self.rotation_position = current_pos % len(eligible)
        self.save()
        
        return selected


class TaskNotificationSetting(models.Model):
    """
    User-specific notification settings for tasks
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='task_notification_settings')
    email_notifications = models.BooleanField(default=True)
    reminder_days = models.PositiveIntegerField(default=1, help_text="Days before due date to send reminder")
    daily_digest = models.BooleanField(default=False)
    overdue_alerts = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'schedule_task_notification_setting'
    
    def __str__(self):
        return f"Notification settings for {self.user.username}"


class TaskNotification(models.Model):
    """
    Individual notification records
    """
    NOTIFICATION_TYPE_CHOICES = [
        ('assignment', 'Task Assignment'),
        ('reminder', 'Due Date Reminder'),
        ('overdue', 'Overdue Alert'),
        ('completion_required', 'Completion Required'),
        ('completion_confirmed', 'Completion Confirmed'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    task_instance = models.ForeignKey(TaskInstance, on_delete=models.CASCADE, related_name='notifications')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    
    # Scheduling
    scheduled_date = models.DateTimeField()
    sent_date = models.DateTimeField(null=True, blank=True)
    
    # Status
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)
    
    # Content
    email_subject = models.CharField(max_length=200)
    email_content = models.TextField()
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'schedule_task_notification'
        ordering = ['-scheduled_date']
        indexes = [
            models.Index(fields=['status', 'scheduled_date']),
            models.Index(fields=['user', 'notification_type']),
        ]
    
    def __str__(self):
        return f"{self.get_notification_type_display()} for {self.user.username}"


class TaskSwapRequest(models.Model):
    """
    Requests for swapping task assignments between users
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    task_instance = models.ForeignKey(TaskInstance, on_delete=models.CASCADE, related_name='swap_requests')
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_swap_requests')
    target_user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='task_swap_offers',
        null=True, 
        blank=True
    )
    
    reason = models.TextField(help_text="Reason for swap request")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Response
    responded_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='task_swap_responses'
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    response_notes = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'schedule_task_swap_request'
        ordering = ['-created_at']
    
    def __str__(self):
        target = self.target_user.username if self.target_user else "Any available user"
        return f"Swap request: {self.requester.username} → {target}"
    
    def approve(self, approver, notes=''):
        """Approve the swap request"""
        if self.status != 'pending':
            raise ValidationError("Only pending requests can be approved")
        
        # Perform the swap
        if self.target_user:
            # Remove requester and add target user
            self.task_instance.current_assignees.remove(self.requester)
            self.task_instance.current_assignees.add(self.target_user)
        
        self.status = 'approved'
        self.responded_by = approver
        self.responded_at = timezone.now()
        self.response_notes = notes
        self.save()
    
    def reject(self, rejector, notes=''):
        """Reject the swap request"""
        if self.status != 'pending':
            raise ValidationError("Only pending requests can be rejected")
        
        self.status = 'rejected'
        self.responded_by = rejector
        self.responded_at = timezone.now()
        self.response_notes = notes
        self.save()


# Helper function to create task instances from templates
def create_task_instance_from_template(template, execution_start_date, execution_end_date, 
                                     scheduled_period='', assignees=None):
    """
    Create a TaskInstance from a TaskTemplate
    """
    instance = TaskInstance.objects.create(
        template=template,
        template_name=template.name,
        scheduled_period=scheduled_period,
        execution_start_date=execution_start_date,
        execution_end_date=execution_end_date,
        status='pending' if template.task_type == 'one_time' else 'scheduled'
    )
    
    if assignees:
        instance.original_assignees.set(assignees)
        instance.current_assignees.set(assignees)
        if template.task_type == 'one_time':
            instance.status = 'in_progress'
            instance.save()
    
    return instance