from django.contrib import admin
from .models import SystemSetting, UserPreference


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'setting_type', 'is_admin_only', 'updated_at', 'updated_by']
    list_filter = ['setting_type', 'is_admin_only', 'updated_at']
    search_fields = ['key', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'theme', 'language', 'email_notifications', 'items_per_page', 'updated_at']
    list_filter = ['theme', 'language', 'email_notifications', 'push_notifications']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']