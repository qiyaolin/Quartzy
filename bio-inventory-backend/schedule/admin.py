from django.contrib import admin
from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog, WaitingQueueEntry,
    # Intelligent Meeting Management Models
    MeetingConfiguration, MeetingInstance, Presenter, RotationSystem,
    QueueEntry, SwapRequest, PresentationHistory
)


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


@admin.register(EquipmentUsageLog)
class EquipmentUsageLogAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'equipment', 'user', 'check_in_time', 'check_out_time', 'is_active']
    list_filter = ['equipment', 'is_active', 'qr_scan_method', 'check_in_time']
    search_fields = ['equipment__name', 'user__username', 'notes']
    raw_id_fields = ['equipment', 'user', 'booking']
    readonly_fields = ['usage_duration', 'current_duration', 'created_at', 'updated_at']
    ordering = ['-check_in_time']


@admin.register(WaitingQueueEntry)
class WaitingQueueEntryAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'equipment', 'user', 'position', 'status', 'expires_at']
    list_filter = ['equipment', 'status', 'created_at', 'expires_at']
    search_fields = ['equipment__name', 'user__username']
    raw_id_fields = ['equipment', 'user', 'time_slot']
    ordering = ['equipment', 'position']


# ===============================================
# Intelligent Meeting Management Admin
# ===============================================

@admin.register(MeetingConfiguration)
class MeetingConfigurationAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'day_of_week', 'start_time', 'location', 'created_by']
    list_filter = ['day_of_week', 'require_admin_approval', 'default_postpone_strategy']
    search_fields = ['location']
    raw_id_fields = ['created_by']
    filter_horizontal = ['active_members']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Schedule Settings', {
            'fields': ('day_of_week', 'start_time', 'location')
        }),
        ('Duration Settings', {
            'fields': ('research_update_duration', 'journal_club_duration')
        }),
        ('Notification Settings', {
            'fields': ('jc_submission_deadline_days', 'jc_final_deadline_days')
        }),
        ('Management Settings', {
            'fields': ('require_admin_approval', 'default_postpone_strategy')
        }),
        ('Members', {
            'fields': ('active_members',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(MeetingInstance)
class MeetingInstanceAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'date', 'meeting_type', 'status', 'presenter_count']
    list_filter = ['meeting_type', 'status', 'date']
    search_fields = ['event__title', 'notes']
    raw_id_fields = ['event']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-date']
    
    def presenter_count(self, obj):
        return obj.presenters.count()
    presenter_count.short_description = 'Presenters'


@admin.register(Presenter)
class PresenterAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'meeting_instance', 'user', 'status', 'order', 'materials_submitted']
    list_filter = ['status', 'meeting_instance__meeting_type', 'meeting_instance__date']
    search_fields = ['user__username', 'topic', 'paper_title']
    raw_id_fields = ['meeting_instance', 'user']
    readonly_fields = ['materials_submitted_at', 'created_at', 'updated_at']
    ordering = ['meeting_instance__date', 'order']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('meeting_instance', 'user', 'order', 'status')
        }),
        ('Content', {
            'fields': ('topic', 'paper_title', 'paper_url')
        }),
        ('Materials', {
            'fields': ('paper_file', 'slides_file', 'materials_submitted_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def materials_submitted(self, obj):
        return bool(obj.materials_submitted_at)
    materials_submitted.boolean = True
    materials_submitted.short_description = 'Materials Submitted'


@admin.register(RotationSystem)
class RotationSystemAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'min_gap_between_presentations', 'max_consecutive_presenters']
    list_filter = ['is_active']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Settings', {
            'fields': ('name', 'is_active')
        }),
        ('Rotation Rules', {
            'fields': ('min_gap_between_presentations', 'max_consecutive_presenters', 'fairness_weight')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(QueueEntry)
class QueueEntryAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'rotation_system', 'user', 'priority', 'last_presented_date', 'postpone_count']
    list_filter = ['rotation_system', 'postpone_count']
    search_fields = ['user__username']
    raw_id_fields = ['rotation_system', 'user']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-priority', 'last_presented_date']
    
    actions = ['recalculate_priority']
    
    def recalculate_priority(self, request, queryset):
        for entry in queryset:
            entry.calculate_priority()
        self.message_user(request, f"Recalculated priority for {queryset.count()} entries.")
    recalculate_priority.short_description = "Recalculate priority scores"


@admin.register(SwapRequest)
class SwapRequestAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'request_type', 'status', 'requester', 'created_at', 'approval_status']
    list_filter = ['request_type', 'status', 'target_user_approved', 'admin_approved', 'created_at']
    search_fields = ['requester__username', 'reason']
    raw_id_fields = ['requester', 'original_presentation', 'target_presentation', 'admin_approved_by']
    readonly_fields = ['created_at', 'updated_at', 'target_user_approved_at', 'admin_approved_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Request Details', {
            'fields': ('request_type', 'status', 'requester', 'reason')
        }),
        ('Presentations', {
            'fields': ('original_presentation', 'target_presentation')
        }),
        ('Approvals', {
            'fields': ('target_user_approved', 'target_user_approved_at', 
                      'admin_approved', 'admin_approved_at', 'admin_approved_by')
        }),
        ('Settings', {
            'fields': ('cascade_effect',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def approval_status(self, obj):
        if obj.request_type == 'swap':
            target_status = "✓" if obj.target_user_approved else "✗"
            admin_status = "✓" if obj.admin_approved else "✗"
            return f"Target: {target_status}, Admin: {admin_status}"
        else:
            admin_status = "✓" if obj.admin_approved else "✗"
            return f"Admin: {admin_status}"
    approval_status.short_description = 'Approval Status'
    
    actions = ['approve_requests', 'reject_requests']
    
    def approve_requests(self, request, queryset):
        count = 0
        for swap_request in queryset.filter(status='pending'):
            swap_request.approve_by_admin(request.user)
            count += 1
        self.message_user(request, f"Approved {count} swap requests.")
    approve_requests.short_description = "Approve selected requests"
    
    def reject_requests(self, request, queryset):
        count = 0
        for swap_request in queryset.filter(status='pending'):
            swap_request.reject("Rejected by admin")
            count += 1
        self.message_user(request, f"Rejected {count} swap requests.")
    reject_requests.short_description = "Reject selected requests"


@admin.register(PresentationHistory)
class PresentationHistoryAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'presenter_user', 'presentation_count', 'total_duration', 'average_rating']
    list_filter = ['archived_at', 'presenter__meeting_instance__meeting_type']
    search_fields = ['presenter__user__username']
    raw_id_fields = ['presenter']
    readonly_fields = ['archived_at']
    ordering = ['-archived_at']
    
    def presenter_user(self, obj):
        return obj.presenter.user.username
    presenter_user.short_description = 'User'