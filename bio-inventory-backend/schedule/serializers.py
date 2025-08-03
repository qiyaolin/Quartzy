from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, RecurringTask, TaskInstance


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
    """设备序列化器"""
    class Meta:
        model = Equipment
        fields = [
            'id', 'name', 'description', 'is_bookable', 
            'requires_qr_checkin', 'location', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BookingSerializer(serializers.ModelSerializer):
    """预约序列化器"""
    event = EventSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    equipment = EquipmentSerializer(read_only=True)
    waiting_list = UserSerializer(many=True, read_only=True)
    
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
            'waiting_list_ids', 'notes'
        ]
        read_only_fields = ['id']


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
    """统一日历事件序列化器，用于前端日历展示"""
    id = serializers.IntegerField()
    title = serializers.CharField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    event_type = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    
    # 特定类型的附加信息
    equipment_name = serializers.CharField(required=False)
    presenter_name = serializers.CharField(required=False)
    booking_status = serializers.CharField(required=False)
    task_status = serializers.CharField(required=False)
    assigned_users = serializers.ListField(required=False)
    
    class Meta:
        fields = [
            'id', 'title', 'start_time', 'end_time', 'event_type', 'description',
            'equipment_name', 'presenter_name', 'booking_status', 'task_status', 'assigned_users'
        ]