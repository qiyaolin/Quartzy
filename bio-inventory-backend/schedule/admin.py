from django.contrib import admin
from .models import Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, RecurringTask, TaskInstance


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['title', 'event_type', 'start_time', 'end_time', 'created_by']
    list_filter = ['event_type', 'start_time', 'created_by']
    search_fields = ['title', 'description']
    date_hierarchy = 'start_time'
    ordering = ['-start_time']


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_bookable', 'requires_qr_checkin', 'location']
    list_filter = ['is_bookable', 'requires_qr_checkin']
    search_fields = ['name', 'description', 'location']
    ordering = ['name']


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'equipment', 'user', 'status', 'event']
    list_filter = ['status', 'equipment', 'event__start_time']
    search_fields = ['user__username', 'equipment__name', 'event__title']
    raw_id_fields = ['event', 'user', 'equipment']
    filter_horizontal = ['waiting_list']
    ordering = ['-event__start_time']


@admin.register(GroupMeeting)
class GroupMeetingAdmin(admin.ModelAdmin):
    list_display = ['topic', 'presenter', 'event']
    list_filter = ['presenter', 'event__start_time']
    search_fields = ['topic', 'presenter__username', 'event__title']
    raw_id_fields = ['event', 'presenter']
    ordering = ['-event__start_time']


@admin.register(MeetingPresenterRotation)
class MeetingPresenterRotationAdmin(admin.ModelAdmin):
    list_display = ['name', 'next_presenter_index', 'is_active', 'user_count']
    list_filter = ['is_active']
    search_fields = ['name']
    filter_horizontal = ['user_list']
    ordering = ['name']
    
    def user_count(self, obj):
        return obj.user_list.count()
    user_count.short_description = 'User Count'


@admin.register(RecurringTask)
class RecurringTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'cron_schedule', 'is_active', 'created_by']
    list_filter = ['is_active', 'created_by', 'created_at']
    search_fields = ['title', 'description']
    raw_id_fields = ['created_by']
    filter_horizontal = ['assignee_group']
    ordering = ['title']


@admin.register(TaskInstance)
class TaskInstanceAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'status', 'completed_at', 'event']
    list_filter = ['status', 'completed_at', 'event__start_time', 'recurring_task']
    search_fields = ['event__title', 'recurring_task__title', 'completion_notes']
    raw_id_fields = ['recurring_task', 'event']
    filter_horizontal = ['assigned_to']
    ordering = ['-event__start_time']