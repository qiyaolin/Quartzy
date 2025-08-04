from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog, WaitingQueueEntry
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