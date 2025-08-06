from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog, WaitingQueueEntry,
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
    """Equipment serializer with QR code support"""
    current_user = UserSerializer(read_only=True)
    current_usage_duration = serializers.ReadOnlyField()
    
    class Meta:
        model = Equipment
        fields = [
            'id', 'name', 'description', 'is_bookable', 
            'requires_qr_checkin', 'location', 'qr_code',
            'current_user', 'current_checkin_time', 'is_in_use',
            'current_usage_duration', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'qr_code', 'current_user', 'current_checkin_time', 
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


class QRCodeScanSerializer(serializers.Serializer):
    """Serializer for QR code scanning operations"""
    qr_code = serializers.CharField(max_length=50)
    scan_method = serializers.ChoiceField(
        choices=EquipmentUsageLog.SCAN_METHOD_CHOICES,
        default='mobile_camera'
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_qr_code(self, value):
        """Validate that QR code exists and belongs to QR-enabled equipment"""
        try:
            equipment = Equipment.objects.get(qr_code=value, requires_qr_checkin=True)
        except Equipment.DoesNotExist:
            raise serializers.ValidationError("Invalid QR code or equipment not found")
        return value


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