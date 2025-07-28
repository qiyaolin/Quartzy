from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import PrintJob, PrintJobHistory, PrintServer


@admin.register(PrintJob)
class PrintJobAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'status_badge', 'priority_badge', 'item_name', 'requested_by',
        'created_at', 'completed_at', 'retry_count', 'print_server_id'
    ]
    list_filter = ['status', 'priority', 'created_at', 'print_server_id']
    search_fields = ['id', 'label_data__itemName', 'requested_by__username', 'print_server_id']
    readonly_fields = ['id', 'created_at', 'started_at', 'completed_at', 'label_data_display']
    
    fieldsets = (
        ('Job Information', {
            'fields': ('id', 'status', 'priority', 'requested_by')
        }),
        ('Label Data', {
            'fields': ('label_data_display',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'started_at', 'completed_at'),
            'classes': ('collapse',)
        }),
        ('Error Handling', {
            'fields': ('error_message', 'retry_count', 'max_retries'),
            'classes': ('collapse',)
        }),
        ('Print Server', {
            'fields': ('print_server_id',),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        colors = {
            'pending': '#fbbf24',
            'processing': '#3b82f6',
            'completed': '#10b981',
            'failed': '#ef4444'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">{}</span>',
            colors.get(obj.status, '#6b7280'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def priority_badge(self, obj):
        colors = {
            'low': '#6b7280',
            'normal': '#3b82f6',
            'high': '#f59e0b',
            'urgent': '#ef4444'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">{}</span>',
            colors.get(obj.priority, '#6b7280'),
            obj.get_priority_display()
        )
    priority_badge.short_description = 'Priority'

    def item_name(self, obj):
        return obj.label_data.get('itemName', 'N/A')
    item_name.short_description = 'Item Name'

    def label_data_display(self, obj):
        import json
        return format_html('<pre>{}</pre>', json.dumps(obj.label_data, indent=2))
    label_data_display.short_description = 'Label Data (JSON)'

    actions = ['retry_failed_jobs', 'mark_as_failed']

    def retry_failed_jobs(self, request, queryset):
        failed_jobs = queryset.filter(status='failed')
        count = 0
        for job in failed_jobs:
            if job.can_retry:
                job.status = 'pending'
                job.error_message = None
                job.save()
                count += 1
        self.message_user(request, f'{count} jobs marked for retry.')
    retry_failed_jobs.short_description = "Retry selected failed jobs"

    def mark_as_failed(self, request, queryset):
        processing_jobs = queryset.filter(status='processing')
        count = processing_jobs.update(status='failed', error_message='Manually marked as failed by admin')
        self.message_user(request, f'{count} jobs marked as failed.')
    mark_as_failed.short_description = "Mark selected jobs as failed"


@admin.register(PrintJobHistory)
class PrintJobHistoryAdmin(admin.ModelAdmin):
    list_display = ['print_job', 'status_transition', 'changed_at', 'notes']
    list_filter = ['status_from', 'status_to', 'changed_at']
    search_fields = ['print_job__id', 'notes']
    readonly_fields = ['print_job', 'status_from', 'status_to', 'changed_at', 'notes']

    def status_transition(self, obj):
        return f"{obj.status_from} → {obj.status_to}"
    status_transition.short_description = 'Status Transition'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(PrintServer)
class PrintServerAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'server_id', 'status_indicator', 'location',
        'printer_name', 'total_jobs_processed', 'jobs_completed_today',
        'last_heartbeat'
    ]
    list_filter = ['is_active', 'last_heartbeat', 'location']
    search_fields = ['name', 'server_id', 'location', 'printer_name']
    readonly_fields = ['server_id', 'total_jobs_processed', 'jobs_completed_today', 'created_at', 'updated_at', 'online_status']

    fieldsets = (
        ('Server Information', {
            'fields': ('server_id', 'name', 'location', 'is_active', 'online_status')
        }),
        ('Printer Information', {
            'fields': ('printer_name', 'printer_status')
        }),
        ('Statistics', {
            'fields': ('total_jobs_processed', 'jobs_completed_today', 'last_heartbeat'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def status_indicator(self, obj):
        if obj.is_online:
            return format_html(
                '<span style="color: green;">● Online</span>'
            )
        else:
            return format_html(
                '<span style="color: red;">● Offline</span>'
            )
    status_indicator.short_description = 'Status'

    def online_status(self, obj):
        if obj.is_online:
            return format_html('<span style="color: green; font-weight: bold;">ONLINE</span>')
        else:
            return format_html('<span style="color: red; font-weight: bold;">OFFLINE</span>')
    online_status.short_description = 'Online Status'

    actions = ['reset_daily_counters']

    def reset_daily_counters(self, request, queryset):
        count = queryset.update(jobs_completed_today=0)
        self.message_user(request, f'Daily counters reset for {count} servers.')
    reset_daily_counters.short_description = "Reset daily job counters"