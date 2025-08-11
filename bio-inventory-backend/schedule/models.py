from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
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
        help_text="Time slot user is waiting for",
        null=True, blank=True  # Temporarily allow null to handle migration
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
        # unique_together = ('equipment', 'time_slot', 'user')  # 临时注释，迁移完成后恢复
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

    def save(self, *args, **kwargs):
        # 强制将 next_presenter_index 转换为有效的整数
        try:
            numeric_index = int(self.next_presenter_index)
            if numeric_index < 0:
                numeric_index = 0
            self.next_presenter_index = numeric_index
        except (ValueError, TypeError, AttributeError):
            self.next_presenter_index = 0
        
        # 使用数据库高效的方式获取用户数量
        users_count = self.user_list.count()
        if users_count > 0:
            # 使用取模运算确保索引始终在有效范围内
            self.next_presenter_index %= users_count
        else:
            # 如果没有用户，则重置索引
            self.next_presenter_index = 0
            
        super().save(*args, **kwargs)

    def get_next_presenter(self):
        """获取下一个报告人"""
        users = self.user_list.all()
        users_count = users.count()

        if users_count == 0:
            return None
        
        # save 方法已确保索引始终有效且在范围内
        return users[self.next_presenter_index]

    def advance_presenter(self):
        """轮换到下一个报告人"""
        users_count = self.user_list.count()
        if users_count > 0:
            # save 方法将处理取模运算
            self.next_presenter_index += 1
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
    """Specific task instance"""
    
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
        help_text="Associated recurring task"
    )
    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name='task_instance',
        help_text="Associated event"
    )
    assigned_to = models.ManyToManyField(
        User,
        related_name='assigned_tasks',
        help_text="Assigned users"
    )
    status = models.CharField(
        max_length=20,
        choices=TASK_STATUS_CHOICES,
        default='pending',
        help_text="Task status"
    )
    completion_notes = models.TextField(blank=True, null=True, help_text="Completion notes")
    completed_at = models.DateTimeField(null=True, blank=True, help_text="Completion time")
    
    def mark_completed(self, notes=None):
        """Mark task as completed"""
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


# ===============================================
# Enhanced Periodic Task Management Models  
# ===============================================

class TaskTemplate(models.Model):
    """Task template defining recurring task rules"""
    
    TYPE_CHOICES = [
        ('recurring', 'Recurring'),
        ('one_time', 'One Time'),
    ]
    
    CATEGORY_CHOICES = [
        ('system', 'System'),
        ('custom', 'Custom'),
    ]
    
    FREQUENCY_CHOICES = [
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('custom', 'Custom'),
    ]
    
    WINDOW_TYPE_CHOICES = [
        ('fixed', 'Fixed'),
        ('flexible', 'Flexible'),
    ]
    
    WINDOW_POSITION_CHOICES = [
        ('start', 'Month Start'),
        ('middle', 'Month Middle'),
        ('end', 'Month End'),
    ]
    
    PRIORITY_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    
    # Basic information
    name = models.CharField(max_length=255, help_text="Task template name")
    description = models.TextField(blank=True, null=True, help_text="Task description")
    task_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='recurring')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='custom')
    
    # Recurrence configuration
    frequency = models.CharField(
        max_length=20, 
        choices=FREQUENCY_CHOICES, 
        blank=True, 
        null=True,
        help_text="Frequency for recurring tasks"
    )
    interval = models.PositiveIntegerField(
        default=1, 
        help_text="Frequency multiplier (e.g., 3 for every 3 months)"
    )
    start_date = models.DateField(
        default=timezone.now,
        help_text="Task series start date"
    )
    end_date = models.DateField(
        blank=True, 
        null=True, 
        help_text="Task series end date (optional)"
    )
    
    # Execution requirements
    min_people = models.PositiveIntegerField(default=1, help_text="Minimum people required")
    max_people = models.PositiveIntegerField(default=2, help_text="Maximum people allowed")
    default_people = models.PositiveIntegerField(default=1, help_text="Default people to assign")
    estimated_hours = models.FloatField(
        blank=True, 
        null=True, 
        help_text="Estimated hours to complete"
    )
    
    # Time window configuration
    window_type = models.CharField(
        max_length=20, 
        choices=WINDOW_TYPE_CHOICES, 
        default='fixed'
    )
    # Fixed window settings
    fixed_start_day = models.PositiveIntegerField(
        blank=True, 
        null=True, 
        help_text="Start day of month for fixed window"
    )
    fixed_end_day = models.PositiveIntegerField(
        blank=True, 
        null=True, 
        help_text="End day of month for fixed window"
    )
    # Flexible window settings  
    flexible_position = models.CharField(
        max_length=20, 
        choices=WINDOW_POSITION_CHOICES, 
        blank=True, 
        null=True
    )
    flexible_duration = models.PositiveIntegerField(
        blank=True, 
        null=True, 
        help_text="Duration in days for flexible window"
    )
    
    # Settings
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='created_task_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def should_generate_for_period(self, period_str):
        """Check if task should be generated for given period (YYYY-MM format)"""
        from datetime import datetime
        period_date = datetime.strptime(period_str, '%Y-%m').date()
        
        if not self.is_active:
            return False
            
        if self.task_type == 'one_time':
            return False
            
        if period_date < self.start_date.replace(day=1):
            return False
            
        if self.end_date and period_date > self.end_date.replace(day=1):
            return False
        
        # Calculate if this period matches the frequency
        months_since_start = (period_date.year - self.start_date.year) * 12 + \
                           (period_date.month - self.start_date.month)
        
        if self.frequency == 'monthly':
            return months_since_start % self.interval == 0
        elif self.frequency == 'quarterly':
            return months_since_start % (3 * self.interval) == 0
        elif self.frequency == 'weekly':
            # For weekly tasks, generate monthly but check specific weeks
            return True
        elif self.frequency == 'biweekly':
            return True
        
        return False
    
    def get_execution_window(self, period_str):
        """Get execution window for given period"""
        from datetime import datetime
        import calendar
        
        year, month = map(int, period_str.split('-'))
        
        if self.window_type == 'fixed':
            start_day = min(self.fixed_start_day or 25, 
                          calendar.monthrange(year, month)[1])
            end_day = min(self.fixed_end_day or 31, 
                        calendar.monthrange(year, month)[1])
            
            start_date = datetime(year, month, start_day).date()
            end_date = datetime(year, month, end_day).date()
            
        else:  # flexible
            days_in_month = calendar.monthrange(year, month)[1]
            duration = self.flexible_duration or 7
            
            if self.flexible_position == 'start':
                start_date = datetime(year, month, 1).date()
                end_date = datetime(year, month, min(duration, days_in_month)).date()
            elif self.flexible_position == 'middle':
                mid_point = days_in_month // 2
                start_day = max(1, mid_point - duration // 2)
                end_day = min(days_in_month, start_day + duration - 1)
                start_date = datetime(year, month, start_day).date()
                end_date = datetime(year, month, end_day).date()
            else:  # end
                end_day = days_in_month
                start_day = max(1, end_day - duration + 1)
                start_date = datetime(year, month, start_day).date()
                end_date = datetime(year, month, end_day).date()
        
        return start_date, end_date
    
    def __str__(self):
        return f"{self.name} ({self.get_frequency_display() if self.frequency else 'One-time'})"
    
    class Meta:
        ordering = ['name']


class PeriodicTaskInstance(models.Model):
    """Individual task instance generated from template"""
    
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Template reference
    template = models.ForeignKey(
        TaskTemplate, 
        on_delete=models.CASCADE, 
        related_name='task_instances'
    )
    template_name = models.CharField(max_length=255, help_text="Template name at creation time")
    
    # Time information
    scheduled_period = models.CharField(
        max_length=7, 
        help_text="Period in YYYY-MM format"
    )
    execution_start_date = models.DateField(help_text="Execution window start date")
    execution_end_date = models.DateField(help_text="Execution window end date")
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    
    # Assignment tracking
    original_assignees = models.JSONField(
        default=list, 
        help_text="Original assignee user IDs"
    )
    current_assignees = models.JSONField(
        default=list, 
        help_text="Current assignee user IDs after swaps"
    )
    assignment_metadata = models.JSONField(
        default=dict, 
        help_text="Assignment roles and timestamps"
    )
    
    # Completion information
    completed_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='completed_periodic_tasks'
    )
    completed_at = models.DateTimeField(blank=True, null=True)
    completion_duration = models.PositiveIntegerField(
        blank=True, 
        null=True, 
        help_text="Actual completion time in minutes"
    )
    completion_notes = models.TextField(blank=True, null=True)
    completion_photos = models.JSONField(
        default=list, 
        help_text="List of photo URLs"
    )
    completion_rating = models.PositiveIntegerField(
        blank=True, 
        null=True, 
        help_text="Self-rating 1-5"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def get_assignees(self):
        """Get current assignee User objects"""
        if not self.current_assignees:
            return User.objects.none()
        return User.objects.filter(id__in=self.current_assignees)
    
    def get_primary_assignee(self):
        """Get primary assignee if specified in metadata"""
        metadata = self.assignment_metadata or {}
        primary_id = metadata.get('primary_assignee')
        if primary_id:
            try:
                return User.objects.get(id=primary_id)
            except User.DoesNotExist:
                pass
        # Fall back to first assignee
        assignees = self.get_assignees()
        return assignees.first() if assignees.exists() else None
    
    def is_overdue(self):
        """Check if task is overdue"""
        from datetime import date
        return (self.status in ['scheduled', 'pending', 'in_progress'] and 
                date.today() > self.execution_end_date)
    
    def can_be_completed_by(self, user):
        """Check if user can mark this task as complete"""
        return user.id in self.current_assignees
    
    def can_be_claimed(self, user):
        """Check if a user can claim this task"""
        if self.status != 'scheduled' and self.status != 'pending':
            return False
        if self.template.task_type != 'one_time':
            return False
        if len(self.current_assignees) >= self.template.max_people:
            return False
        if user.id in self.current_assignees:
            return False  # Already assigned
        return True
    
    def claim_task(self, user):
        """Claim task for a user"""
        if not self.can_be_claimed(user):
            raise ValueError("Task cannot be claimed by this user")
        
        current_assignees = list(self.current_assignees)
        if user.id not in current_assignees:
            current_assignees.append(user.id)
            self.current_assignees = current_assignees
        
        if self.status == 'scheduled':
            self.status = 'pending'
        if len(current_assignees) >= self.template.min_people and self.status == 'pending':
            self.status = 'in_progress'
        
        self.save()
    
    def mark_completed(self, user, **kwargs):
        """Mark task as completed"""
        if not self.can_be_completed_by(user):
            raise ValueError("User not assigned to this task")
        
        self.status = 'completed'
        self.completed_by = user
        self.completed_at = timezone.now()
        
        # Update optional completion data
        for field in ['completion_duration', 'completion_notes', 
                     'completion_photos', 'completion_rating']:
            if field in kwargs:
                setattr(self, field, kwargs[field])
        
        self.save()
    
    def add_status_change(self, from_status, to_status, changed_by, reason=None):
        """Record status change"""
        StatusChangeRecord.objects.create(
            task_instance=self,
            from_status=from_status,
            to_status=to_status,
            changed_by=changed_by,
            reason=reason
        )
    
    def __str__(self):
        return f"{self.template_name} - {self.scheduled_period} ({self.get_status_display()})"
    
    class Meta:
        ordering = ['-scheduled_period', 'execution_start_date']
        indexes = [
            models.Index(fields=['scheduled_period']),
            models.Index(fields=['status']),
            models.Index(fields=['execution_start_date']),
            models.Index(fields=['execution_end_date']),
        ]


class StatusChangeRecord(models.Model):
    """Record of task status changes"""
    
    task_instance = models.ForeignKey(
        PeriodicTaskInstance, 
        on_delete=models.CASCADE, 
        related_name='status_history'
    )
    from_status = models.CharField(max_length=20)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, on_delete=models.CASCADE)
    changed_at = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-changed_at']


class TaskRotationQueue(models.Model):
    """Rotation queue for fair task assignment"""
    
    ALGORITHM_CHOICES = [
        ('fair_rotation', 'Fair Rotation'),
        ('random', 'Random'),
        ('sequential', 'Sequential'),
    ]
    
    template = models.OneToOneField(
        TaskTemplate, 
        on_delete=models.CASCADE, 
        related_name='rotation_queue'
    )
    algorithm = models.CharField(
        max_length=20, 
        choices=ALGORITHM_CHOICES, 
        default='fair_rotation'
    )
    last_updated = models.DateTimeField(auto_now=True)
    
    # Configuration
    min_gap_months = models.PositiveIntegerField(
        default=1, 
        help_text="Minimum months between assignments for same person"
    )
    consider_workload = models.BooleanField(
        default=True, 
        help_text="Consider overall workload balance"
    )
    random_factor = models.FloatField(
        default=0.1, 
        help_text="Random factor weight (0-1)"
    )
    
    def get_queue_members(self):
        """Get all queue members ordered by priority"""
        return self.queue_members.filter(is_active=True).order_by('-priority_score')
    
    def get_available_members(self, period_str):
        """Get members available for given period"""
        members = self.get_queue_members()
        
        # Filter out members on leave for this period
        available_members = []
        for member in members:
            exclude_periods = member.availability_data.get('exclude_periods', [])
            if period_str not in exclude_periods:
                available_members.append(member)
        
        return available_members
    
    def assign_members_for_period(self, period_str, required_count=None):
        """Assign members using configured algorithm"""
        if not required_count:
            required_count = self.template.default_people
        
        available_members = self.get_available_members(period_str)
        
        if len(available_members) < required_count:
            raise ValueError(f"Not enough available members: {len(available_members)} < {required_count}")
        
        if self.algorithm == 'fair_rotation':
            return self._fair_rotation_assignment(available_members, period_str, required_count)
        elif self.algorithm == 'random':
            import random
            return random.sample(available_members, required_count)
        else:  # sequential
            return available_members[:required_count]
    
    def _fair_rotation_assignment(self, available_members, period_str, required_count):
        """Implement fair rotation algorithm"""
        import random
        from datetime import datetime
        
        period_date = datetime.strptime(period_str, '%Y-%m').date()
        
        # Calculate scores for each member
        scored_members = []
        for member in available_members:
            score = self._calculate_member_priority(member, period_date)
            scored_members.append((member, score))
        
        # Sort by score (higher is better)
        scored_members.sort(key=lambda x: x[1], reverse=True)
        
        # Select top members
        selected = [member for member, score in scored_members[:required_count]]
        
        # Update assignment statistics
        for member in selected:
            member.update_assignment_stats(period_str)
        
        return selected
    
    def _calculate_member_priority(self, member, target_date):
        """Calculate priority score for member"""
        base_score = 100.0
        
        # Factor 1: Time since last assignment
        if member.last_assigned_period:
            last_period_date = datetime.strptime(member.last_assigned_period, '%Y-%m').date()
            months_gap = (target_date.year - last_period_date.year) * 12 + \
                        (target_date.month - last_period_date.month)
            base_score += months_gap * 20  # 20 points per month
        else:
            base_score += 200  # Never assigned bonus
        
        # Factor 2: Total assignment balance
        avg_assignments = self.queue_members.filter(is_active=True).aggregate(
            avg_count=models.Avg('total_assignments')
        )['avg_count'] or 0
        
        assignment_difference = avg_assignments - member.total_assignments
        base_score += assignment_difference * 30  # 30 points per assignment difference
        
        # Factor 3: Completion rate
        base_score += member.completion_rate * 10  # Max 10 points for 100% completion
        
        # Factor 4: Random factor
        import random
        base_score += random.random() * self.random_factor * 20
        
        return max(0, base_score)
    
    def __str__(self):
        return f"Rotation Queue for {self.template.name}"
    
    class Meta:
        verbose_name = "Task Rotation Queue"


class QueueMember(models.Model):
    """Member in a task rotation queue"""
    
    rotation_queue = models.ForeignKey(
        TaskRotationQueue, 
        on_delete=models.CASCADE, 
        related_name='queue_members'
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Assignment statistics
    total_assignments = models.PositiveIntegerField(default=0)
    last_assigned_date = models.DateTimeField(blank=True, null=True)
    last_assigned_period = models.CharField(
        max_length=7, 
        blank=True, 
        null=True,
        help_text="Last assigned period in YYYY-MM format"
    )
    completion_rate = models.FloatField(
        default=100.0, 
        help_text="Completion rate percentage"
    )
    average_completion_time = models.FloatField(
        blank=True, 
        null=True, 
        help_text="Average completion time in hours"
    )
    priority_score = models.FloatField(default=50.0)
    
    # Availability settings
    is_active = models.BooleanField(default=True)
    availability_data = models.JSONField(
        default=dict, 
        help_text="Availability preferences and exclusions"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def update_assignment_stats(self, period_str):
        """Update statistics after assignment"""
        self.total_assignments += 1
        self.last_assigned_date = timezone.now()
        self.last_assigned_period = period_str
        self.save()
    
    def update_completion_stats(self, completion_time_hours=None):
        """Update completion statistics"""
        # Recalculate completion rate
        completed_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[self.user.id],
            status='completed'
        ).count()
        
        total_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[self.user.id]
        ).count()
        
        if total_tasks > 0:
            self.completion_rate = (completed_tasks / total_tasks) * 100
        
        # Update average completion time
        if completion_time_hours:
            if self.average_completion_time:
                # Simple moving average
                self.average_completion_time = (self.average_completion_time + completion_time_hours) / 2
            else:
                self.average_completion_time = completion_time_hours
        
        self.save()
    
    def set_unavailable_periods(self, periods):
        """Set periods when user is unavailable"""
        data = self.availability_data or {}
        data['exclude_periods'] = periods
        self.availability_data = data
        self.save()
    
    def is_available_for_period(self, period_str):
        """Check if user is available for given period"""
        if not self.is_active:
            return False
        
        exclude_periods = self.availability_data.get('exclude_periods', [])
        return period_str not in exclude_periods
    
    def __str__(self):
        return f"{self.user.username} in {self.rotation_queue.template.name} queue"
    
    class Meta:
        unique_together = ['rotation_queue', 'user']
        ordering = ['-priority_score']


class TaskSwapRequest(models.Model):
    """Task swap/transfer request"""
    
    REQUEST_TYPE_CHOICES = [
        ('swap', 'Swap with another user'),
        ('transfer', 'Transfer to another user'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    
    task_instance = models.ForeignKey(
        PeriodicTaskInstance, 
        on_delete=models.CASCADE, 
        related_name='swap_requests'
    )
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Request details
    from_user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='outgoing_swap_requests'
    )
    to_user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='incoming_swap_requests',
        blank=True,
        null=True,
        help_text="Target user for direct swap/transfer"
    )
    reason = models.TextField(help_text="Reason for the request")
    
    # Approval tracking
    target_user_approved = models.BooleanField(
        null=True, 
        blank=True,
        help_text="Target user approval for swap requests"
    )
    target_user_approved_at = models.DateTimeField(blank=True, null=True)
    admin_approved = models.BooleanField(
        null=True, 
        blank=True,
        help_text="Admin approval if required"
    )
    admin_approved_at = models.DateTimeField(blank=True, null=True)
    admin_approved_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='approved_task_swaps'
    )
    
    # Public pool settings
    is_public_pool = models.BooleanField(
        default=False, 
        help_text="Published to public swap pool"
    )
    pool_published_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def can_approve(self):
        """Check if request can be approved"""
        if self.request_type == 'swap' and self.to_user:
            return (self.target_user_approved == True and 
                   (self.admin_approved == True or not self._requires_admin_approval()))
        else:  # transfer or pool request
            return self.admin_approved == True or not self._requires_admin_approval()
    
    def _requires_admin_approval(self):
        """Check if admin approval is required"""
        # This could be configurable per task template or system-wide
        return True  # Default: require admin approval
    
    def approve_by_target_user(self):
        """Approve by target user"""
        if self.request_type != 'swap' or not self.to_user:
            raise ValueError("Invalid request type for target user approval")
        
        self.target_user_approved = True
        self.target_user_approved_at = timezone.now()
        
        if self.can_approve():
            self.status = 'approved'
            self._execute_swap()
        
        self.save()
    
    def approve_by_admin(self, admin_user, force_execute: bool = True):
        """Approve by admin.
        If force_execute is True, execute swap immediately for direct swap requests
        (request_type == 'swap' and to_user is set), without waiting for target user approval.
        """
        self.admin_approved = True
        self.admin_approved_at = timezone.now()
        self.admin_approved_by = admin_user

        executed = False

        # For direct swap requests, allow admin approval to immediately finalize the swap
        if force_execute and self.request_type == 'swap' and self.to_user:
            # Mark as fully approved and execute assignment change
            if self.target_user_approved is not True:
                self.target_user_approved = True
                self.target_user_approved_at = timezone.now()
            self.status = 'approved'
            self._execute_swap()
            executed = True
        else:
            # Fallback to existing rule: execute only when all approvals satisfied
            if self.can_approve():
                self.status = 'approved'
                self._execute_swap()
                executed = True

        self.save()
        return executed
    
    def reject(self, reason=None):
        """Reject the request"""
        self.status = 'rejected'
        if reason:
            self.reason += f"\n\nRejection reason: {reason}"
        self.save()
    
    def publish_to_pool(self):
        """Publish request to public swap pool"""
        self.is_public_pool = True
        self.pool_published_at = timezone.now()
        self.save()
    
    def claim_from_pool(self, claiming_user):
        """Claim request from public pool"""
        if not self.is_public_pool:
            raise ValueError("Request not in public pool")
        
        self.to_user = claiming_user
        self.is_public_pool = False
        
        if self.request_type == 'swap':
            # For swap, still need target user approval
            self.target_user_approved = True
            self.target_user_approved_at = timezone.now()
        
        if self.can_approve():
            self.status = 'approved'
            self._execute_swap()
        
        self.save()
    
    def _execute_swap(self):
        """Execute the approved swap/transfer"""
        task = self.task_instance
        current_assignees = list(task.current_assignees)
        
        if self.from_user.id not in current_assignees:
            raise ValueError("From user not in current assignees")
        
        # Remove from user
        current_assignees.remove(self.from_user.id)
        
        # Add to user (if not already there)
        if self.to_user and self.to_user.id not in current_assignees:
            current_assignees.append(self.to_user.id)
        
        task.current_assignees = current_assignees
        task.save()
        
        # Update assignment metadata
        metadata = task.assignment_metadata or {}
        swap_record = {
            'type': self.request_type,
            'from_user': self.from_user.id,
            'to_user': self.to_user.id if self.to_user else None,
            'executed_at': timezone.now().isoformat(),
            'request_id': self.id
        }
        
        if 'swap_history' not in metadata:
            metadata['swap_history'] = []
        metadata['swap_history'].append(swap_record)
        
        task.assignment_metadata = metadata
        task.save()
    
    def __str__(self):
        return f"{self.get_request_type_display()} - {self.from_user.username} ({self.get_status_display()})"
    
    class Meta:
        ordering = ['-created_at']


class NotificationRecord(models.Model):
    """Record of notifications sent for periodic tasks"""
    
    NOTIFICATION_TYPE_CHOICES = [
        ('assignment', 'Task Assignment'),
        ('reminder', 'Task Reminder'),
        ('overdue', 'Task Overdue'),
        ('swap_request', 'Swap Request'),
        ('swap_approved', 'Swap Approved'),
        ('completion', 'Task Completion'),
    ]
    
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('in_app', 'In-App'),
        ('both', 'Both'),
    ]
    
    task_instance = models.ForeignKey(
        PeriodicTaskInstance, 
        on_delete=models.CASCADE, 
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='email')
    
    sent_to_users = models.JSONField(
        default=list, 
        help_text="List of user IDs who received notification"
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    content_summary = models.TextField(help_text="Summary of notification content")
    
    # Tracking
    email_sent = models.BooleanField(default=False)
    email_errors = models.JSONField(default=list, help_text="Email sending errors")
    
    def mark_as_read(self, user):
        """Mark notification as read by user (for in-app notifications)"""
        # This could be extended with a separate read tracking table
        pass
    
    def __str__(self):
        return f"{self.get_notification_type_display()} for {self.task_instance}"
    
    class Meta:
        ordering = ['-sent_at']


# ===============================================
# Intelligent Meeting Management Models
# ===============================================

class MeetingConfiguration(models.Model):
    """Global meeting configuration - only one instance allowed"""
    
    WEEKDAY_CHOICES = [
        (0, 'Sunday'), (1, 'Monday'), (2, 'Tuesday'), (3, 'Wednesday'),
        (4, 'Thursday'), (5, 'Friday'), (6, 'Saturday')
    ]
    
    POSTPONE_STRATEGY_CHOICES = [
        ('skip', 'Skip this occurrence'),
        ('cascade', 'Cascade all subsequent meetings')
    ]
    
    # Schedule settings
    day_of_week = models.IntegerField(
        choices=WEEKDAY_CHOICES, 
        default=1, 
        help_text="Day of week for regular meetings (0=Sunday)"
    )
    start_time = models.TimeField(
        default='10:00',
        help_text="Regular meeting start time"
    )
    location = models.CharField(
        max_length=255,
        default='Conference Room',
        help_text="Default meeting location"
    )
    
    # Duration settings (in minutes)
    research_update_duration = models.PositiveIntegerField(
        default=120,
        help_text="Research Update meeting duration in minutes"
    )
    journal_club_duration = models.PositiveIntegerField(
        default=60,
        help_text="Journal Club meeting duration in minutes"
    )
    
    # Notification settings
    jc_submission_deadline_days = models.PositiveIntegerField(
        default=7,
        help_text="Journal Club paper submission deadline (days before meeting)"
    )
    jc_final_deadline_days = models.PositiveIntegerField(
        default=3,
        help_text="Journal Club paper final deadline (days before meeting)"
    )
    
    # Meeting management settings
    require_admin_approval = models.BooleanField(
        default=True,
        help_text="Require admin approval for swap/postpone requests"
    )
    default_postpone_strategy = models.CharField(
        max_length=20,
        choices=POSTPONE_STRATEGY_CHOICES,
        default='skip',
        help_text="Default strategy when postponing meetings"
    )
    
    # Active members list
    active_members = models.ManyToManyField(
        User,
        related_name='meeting_configuration_members',
        help_text="Current active lab members"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_meeting_configs',
        help_text="Admin who created this configuration"
    )
    
    def save(self, *args, **kwargs):
        # Ensure only one configuration exists
        if not self.pk and MeetingConfiguration.objects.exists():
            raise ValueError("Only one meeting configuration is allowed")
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Meeting Config - {self.get_day_of_week_display()} at {self.start_time}"
    
    class Meta:
        verbose_name = "Meeting Configuration"
        verbose_name_plural = "Meeting Configurations"


class MeetingInstance(models.Model):
    """Individual meeting instance"""
    
    MEETING_TYPE_CHOICES = [
        ('research_update', 'Research Update'),
        ('journal_club', 'Journal Club'),
        ('special', 'Special Meeting')
    ]
    
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('postponed', 'Postponed')
    ]
    
    # Basic meeting info
    date = models.DateField(help_text="Meeting date")
    meeting_type = models.CharField(
        max_length=20,
        choices=MEETING_TYPE_CHOICES,
        help_text="Type of meeting"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='scheduled',
        help_text="Meeting status"
    )
    
    # Associated event
    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name='meeting_instance',
        help_text="Associated calendar event"
    )
    
    # Meeting details
    actual_duration = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Actual meeting duration in minutes"
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Meeting notes"
    )
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.get_meeting_type_display()} - {self.date}"
    
    class Meta:
        ordering = ['date']
        unique_together = ['date', 'meeting_type']


class Presenter(models.Model):
    """Presenter information for a meeting"""
    
    STATUS_CHOICES = [
        ('assigned', 'Assigned'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('swapped', 'Swapped'),
        ('postponed', 'Postponed')
    ]
    
    meeting_instance = models.ForeignKey(
        MeetingInstance,
        on_delete=models.CASCADE,
        related_name='presenters',
        help_text="Associated meeting"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='presentations',
        help_text="Presenter user"
    )
    order = models.PositiveIntegerField(
        default=1,
        help_text="Presentation order (for multiple presenters)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='assigned',
        help_text="Presenter status"
    )
    
    # Content
    topic = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Presentation topic (for Research Updates)"
    )
    
    # Materials
    paper_title = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Paper title for Journal Club"
    )
    paper_url = models.URLField(
        blank=True,
        null=True,
        help_text="Paper URL"
    )
    paper_file = models.FileField(
        upload_to='journal_club_papers/',
        blank=True,
        null=True,
        help_text="Paper PDF file"
    )
    slides_file = models.FileField(
        upload_to='meeting_slides/',
        blank=True,
        null=True,
        help_text="Presentation slides"
    )
    materials_submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When materials were submitted"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.meeting_instance}"
    
    class Meta:
        ordering = ['meeting_instance__date', 'order']
        unique_together = ['meeting_instance', 'user']


class RotationSystem(models.Model):
    """Presenter rotation system"""
    
    name = models.CharField(
        max_length=255,
        default="Default Rotation",
        help_text="Rotation system name"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this rotation system is active"
    )
    
    # Rotation rules
    min_gap_between_presentations = models.PositiveIntegerField(
        default=4,
        help_text="Minimum weeks between presentations for the same person"
    )
    max_consecutive_presenters = models.PositiveIntegerField(
        default=2,
        help_text="Maximum consecutive presenters in one meeting"
    )
    fairness_weight = models.FloatField(
        default=1.0,
        help_text="Weight for fairness calculation"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Rotation System"


class QueueEntry(models.Model):
    """Individual queue entry for presenter rotation"""
    
    rotation_system = models.ForeignKey(
        RotationSystem,
        on_delete=models.CASCADE,
        related_name='queue_entries',
        help_text="Associated rotation system"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='rotation_queue_entries',
        help_text="User in rotation queue"
    )
    
    # Queue position and scheduling
    next_scheduled_date = models.DateField(
        null=True,
        blank=True,
        help_text="Next scheduled presentation date"
    )
    last_presented_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of last presentation"
    )
    postpone_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times presentation was postponed"
    )
    priority = models.FloatField(
        default=50.0,
        help_text="Priority score calculated by fairness algorithm"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def calculate_priority(self):
        """Calculate priority based on fairness algorithm"""
        # Implementation of fairness calculation
        base_score = 100.0
        
        # Add points for time since last presentation
        if self.last_presented_date:
            days_since = (timezone.now().date() - self.last_presented_date).days
            weeks_since = days_since / 7
            base_score += weeks_since * 10
        else:
            base_score += 200  # Never presented before
        
        # Subtract points for postponements
        base_score -= self.postpone_count * 20
        
        self.priority = max(0, base_score)
        self.save()
        
        return self.priority
    
    def __str__(self):
        return f"{self.user.username} - Priority: {self.priority}"
    
    class Meta:
        ordering = ['-priority', 'last_presented_date']
        unique_together = ['rotation_system', 'user']


class SwapRequest(models.Model):
    """Request for swapping or postponing presentations"""
    
    REQUEST_TYPE_CHOICES = [
        ('swap', 'Swap with another presenter'),
        ('postpone', 'Postpone presentation')
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled')
    ]
    
    # Request details
    request_type = models.CharField(
        max_length=20,
        choices=REQUEST_TYPE_CHOICES,
        help_text="Type of request"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Request status"
    )
    
    # Requester and original presentation
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='swap_requests',
        help_text="User making the request"
    )
    original_presentation = models.ForeignKey(
        Presenter,
        on_delete=models.CASCADE,
        related_name='original_swap_requests',
        help_text="Original presentation to be swapped/postponed"
    )
    
    # Swap details (for swap requests)
    target_presentation = models.ForeignKey(
        Presenter,
        on_delete=models.CASCADE,
        related_name='target_swap_requests',
        null=True,
        blank=True,
        help_text="Target presentation to swap with"
    )
    
    # Request details
    reason = models.TextField(help_text="Reason for the request")
    
    # Approval tracking
    target_user_approved = models.BooleanField(
        null=True,
        blank=True,
        help_text="Whether target user approved the swap"
    )
    target_user_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When target user approved"
    )
    admin_approved = models.BooleanField(
        null=True,
        blank=True,
        help_text="Whether admin approved the request"
    )
    admin_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When admin approved"
    )
    admin_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_swap_requests',
        help_text="Admin who approved the request"
    )
    
    # Cascading effect (for postpone requests)
    cascade_effect = models.CharField(
        max_length=20,
        choices=[('skip', 'Skip'), ('cascade', 'Cascade')],
        null=True,
        blank=True,
        help_text="How postponement affects subsequent meetings"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def can_approve(self):
        """Check if request can be approved"""
        if self.request_type == 'swap':
            return (self.target_user_approved == True and 
                   self.admin_approved == True)
        else:  # postpone
            return self.admin_approved == True
    
    def approve_by_target_user(self, user):
        """Approve by target user (for swap requests)"""
        if (self.request_type == 'swap' and 
            self.target_presentation and 
            self.target_presentation.user == user):
            self.target_user_approved = True
            self.target_user_approved_at = timezone.now()
            self.save()
    
    def approve_by_admin(self, admin_user):
        """Approve by admin"""
        self.admin_approved = True
        self.admin_approved_at = timezone.now()
        self.admin_approved_by = admin_user
        
        # If all approvals are in place, mark as approved
        if self.can_approve():
            self.status = 'approved'
        
        self.save()
    
    def reject(self, reason=None):
        """Reject the request"""
        self.status = 'rejected'
        if reason:
            self.reason += f"\n\nRejection reason: {reason}"
        self.save()
    
    def __str__(self):
        return f"{self.get_request_type_display()} - {self.requester.username} ({self.status})"
    
    class Meta:
        ordering = ['-created_at']


class PresentationHistory(models.Model):
    """Historical record of presentations"""
    
    presenter = models.ForeignKey(
        Presenter,
        on_delete=models.CASCADE,
        related_name='history_records',
        help_text="Presenter record"
    )
    
    # Analytics data
    presentation_count = models.PositiveIntegerField(
        default=0,
        help_text="Total number of presentations by this user"
    )
    total_duration = models.PositiveIntegerField(
        default=0,
        help_text="Total presentation time in minutes"
    )
    average_rating = models.FloatField(
        null=True,
        blank=True,
        help_text="Average presentation rating"
    )
    
    # Metadata
    archived_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"History - {self.presenter.user.username}"
    
    class Meta:
        ordering = ['-archived_at']
        verbose_name = "Presentation History"
        verbose_name_plural = "Presentation Histories"


class CalendarSyncRecord(models.Model):
    """Track synchronization between local schedule objects and Google Calendar"""
    
    SYNC_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('error', 'Error'),
        ('disabled', 'Disabled'),
    ]
    
    # Generic foreign key to support multiple model types
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Google Calendar information
    google_event_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Google Calendar event ID"
    )
    
    # Sync status
    sync_enabled = models.BooleanField(
        default=True,
        help_text="Whether sync is enabled for this object"
    )
    sync_status = models.CharField(
        max_length=20,
        choices=SYNC_STATUS_CHOICES,
        default='pending',
        help_text="Current sync status"
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Error message if sync failed"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last successful sync timestamp"
    )
    
    def __str__(self):
        return f"Sync: {self.content_type} {self.object_id} -> {self.google_event_id}"
    
    class Meta:
        unique_together = ('content_type', 'object_id')
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['google_event_id']),
            models.Index(fields=['sync_status']),
        ]
        verbose_name = "Calendar Sync Record"
        verbose_name_plural = "Calendar Sync Records"