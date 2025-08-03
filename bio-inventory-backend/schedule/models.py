from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


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


class Equipment(models.Model):
    """用于预约的设备模型"""
    
    name = models.CharField(max_length=255, help_text="设备名称，如显微镜、BSC")
    description = models.TextField(blank=True, null=True, help_text="设备描述")
    is_bookable = models.BooleanField(default=True, help_text="是否可预约")
    requires_qr_checkin = models.BooleanField(default=False, help_text="是否需要二维码签到")
    location = models.CharField(max_length=255, blank=True, help_text="设备位置")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']


class Booking(models.Model):
    """设备预约模型"""
    
    BOOKING_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    
    event = models.OneToOneField(
        Event, 
        on_delete=models.CASCADE,
        related_name='booking',
        help_text="关联的事件"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bookings',
        help_text="预约用户"
    )
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.CASCADE,
        related_name='bookings',
        help_text="预约设备"
    )
    status = models.CharField(
        max_length=20,
        choices=BOOKING_STATUS_CHOICES,
        default='pending',
        help_text="预约状态"
    )
    waiting_list = models.ManyToManyField(
        User,
        related_name='waiting_bookings',
        blank=True,
        help_text="等待列表中的用户"
    )
    notes = models.TextField(blank=True, null=True, help_text="预约备注")
    
    def __str__(self):
        return f"{self.user.username} - {self.equipment.name} ({self.status})"
    
    class Meta:
        ordering = ['event__start_time']


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