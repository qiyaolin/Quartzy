from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import uuid


class Event(models.Model):
    """通用事件模型，作为所有日程类型的核心"""
    
    EVENT_TYPE_CHOICES = [
        ('meeting', 'Meeting'),
        ('booking', 'Booking'),
        ('task', 'Task'),
    ]
    
    title = models.CharField(max_length=255, help_text="事件标题")
    start_time = models.DateTimeField(help_text="开始时间")
    end_time = models.DateTimeField(help_text="结束时间")
    event_type = models.CharField(
        max_length=20, 
        choices=EVENT_TYPE_CHOICES,
        help_text="事件类型"
    )
    description = models.TextField(blank=True, null=True, help_text="事件描述")
    created_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='created_events',
        help_text="创建者"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} ({self.get_event_type_display()})"
    
    class Meta:
        ordering = ['start_time']


def generate_equipment_qr_code():
    """Generate a unique QR code for equipment"""
    return f"BSC-{uuid.uuid4().hex[:8].upper()}"


class Equipment(models.Model):
    """Equipment model for bookings with QR code check-in/out support"""
    
    name = models.CharField(max_length=255, help_text="Equipment name, e.g., Microscope, BSC")
    description = models.TextField(blank=True, null=True, help_text="Equipment description")
    is_bookable = models.BooleanField(default=True, help_text="Whether equipment can be booked")
    requires_qr_checkin = models.BooleanField(default=False, help_text="Whether QR code check-in is required")
    location = models.CharField(max_length=255, blank=True, help_text="Equipment location")
    
    # QR Code functionality
    qr_code = models.CharField(
        max_length=50, 
        unique=True, 
        null=True, 
        blank=True, 
        help_text="Unique QR code for check-in/out"
    )
    
    # Current usage tracking
    current_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='currently_using_equipment',
        help_text="User currently using this equipment"
    )
    current_checkin_time = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When current user checked in"
    )
    is_in_use = models.BooleanField(
        default=False,
        help_text="Whether equipment is currently in use"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        # Auto-generate QR code for equipment that requires QR check-in
        if self.requires_qr_checkin and not self.qr_code:
            self.qr_code = generate_equipment_qr_code()
        super().save(*args, **kwargs)
    
    def check_in_user(self, user):
        """Check in a user to this equipment"""
        if self.is_in_use:
            raise ValueError(f"Equipment {self.name} is already in use by {self.current_user}")
        
        self.current_user = user
        self.current_checkin_time = timezone.now()
        self.is_in_use = True
        self.save()
        
        # Create usage log entry
        EquipmentUsageLog.objects.create(
            equipment=self,
            user=user,
            check_in_time=self.current_checkin_time
        )
    
    def check_out_user(self, user=None):
        """Check out the current user from this equipment"""
        if not self.is_in_use:
            raise ValueError(f"Equipment {self.name} is not currently in use")
        
        if user and self.current_user != user:
            raise ValueError(f"Only {self.current_user} can check out from {self.name}")
        
        # Update usage log
        usage_log = EquipmentUsageLog.objects.filter(
            equipment=self,
            user=self.current_user,
            is_active=True
        ).first()
        
        if usage_log:
            usage_log.check_out_time = timezone.now()
            usage_log.usage_duration = usage_log.check_out_time - usage_log.check_in_time
            usage_log.is_active = False
            usage_log.save()
        
        # Clear current usage
        self.current_user = None
        self.current_checkin_time = None
        self.is_in_use = False
        self.save()
        
        return usage_log
    
    @property
    def current_usage_duration(self):
        """Get current usage duration if equipment is in use"""
        if self.is_in_use and self.current_checkin_time:
            return timezone.now() - self.current_checkin_time
        return None
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']


class Booking(models.Model):
    """Equipment booking model with enhanced features"""
    
    BOOKING_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
        ('in_progress', 'In Progress'),
    ]
    
    event = models.OneToOneField(
        Event, 
        on_delete=models.CASCADE,
        related_name='booking',
        help_text="Associated event"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bookings',
        help_text="Booking user"
    )
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.CASCADE,
        related_name='bookings',
        help_text="Booked equipment"
    )
    status = models.CharField(
        max_length=20,
        choices=BOOKING_STATUS_CHOICES,
        default='pending',
        help_text="Booking status"
    )
    waiting_list = models.ManyToManyField(
        User,
        related_name='waiting_bookings',
        blank=True,
        help_text="Users in waiting list"
    )
    notes = models.TextField(blank=True, null=True, help_text="Booking notes")
    
    # Early finish tracking
    actual_end_time = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Actual time when equipment usage ended"
    )
    early_finish_notified = models.BooleanField(
        default=False,
        help_text="Whether early finish notification was sent"
    )
    
    def check_for_early_finish(self):
        """Check if booking finished early and notify if needed"""
        if (self.actual_end_time and 
            self.actual_end_time < self.event.end_time and 
            not self.early_finish_notified):
            
            # Find next booking on same equipment for same day
            next_booking = Booking.objects.filter(
                equipment=self.equipment,
                event__start_time__date=self.event.start_time.date(),
                event__start_time__gt=self.event.end_time,
                status='confirmed'
            ).order_by('event__start_time').first()
            
            if next_booking:
                # Send early finish notification
                self.send_early_finish_notification(next_booking)
                self.early_finish_notified = True
                self.save()
    
    def send_early_finish_notification(self, next_booking):
        """Send notification to next booking user about early availability"""
        from notifications.email_service import EmailNotificationService
        
        time_saved = self.event.end_time - self.actual_end_time
        
        context = {
            'next_booking': next_booking,
            'early_booking': self,
            'equipment': self.equipment,
            'time_saved_minutes': int(time_saved.total_seconds() / 60)
        }
        
        EmailNotificationService.send_email_notification(
            recipients=[next_booking.user],
            subject=f"Equipment Available Early: {self.equipment.name}",
            template_name='early_equipment_availability',
            context=context
        )
    
    @property
    def is_time_conflict(self):
        """Check if this booking conflicts with another confirmed booking"""
        conflicts = Booking.objects.filter(
            equipment=self.equipment,
            status='confirmed',
            event__start_time__lt=self.event.end_time,
            event__end_time__gt=self.event.start_time
        ).exclude(id=self.id)
        
        return conflicts.exists()
    
    def __str__(self):
        return f"{self.user.username} - {self.equipment.name} ({self.status})"
    
    class Meta:
        ordering = ['event__start_time']


class EquipmentUsageLog(models.Model):
    """Detailed logging of equipment usage sessions"""
    
    SCAN_METHOD_CHOICES = [
        ('mobile_camera', 'Mobile Camera'),
        ('desktop_webcam', 'Desktop Webcam'),
        ('manual_entry', 'Manual Entry'),
    ]
    
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.CASCADE,
        related_name='usage_logs',
        help_text="Equipment being used"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='equipment_usage_logs',
        help_text="User using the equipment"
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usage_logs',
        help_text="Associated booking if any"
    )
    
    # Time tracking
    check_in_time = models.DateTimeField(help_text="When user checked in")
    check_out_time = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When user checked out"
    )
    usage_duration = models.DurationField(
        null=True,
        blank=True,
        help_text="Total usage duration"
    )
    
    # Method and notes
    qr_scan_method = models.CharField(
        max_length=20,
        choices=SCAN_METHOD_CHOICES,
        default='mobile_camera',
        help_text="Method used to scan QR code"
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Additional usage notes"
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this is an active usage session"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def current_duration(self):
        """Get current usage duration for active sessions"""
        if self.is_active:
            return timezone.now() - self.check_in_time
        return self.usage_duration
    
    def __str__(self):
        status = "Active" if self.is_active else "Completed"
        return f"{self.user.username} - {self.equipment.name} ({status})"
    
    class Meta:
        ordering = ['-check_in_time']
        indexes = [
            models.Index(fields=['equipment', 'check_in_time']),
            models.Index(fields=['user', 'check_in_time']),
            models.Index(fields=['is_active']),
            models.Index(fields=['check_in_time']),
        ]


class WaitingQueueEntry(models.Model):
    """Enhanced waiting queue for equipment bookings"""
    
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('notified', 'Notified'),
        ('converted_to_booking', 'Converted to Booking'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.CASCADE,
        related_name='waiting_queue',
        help_text="Equipment user is waiting for"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='waiting_queue_entries',
        help_text="User in waiting queue"
    )
    time_slot = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='waiting_queue',
        help_text="Time slot user is waiting for"
    )
    
    # Queue details
    position = models.PositiveIntegerField(help_text="Position in queue")
    requested_start_time = models.DateTimeField(
        help_text="When user wants to start using equipment"
    )
    requested_end_time = models.DateTimeField(
        help_text="When user plans to finish using equipment"
    )
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='waiting',
        help_text="Status of queue entry"
    )
    notification_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When notification was sent to user"
    )
    expires_at = models.DateTimeField(
        help_text="When this queue entry expires"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        # Set expiry time if not set (24 hours from creation)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)
    
    def notify_user(self):
        """Send notification to user that slot is available"""
        from notifications.email_service import EmailNotificationService
        
        context = {
            'queue_entry': self,
            'equipment': self.equipment,
            'time_slot': self.time_slot,
        }
        
        success = EmailNotificationService.send_email_notification(
            recipients=[self.user],
            subject=f"Equipment Available: {self.equipment.name}",
            template_name='equipment_queue_notification',
            context=context
        )
        
        if success:
            self.status = 'notified'
            self.notification_sent_at = timezone.now()
            self.save()
        
        return success
    
    def convert_to_booking(self):
        """Convert queue entry to actual booking"""
        # Create new booking based on queue entry
        from .serializers import BookingSerializer
        
        # Create event for the booking
        event = Event.objects.create(
            title=f"{self.equipment.name} Booking",
            start_time=self.requested_start_time,
            end_time=self.requested_end_time,
            event_type='booking',
            created_by=self.user
        )
        
        # Create booking
        booking = Booking.objects.create(
            event=event,
            user=self.user,
            equipment=self.equipment,
            status='confirmed',
            notes=f"Converted from waiting queue position {self.position}"
        )
        
        # Update queue entry status
        self.status = 'converted_to_booking'
        self.save()
        
        return booking
    
    @property
    def is_expired(self):
        """Check if queue entry has expired"""
        return timezone.now() > self.expires_at
    
    def __str__(self):
        return f"{self.user.username} - {self.equipment.name} (Pos: {self.position})"
    
    class Meta:
        ordering = ['equipment', 'position']
        unique_together = ('equipment', 'time_slot', 'user')
        indexes = [
            models.Index(fields=['equipment', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['expires_at']),
        ]


class GroupMeeting(models.Model):
    """组会特有信息"""
    
    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name='group_meeting',
        help_text="关联的事件"
    )
    topic = models.CharField(max_length=255, help_text="组会主题")
    presenter = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='presented_meetings',
        help_text="报告人"
    )
    materials_url = models.URLField(blank=True, null=True, help_text="资料链接")
    materials_file = models.FileField(
        upload_to='meeting_materials/',
        blank=True,
        null=True,
        help_text="资料文件"
    )
    
    def __str__(self):
        presenter_name = self.presenter.username if self.presenter else "未指定"
        return f"{self.topic} - {presenter_name}"
    
    class Meta:
        ordering = ['event__start_time']


class MeetingPresenterRotation(models.Model):
    """组会报告人轮值列表"""
    
    name = models.CharField(max_length=255, help_text="轮值列表名称")
    user_list = models.ManyToManyField(
        User,
        related_name='rotation_lists',
        help_text="轮值用户列表"
    )
    next_presenter_index = models.PositiveIntegerField(default=0, help_text="下一个报告人索引")
    is_active = models.BooleanField(default=True, help_text="是否激活")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def get_next_presenter(self):
        """获取下一个报告人"""
        users = list(self.user_list.all())
        if not users:
            return None
        
        if self.next_presenter_index >= len(users):
            self.next_presenter_index = 0
            self.save()
        
        return users[self.next_presenter_index]
    
    def advance_presenter(self):
        """轮换到下一个报告人"""
        users_count = self.user_list.count()
        if users_count > 0:
            self.next_presenter_index = (self.next_presenter_index + 1) % users_count
            self.save()
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']


class RecurringTask(models.Model):
    """周期性任务模板"""
    
    title = models.CharField(max_length=255, help_text="任务标题")
    description = models.TextField(blank=True, null=True, help_text="任务描述")
    cron_schedule = models.CharField(
        max_length=100,
        help_text="Cron格式的调度规则，如 'last friday of month'"
    )
    assignee_group = models.ManyToManyField(
        User,
        related_name='recurring_tasks',
        help_text="任务分配组"
    )
    is_active = models.BooleanField(default=True, help_text="是否激活")
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_recurring_tasks',
        help_text="创建者"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} ({self.cron_schedule})"
    
    class Meta:
        ordering = ['title']


class TaskInstance(models.Model):
    """具体的任务实例"""
    
    TASK_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    recurring_task = models.ForeignKey(
        RecurringTask,
        on_delete=models.CASCADE,
        related_name='instances',
        null=True,
        blank=True,
        help_text="关联的周期性任务"
    )
    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name='task_instance',
        help_text="关联的事件"
    )
    assigned_to = models.ManyToManyField(
        User,
        related_name='assigned_tasks',
        help_text="分配给的用户"
    )
    status = models.CharField(
        max_length=20,
        choices=TASK_STATUS_CHOICES,
        default='pending',
        help_text="任务状态"
    )
    completion_notes = models.TextField(blank=True, null=True, help_text="完成备注")
    completed_at = models.DateTimeField(null=True, blank=True, help_text="完成时间")
    
    def mark_completed(self, notes=None):
        """标记任务为完成"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        if notes:
            self.completion_notes = notes
        self.save()
    
    def __str__(self):
        task_title = self.recurring_task.title if self.recurring_task else self.event.title
        return f"{task_title} - {self.get_status_display()}"
    
    class Meta:
        ordering = ['event__start_time']