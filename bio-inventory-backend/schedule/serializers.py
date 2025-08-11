from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog, WaitingQueueEntry,
    # Periodic Task Management Models
    TaskTemplate, PeriodicTaskInstance, StatusChangeRecord,
    TaskRotationQueue, QueueMember, TaskSwapRequest, NotificationRecord,
    # Intelligent Meeting Management Models
    MeetingConfiguration, MeetingInstance, Presenter, RotationSystem,
    QueueEntry, SwapRequest, PresentationHistory
)


class UserSerializer(serializers.ModelSerializer):
    """用户序列化器"""
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']
        read_only_fields = ['id']


class EventSerializer(serializers.ModelSerializer):
    """事件序列化器"""
    created_by = UserSerializer(read_only=True)
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source='created_by', 
        write_only=True
    )
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'start_time', 'end_time', 'event_type', 
            'description', 'created_by', 'created_by_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EquipmentSerializer(serializers.ModelSerializer):
    """Equipment serializer with simple check-in/out support"""
    current_user = UserSerializer(read_only=True)
    current_usage_duration = serializers.ReadOnlyField()
    
    def to_representation(self, instance):
        """Custom serialization with error handling"""
        try:
            data = super().to_representation(instance)
            # Ensure all expected fields are present
            if 'current_user' not in data:
                data['current_user'] = None
            if 'is_in_use' not in data:
                data['is_in_use'] = False
            if 'is_bookable' not in data:
                data['is_bookable'] = True
            return data
        except Exception as e:
            print(f"Error serializing equipment {instance.id if instance else 'None'}: {e}")
            # Return minimal safe data
            return {
                'id': instance.id if instance else None,
                'name': instance.name if instance else 'Unknown',
                'description': getattr(instance, 'description', '') or '',
                'is_bookable': getattr(instance, 'is_bookable', True),
                'location': getattr(instance, 'location', '') or '',
                'current_user': None,
                'current_checkin_time': None,
                'is_in_use': getattr(instance, 'is_in_use', False),
                'current_usage_duration': None,
                'created_at': getattr(instance, 'created_at', None),
                'updated_at': getattr(instance, 'updated_at', None)
            }
    
    class Meta:
        model = Equipment
        fields = [
            'id', 'name', 'description', 'is_bookable', 
            'location', 'current_user', 'current_checkin_time', 'is_in_use',
            'current_usage_duration', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'current_user', 'current_checkin_time', 
            'is_in_use', 'current_usage_duration', 'created_at', 'updated_at'
        ]


class BookingSerializer(serializers.ModelSerializer):
    """Enhanced booking serializer with conflict detection"""
    event = EventSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    equipment = EquipmentSerializer(read_only=True)
    waiting_list = UserSerializer(many=True, read_only=True)
    is_time_conflict = serializers.ReadOnlyField()
    
    # Write-only fields for creating/updating
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(),
        source='event',
        write_only=True
    )
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True
    )
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        source='equipment',
        write_only=True
    )
    waiting_list_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='waiting_list',
        many=True,
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Booking
        fields = [
            'id', 'event', 'event_id', 'user', 'user_id', 
            'equipment', 'equipment_id', 'status', 'waiting_list', 
            'waiting_list_ids', 'notes', 'actual_end_time',
            'early_finish_notified', 'is_time_conflict'
        ]
        read_only_fields = ['id', 'early_finish_notified', 'is_time_conflict']


class GroupMeetingSerializer(serializers.ModelSerializer):
    """组会序列化器"""
    event = EventSerializer(read_only=True)
    presenter = UserSerializer(read_only=True)
    
    # Write-only fields
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(),
        source='event',
        write_only=True
    )
    presenter_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='presenter',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = GroupMeeting
        fields = [
            'id', 'event', 'event_id', 'topic', 'presenter', 
            'presenter_id', 'materials_url', 'materials_file'
        ]
        read_only_fields = ['id']


class MeetingPresenterRotationSerializer(serializers.ModelSerializer):
    """轮值列表序列化器"""
    user_list = UserSerializer(many=True, read_only=True)
    next_presenter = serializers.SerializerMethodField()
    
    # Write-only field
    user_list_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user_list',
        many=True,
        write_only=True
    )
    
    def get_next_presenter(self, obj):
        """获取下一个报告人"""
        next_presenter = obj.get_next_presenter()
        if next_presenter:
            return UserSerializer(next_presenter).data
        return None
    
    class Meta:
        model = MeetingPresenterRotation
        fields = [
            'id', 'name', 'user_list', 'user_list_ids', 
            'next_presenter_index', 'next_presenter', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RecurringTaskSerializer(serializers.ModelSerializer):
    """周期性任务序列化器"""
    assignee_group = UserSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    
    # Write-only fields
    assignee_group_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='assignee_group',
        many=True,
        write_only=True
    )
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='created_by',
        write_only=True
    )
    
    class Meta:
        model = RecurringTask
        fields = [
            'id', 'title', 'description', 'cron_schedule', 
            'assignee_group', 'assignee_group_ids', 'is_active',
            'created_by', 'created_by_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TaskInstanceSerializer(serializers.ModelSerializer):
    """任务实例序列化器"""
    recurring_task = RecurringTaskSerializer(read_only=True)
    event = EventSerializer(read_only=True)
    assigned_to = UserSerializer(many=True, read_only=True)
    
    # Write-only fields
    recurring_task_id = serializers.PrimaryKeyRelatedField(
        queryset=RecurringTask.objects.all(),
        source='recurring_task',
        write_only=True,
        required=False,
        allow_null=True
    )
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(),
        source='event',
        write_only=True
    )
    assigned_to_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='assigned_to',
        many=True,
        write_only=True
    )
    
    class Meta:
        model = TaskInstance
        fields = [
            'id', 'recurring_task', 'recurring_task_id', 'event', 'event_id',
            'assigned_to', 'assigned_to_ids', 'status', 'completion_notes',
            'completed_at'
        ]
        read_only_fields = ['id', 'completed_at']


class CalendarEventSerializer(serializers.Serializer):
    """Unified calendar event serializer for frontend display"""
    id = serializers.IntegerField()
    title = serializers.CharField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    event_type = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    
    # Type-specific additional information
    equipment_name = serializers.CharField(required=False)
    presenter_name = serializers.CharField(required=False)
    booking_status = serializers.CharField(required=False)
    task_status = serializers.CharField(required=False)
    assigned_users = serializers.ListField(required=False)
    equipment_in_use = serializers.BooleanField(required=False)
    current_user = serializers.CharField(required=False)
    
    class Meta:
        fields = [
            'id', 'title', 'start_time', 'end_time', 'event_type', 'description',
            'equipment_name', 'presenter_name', 'booking_status', 'task_status', 
            'assigned_users', 'equipment_in_use', 'current_user'
        ]


class EquipmentUsageLogSerializer(serializers.ModelSerializer):
    """Equipment usage log serializer"""
    equipment = EquipmentSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    booking = BookingSerializer(read_only=True)
    current_duration = serializers.ReadOnlyField()
    
    # Write-only fields for creating logs
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        source='equipment',
        write_only=True
    )
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True
    )
    booking_id = serializers.PrimaryKeyRelatedField(
        queryset=Booking.objects.all(),
        source='booking',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = EquipmentUsageLog
        fields = [
            'id', 'equipment', 'equipment_id', 'user', 'user_id',
            'booking', 'booking_id', 'check_in_time', 'check_out_time',
            'usage_duration', 'current_duration', 'qr_scan_method',
            'notes', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'usage_duration', 'created_at', 'updated_at']


class WaitingQueueEntrySerializer(serializers.ModelSerializer):
    """Waiting queue entry serializer"""
    equipment = EquipmentSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    time_slot = BookingSerializer(read_only=True)
    is_expired = serializers.ReadOnlyField()
    
    # Write-only fields
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        source='equipment',
        write_only=True
    )
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True
    )
    time_slot_id = serializers.PrimaryKeyRelatedField(
        queryset=Booking.objects.all(),
        source='time_slot',
        write_only=True
    )
    
    class Meta:
        model = WaitingQueueEntry
        fields = [
            'id', 'equipment', 'equipment_id', 'user', 'user_id',
            'time_slot', 'time_slot_id', 'position', 'requested_start_time',
            'requested_end_time', 'status', 'notification_sent_at',
            'expires_at', 'is_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'position', 'notification_sent_at', 'is_expired',
            'created_at', 'updated_at'
        ]




# ===============================================
# Periodic Task Management Serializers
# ===============================================

class TaskTemplateSerializer(serializers.ModelSerializer):
    """Task template serializer"""
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = TaskTemplate
        fields = [
            'id', 'name', 'description', 'task_type', 'category',
            'frequency', 'interval', 'start_date', 'end_date',
            'min_people', 'max_people', 'default_people', 'estimated_hours',
            'window_type', 'fixed_start_day', 'fixed_end_day',
            'flexible_position', 'flexible_duration',
            'priority', 'is_active', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validate task template data"""
        if data.get('task_type') == 'recurring':
            if not data.get('frequency'):
                raise serializers.ValidationError("Frequency is required for recurring tasks")
        
        if data.get('window_type') == 'fixed':
            if not data.get('fixed_start_day') or not data.get('fixed_end_day'):
                raise serializers.ValidationError("Fixed start and end days are required for fixed window type")
            if data.get('fixed_start_day', 0) > data.get('fixed_end_day', 31):
                raise serializers.ValidationError("Fixed start day cannot be greater than end day")
        
        if data.get('window_type') == 'flexible':
            if not data.get('flexible_position') or not data.get('flexible_duration'):
                raise serializers.ValidationError("Position and duration are required for flexible window type")
        
        if data.get('min_people', 1) > data.get('max_people', 1):
            raise serializers.ValidationError("Minimum people cannot be greater than maximum people")
        
        return data


class PeriodicTaskInstanceSerializer(serializers.ModelSerializer):
    """Periodic task instance serializer"""
    template = TaskTemplateSerializer(read_only=True)
    assignees = serializers.SerializerMethodField()
    primary_assignee = serializers.SerializerMethodField()
    completed_by = UserSerializer(read_only=True)
    is_overdue = serializers.ReadOnlyField()
    can_complete = serializers.SerializerMethodField()
    can_claim = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = PeriodicTaskInstance
        fields = [
            'id', 'template', 'template_name', 'scheduled_period',
            'execution_start_date', 'execution_end_date', 'status', 'status_display',
            'original_assignees', 'current_assignees', 'assignment_metadata',
            'assignees', 'primary_assignee', 'is_overdue', 'can_complete', 'can_claim',
            'completed_by', 'completed_at', 'completion_duration',
            'completion_notes', 'completion_photos', 'completion_rating',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'template', 'template_name', 'original_assignees',
            'completed_by', 'completed_at', 'created_at', 'updated_at'
        ]
    
    def get_assignees(self, obj):
        """Get current assignees"""
        assignees = obj.get_assignees()
        return UserSerializer(assignees, many=True).data
    
    def get_primary_assignee(self, obj):
        """Get primary assignee"""
        primary = obj.get_primary_assignee()
        return UserSerializer(primary).data if primary else None
    
    def get_can_complete(self, obj):
        """Check if current user can complete this task"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.can_be_completed_by(request.user)
        return False
    
    def get_can_claim(self, obj):
        """Check if current user can claim this task"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.can_be_claimed(request.user)
        return False


class StatusChangeRecordSerializer(serializers.ModelSerializer):
    """Status change record serializer"""
    changed_by = UserSerializer(read_only=True)
    
    class Meta:
        model = StatusChangeRecord
        fields = [
            'id', 'from_status', 'to_status', 'changed_by', 'changed_at', 'reason'
        ]
        read_only_fields = ['id', 'changed_at']


class QueueMemberSerializer(serializers.ModelSerializer):
    """Queue member serializer"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = QueueMember
        fields = [
            'id', 'user', 'total_assignments', 'last_assigned_date',
            'last_assigned_period', 'completion_rate', 'average_completion_time',
            'priority_score', 'is_active', 'availability_data',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_assignments', 'priority_score', 'created_at', 'updated_at']


class TaskRotationQueueSerializer(serializers.ModelSerializer):
    """Task rotation queue serializer"""
    template = TaskTemplateSerializer(read_only=True)
    queue_members = QueueMemberSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TaskRotationQueue
        fields = [
            'id', 'template', 'algorithm', 'last_updated',
            'min_gap_months', 'consider_workload', 'random_factor',
            'queue_members', 'member_count'
        ]
        read_only_fields = ['id', 'template', 'last_updated']
    
    def get_member_count(self, obj):
        """Get active member count"""
        return obj.queue_members.filter(is_active=True).count()


class TaskSwapRequestSerializer(serializers.ModelSerializer):
    """Task swap request serializer"""
    task_instance = PeriodicTaskInstanceSerializer(read_only=True)
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)
    admin_approved_by = UserSerializer(read_only=True)
    can_approve = serializers.ReadOnlyField()
    
    class Meta:
        model = TaskSwapRequest
        fields = [
            'id', 'task_instance', 'request_type', 'status',
            'from_user', 'to_user', 'reason',
            'target_user_approved', 'target_user_approved_at',
            'admin_approved', 'admin_approved_at', 'admin_approved_by',
            'is_public_pool', 'pool_published_at', 'can_approve',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'task_instance', 'from_user', 'admin_approved_by',
            'target_user_approved_at', 'admin_approved_at',
            'pool_published_at', 'created_at', 'updated_at'
        ]


class NotificationRecordSerializer(serializers.ModelSerializer):
    """Notification record serializer"""
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    
    class Meta:
        model = NotificationRecord
        fields = [
            'id', 'notification_type', 'notification_type_display',
            'channel', 'channel_display', 'sent_to_users', 'sent_at',
            'content_summary', 'email_sent', 'email_errors'
        ]
        read_only_fields = ['id', 'sent_at']


class TaskCompletionSerializer(serializers.Serializer):
    """Serializer for task completion data"""
    completion_duration = serializers.IntegerField(required=False, help_text="Duration in minutes")
    completion_notes = serializers.CharField(required=False, allow_blank=True)
    completion_photos = serializers.ListField(
        child=serializers.URLField(),
        required=False,
        help_text="List of photo URLs"
    )
    completion_rating = serializers.IntegerField(
        required=False, 
        min_value=1, 
        max_value=5,
        help_text="Rating from 1-5"
    )


class TaskGenerationPreviewSerializer(serializers.Serializer):
    """Serializer for task generation preview"""
    period = serializers.CharField()
    template_name = serializers.CharField()
    execution_window = serializers.DictField()
    suggested_assignees = serializers.ListField(child=serializers.CharField())
    assignee_details = serializers.ListField(child=UserSerializer())


class BatchTaskGenerationSerializer(serializers.Serializer):
    """Serializer for batch task generation"""
    periods = serializers.ListField(
        child=serializers.CharField(max_length=7),
        help_text="List of periods in YYYY-MM format"
    )
    template_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Optional list of template IDs to generate (default: all active)"
    )
    preview_only = serializers.BooleanField(
        default=True,
        help_text="Only preview without creating tasks"
    )
    
    def validate_periods(self, value):
        """Validate period format"""
        import re
        for period in value:
            if not re.match(r'^\d{4}-\d{2}$', period):
                raise serializers.ValidationError(f"Invalid period format: {period}. Use YYYY-MM format.")
        return value


class TaskStatisticsSerializer(serializers.Serializer):
    """Serializer for task statistics"""
    total_tasks = serializers.IntegerField()
    completed_tasks = serializers.IntegerField()
    overdue_tasks = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    average_completion_time = serializers.FloatField()
    user_statistics = serializers.ListField(child=serializers.DictField())
    template_statistics = serializers.ListField(child=serializers.DictField())


# ===============================================
# Intelligent Meeting Management Serializers
# ===============================================

class MeetingConfigurationSerializer(serializers.ModelSerializer):
    """Meeting configuration serializer"""
    active_members = UserSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    
    # Write-only fields
    active_members_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='active_members',
        many=True,
        write_only=True
    )
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='created_by',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = MeetingConfiguration
        fields = [
            'id', 'day_of_week', 'start_time', 'location', 
            'research_update_duration', 'journal_club_duration',
            'jc_submission_deadline_days', 'jc_final_deadline_days',
            'require_admin_approval', 'default_postpone_strategy',
            'active_members', 'active_members_ids', 'created_by', 'created_by_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class MeetingInstanceSerializer(serializers.ModelSerializer):
    """Meeting instance serializer"""
    event = EventSerializer(read_only=True)
    
    # Write-only field
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(),
        source='event',
        write_only=True
    )
    
    class Meta:
        model = MeetingInstance
        fields = [
            'id', 'date', 'meeting_type', 'status', 'event', 'event_id',
            'actual_duration', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PresenterSerializer(serializers.ModelSerializer):
    """Presenter serializer"""
    meeting_instance = MeetingInstanceSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    materials_submitted = serializers.SerializerMethodField()
    
    # Write-only fields
    meeting_instance_id = serializers.PrimaryKeyRelatedField(
        queryset=MeetingInstance.objects.all(),
        source='meeting_instance',
        write_only=True
    )
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True
    )
    
    def get_materials_submitted(self, obj):
        """Check if materials have been submitted"""
        return bool(obj.materials_submitted_at)
    
    class Meta:
        model = Presenter
        fields = [
            'id', 'meeting_instance', 'meeting_instance_id', 'user', 'user_id',
            'order', 'status', 'topic', 'paper_title', 'paper_url',
            'paper_file', 'slides_file', 'materials_submitted_at', 'materials_submitted',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'materials_submitted_at', 'created_at', 'updated_at']


class RotationSystemSerializer(serializers.ModelSerializer):
    """Rotation system serializer"""
    
    class Meta:
        model = RotationSystem
        fields = [
            'id', 'name', 'is_active', 'min_gap_between_presentations',
            'max_consecutive_presenters', 'fairness_weight',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class QueueEntrySerializer(serializers.ModelSerializer):
    """Queue entry serializer"""
    rotation_system = RotationSystemSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    
    # Write-only fields
    rotation_system_id = serializers.PrimaryKeyRelatedField(
        queryset=RotationSystem.objects.all(),
        source='rotation_system',
        write_only=True
    )
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True
    )
    
    class Meta:
        model = QueueEntry
        fields = [
            'id', 'rotation_system', 'rotation_system_id', 'user', 'user_id',
            'next_scheduled_date', 'last_presented_date', 'postpone_count',
            'priority', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'priority', 'created_at', 'updated_at']


class SwapRequestSerializer(serializers.ModelSerializer):
    """Swap request serializer"""
    requester = UserSerializer(read_only=True)
    original_presentation = PresenterSerializer(read_only=True)
    target_presentation = PresenterSerializer(read_only=True)
    admin_approved_by = UserSerializer(read_only=True)
    can_approve = serializers.ReadOnlyField()
    
    # Write-only fields
    requester_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='requester',
        write_only=True
    )
    original_presentation_id = serializers.PrimaryKeyRelatedField(
        queryset=Presenter.objects.all(),
        source='original_presentation',
        write_only=True
    )
    target_presentation_id = serializers.PrimaryKeyRelatedField(
        queryset=Presenter.objects.all(),
        source='target_presentation',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = SwapRequest
        fields = [
            'id', 'request_type', 'status', 'requester', 'requester_id',
            'original_presentation', 'original_presentation_id',
            'target_presentation', 'target_presentation_id',
            'reason', 'target_user_approved', 'target_user_approved_at',
            'admin_approved', 'admin_approved_at', 'admin_approved_by',
            'cascade_effect', 'can_approve', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'target_user_approved_at', 'admin_approved_at', 
            'admin_approved_by', 'can_approve', 'created_at', 'updated_at'
        ]


class PresentationHistorySerializer(serializers.ModelSerializer):
    """Presentation history serializer"""
    presenter = PresenterSerializer(read_only=True)
    presenter_user = serializers.CharField(source='presenter.user.username', read_only=True)
    
    class Meta:
        model = PresentationHistory
        fields = [
            'id', 'presenter', 'presenter_user', 'presentation_count',
            'total_duration', 'average_rating', 'archived_at'
        ]
        read_only_fields = ['id', 'archived_at']


# ===============================================
# Enhanced Calendar and Dashboard Serializers
# ===============================================

class IntelligentMeetingDashboardSerializer(serializers.Serializer):
    """Dashboard data for intelligent meeting management"""
    next_meeting = MeetingInstanceSerializer(required=False)
    my_next_presentation = PresenterSerializer(required=False)
    pending_swap_requests = SwapRequestSerializer(many=True, required=False)
    upcoming_deadlines = serializers.ListField(required=False)
    meeting_statistics = serializers.DictField(required=False)
    
    class Meta:
        fields = [
            'next_meeting', 'my_next_presentation', 'pending_swap_requests',
            'upcoming_deadlines', 'meeting_statistics'
        ]


class JournalClubSubmissionSerializer(serializers.Serializer):
    """Serializer for Journal Club paper submission"""
    presentation_id = serializers.IntegerField()
    paper_title = serializers.CharField(max_length=500)
    paper_url = serializers.URLField(required=False, allow_blank=True)
    paper_file = serializers.FileField(required=False, allow_null=True)
    
    def validate(self, data):
        """Ensure either URL or file is provided"""
        if not data.get('paper_url') and not data.get('paper_file'):
            raise serializers.ValidationError(
                "Either paper URL or paper file must be provided"
            )
        return data


class MeetingGenerationSerializer(serializers.Serializer):
    """Serializer for generating meetings"""
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    meeting_types = serializers.ListField(
        child=serializers.ChoiceField(choices=MeetingInstance.MEETING_TYPE_CHOICES),
        default=['research_update', 'journal_club']
    )
    auto_assign_presenters = serializers.BooleanField(default=True)
    
    def validate(self, data):
        """Validate date range"""
        if data['start_date'] >= data['end_date']:
            raise serializers.ValidationError("End date must be after start date")
        return data