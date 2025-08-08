"""
Compatibility URL patterns for frontend API expectations
Maps frontend API calls to working endpoints
"""

from django.urls import path
from . import api_compatibility

# URL patterns that match frontend expectations
urlpatterns = [
    # Main schedule endpoints
    path('api/schedules/', api_compatibility.schedules_api, name='api-schedules'),
    path('api/schedules/initialize_defaults/', api_compatibility.initialize_default_schedules, name='api-schedules-init'),
    
    # Equipment endpoints  
    path('schedule/equipment/', api_compatibility.equipment_api, name='schedule-equipment'),
    path('schedule/equipment/initialize_defaults/', api_compatibility.initialize_default_equipment, name='schedule-equipment-init'),
    
    # Group meetings endpoints
    path('api/group-meetings/', api_compatibility.group_meetings_api, name='api-group-meetings'),
    path('api/schedule/group-meetings/', api_compatibility.meetings_api, name='api-schedule-group-meetings'),
    
    # User endpoints
    path('api/users/active/', api_compatibility.active_users_api, name='api-users-active'),
    path('schedule/users/', api_compatibility.active_users_api, name='schedule-users'),
    
    # Meeting configuration endpoints
    path('api/meeting-configurations/', api_compatibility.meeting_configurations_api, name='api-meeting-configs'),
    
    # Recurring tasks endpoints
    path('api/recurring-tasks/', api_compatibility.recurring_tasks_api, name='api-recurring-tasks'),
    
    # Fixed notifications endpoint
    path('api/notifications/summary/', api_compatibility.notifications_summary_api, name='api-notifications-summary'),
    
    # Unified dashboard endpoints
    path('schedule/unified-dashboard/overview/', api_compatibility.unified_dashboard_overview_api, name='schedule-unified-dashboard-overview'),
    
    # Meeting generation endpoints (compatibility for frontend)
    path('schedule/meetings/generate/', api_compatibility.meetings_generate_api, name='schedule-meetings-generate'),
    path('schedule/meetings/', api_compatibility.meetings_api, name='schedule-meetings'),
    
    # Quick actions endpoints
    path('schedule/quick-actions/quick_book_equipment/', api_compatibility.quick_book_equipment_api, name='schedule-quick-book-equipment'),
    path('schedule/quick-actions/complete_task/', api_compatibility.complete_task_api, name='schedule-complete-task'),
]