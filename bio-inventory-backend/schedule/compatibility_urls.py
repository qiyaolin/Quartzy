"""
Compatibility URL patterns for frontend API expectations
Maps frontend API calls to working endpoints
"""

from django.urls import path
from . import views
from . import api_compatibility
from . import additional_views

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
    
    # Meetings endpoints (compatibility for frontend calls to /schedule/meetings/)
    path('schedule/meetings/', views.MeetingInstanceViewSet.as_view({'get': 'list'}), name='compat-meetings-list'),
    
    # User endpoints
    path('api/users/active/', api_compatibility.active_users_api, name='api-users-active'),
    path('schedule/users/', api_compatibility.active_users_api, name='schedule-users'),
    
    # Meeting configuration endpoints
    path('api/meeting-configurations/', api_compatibility.meeting_configurations_api, name='api-meeting-configs'),
    
    # Recurring tasks endpoints - use the proper compatibility views
    path('api/recurring-tasks/', additional_views.RecurringTaskCompatibilityView.as_view(), name='api-recurring-tasks'),
    path('api/recurring-tasks/<int:task_id>/assign/', additional_views.TaskAssignmentCompatibilityView.as_view(), name='api-recurring-tasks-assign'),
    # Also expose namespaced variant for frontend fallbacks
    path('api/schedule/recurring-tasks/', additional_views.RecurringTaskCompatibilityView.as_view(), name='api-schedule-recurring-tasks'),
    path('api/schedule/recurring-tasks/<int:task_id>/assign/', additional_views.TaskAssignmentCompatibilityView.as_view(), name='api-schedule-recurring-tasks-assign'),
    
    # One-time tasks endpoints
    path('api/one-time-tasks/', additional_views.OneTimeTaskCompatibilityView.as_view(), name='api-one-time-tasks'),
    path('api/one-time-tasks/<int:task_id>/claim/', additional_views.OneTimeTaskClaimView.as_view(), name='api-one-time-tasks-claim'),
    
    # Legacy frontend calls hitting '/schedule/periodic-tasks/' (without 'api/')
    # Map to DRF router under 'api/schedule/periodic-tasks/' to avoid 404/HTML errors
    # List/Create
    path('schedule/periodic-tasks/', views.PeriodicTaskInstanceViewSet.as_view({'get': 'list', 'post': 'create'}), name='compat-periodic-tasks'),
    # Detail routes
    path('schedule/periodic-tasks/<int:pk>/', views.PeriodicTaskInstanceViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='compat-periodic-tasks-detail'),
    # Actions
    path('schedule/periodic-tasks/<int:pk>/complete/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'mark_completed'}), name='compat-periodic-tasks-complete'),
    path('schedule/periodic-tasks/<int:pk>/start/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'start_task'}), name='compat-periodic-tasks-start'),
    path('schedule/periodic-tasks/<int:pk>/cancel/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'cancel_task'}), name='compat-periodic-tasks-cancel'),
    path('schedule/periodic-tasks/<int:pk>/update-assignees/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'update_assignees'}), name='compat-periodic-tasks-update-assignees'),
    # Collection actions
    path('schedule/periodic-tasks/generate/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'batch_generate'}), name='compat-periodic-tasks-generate'),
    path('schedule/periodic-tasks/statistics/', views.PeriodicTaskInstanceViewSet.as_view({'get': 'statistics'}), name='compat-periodic-tasks-statistics'),
    # API namespaced aliases for periodic task actions used by frontend
    path('api/schedule/periodic-tasks/<int:pk>/complete/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'mark_completed'}), name='api-periodic-tasks-complete'),
    path('api/schedule/periodic-tasks/<int:pk>/start/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'start_task'}), name='api-periodic-tasks-start'),
    path('api/schedule/periodic-tasks/<int:pk>/cancel/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'cancel_task'}), name='api-periodic-tasks-cancel'),
    path('api/schedule/periodic-tasks/<int:pk>/update-assignees/', views.PeriodicTaskInstanceViewSet.as_view({'post': 'update_assignees'}), name='api-periodic-tasks-update-assignees'),
    path('api/schedule/periodic-tasks/statistics/', views.PeriodicTaskInstanceViewSet.as_view({'get': 'statistics'}), name='api-periodic-tasks-statistics'),
    # Preview/generate endpoints expected by frontend
    path('api/schedule/periodic-tasks/preview-generation/', additional_views.TaskGenerationPreviewView.as_view(), name='api-periodic-tasks-preview-generation'),
    path('api/schedule/periodic-tasks/generate/', additional_views.BatchTaskGenerationView.as_view(), name='api-periodic-tasks-generate'),
    
    # Fixed notifications endpoint
    path('api/notifications/summary/', api_compatibility.notifications_summary_api, name='api-notifications-summary'),
    
    # Unified dashboard endpoints
    path('schedule/unified-dashboard/overview/', api_compatibility.unified_dashboard_overview_api, name='schedule-unified-dashboard-overview'),
    # Admin/Personal dashboards and utilities used by frontend
    path('api/schedule/admin-dashboard/', additional_views.AdminDashboardView.as_view(), name='api-schedule-admin-dashboard'),
    path('api/schedule/personal-dashboard/', additional_views.PersonalDashboardView.as_view(), name='api-schedule-personal-dashboard'),
    path('api/schedule/quebec-holidays/<int:year>/', additional_views.QuebecHolidaysView.as_view(), name='api-schedule-quebec-holidays'),
    path('api/schedule/is-holiday/<str:date>/', additional_views.IsHolidayView.as_view(), name='api-schedule-is-holiday'),
    path('api/schedule/next-available-date/<str:preferred_date>/', additional_views.NextAvailableDateView.as_view(), name='api-schedule-next-available-date'),
    
    # Meetings paper management
    path('api/schedule/meetings/<int:meeting_id>/upload-paper/', additional_views.UploadPaperView.as_view(), name='api-schedule-upload-paper'),
    path('api/schedule/meetings/<int:meeting_id>/submit-paper-url/', additional_views.SubmitPaperUrlView.as_view(), name='api-schedule-submit-paper-url'),
    path('api/schedule/meetings/<int:meeting_id>/paper-submission/', additional_views.PaperSubmissionView.as_view(), name='api-schedule-paper-submission'),
    path('api/schedule/meetings/<int:meeting_id>/distribute-paper/', additional_views.DistributePaperView.as_view(), name='api-schedule-distribute-paper'),
    # Paper archive and notifications
    path('api/schedule/paper-archive/', additional_views.PaperArchiveView.as_view(), name='api-schedule-paper-archive'),
    path('api/schedule/notifications/send/', additional_views.SendNotificationView.as_view(), name='api-schedule-notifications-send'),
    path('api/schedule/notification-history/', additional_views.NotificationHistoryView.as_view(), name='api-schedule-notification-history'),
    
    # Quick actions endpoints
    path('schedule/quick-actions/quick_book_equipment/', api_compatibility.quick_book_equipment_api, name='schedule-quick-book-equipment'),
    path('schedule/quick-actions/complete_task/', api_compatibility.complete_task_api, name='schedule-complete-task'),
    # Alias for task generation used by some frontend code
    path('api/tasks/generate/', views.TaskGenerationView.as_view(), name='api-tasks-generate'),

    # One-time tasks (compatibility simple endpoints)
    path('api/one-time-tasks/', additional_views.OneTimeTasksView.as_view(), name='api-one-time-tasks'),
    path('api/one-time-tasks/<int:task_id>/<str:action>/', additional_views.OneTimeTaskActionView.as_view(), name='api-one-time-task-action'),
]