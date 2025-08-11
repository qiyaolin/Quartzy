from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import additional_views

# Create router and register all viewsets
router = DefaultRouter()

# Original Schedule System ViewSets
router.register(r'events', views.EventViewSet, basename='events')
router.register(r'equipment', views.EquipmentViewSet, basename='equipment')
router.register(r'bookings', views.BookingViewSet, basename='bookings')
# router.register(r'group-meetings', views.GroupMeetingViewSet, basename='group-meetings')  # Disabled to use manual override
router.register(r'presenter-rotations', views.MeetingPresenterRotationViewSet, basename='presenter-rotations')
router.register(r'task-instances', views.TaskInstanceViewSet, basename='task-instances')
router.register(r'usage-logs', views.EquipmentUsageLogViewSet, basename='usage-logs')
router.register(r'waiting-queue', views.WaitingQueueEntryViewSet, basename='waiting-queue')

# Periodic Task Management ViewSets
router.register(r'task-templates', views.TaskTemplateViewSet, basename='task-templates')
router.register(r'periodic-tasks', views.PeriodicTaskInstanceViewSet, basename='periodic-tasks')
router.register(r'task-rotation-queues', views.TaskRotationQueueViewSet, basename='task-rotation-queues')
router.register(r'task-swap-requests', views.TaskSwapRequestViewSet, basename='task-swap-requests')

# Intelligent Meeting Management ViewSets
router.register(r'meeting-configuration', views.MeetingConfigurationViewSet, basename='meeting-configuration')
router.register(r'meetings', views.MeetingInstanceViewSet, basename='meetings')
router.register(r'presenters', views.PresenterViewSet, basename='presenters')
router.register(r'rotation-systems', views.RotationSystemViewSet, basename='rotation-systems')
router.register(r'queue-entries', views.QueueEntryViewSet, basename='queue-entries')
router.register(r'swap-requests', views.SwapRequestViewSet, basename='swap-requests')
router.register(r'presentation-history', views.PresentationHistoryViewSet, basename='presentation-history')

# Dashboard ViewSets
router.register(r'meeting-dashboard', views.IntelligentMeetingDashboardViewSet, basename='meeting-dashboard')
router.register(r'unified-dashboard', views.UnifiedDashboardViewSet, basename='unified-dashboard')
router.register(r'quick-actions', views.QuickActionViewSet, basename='quick-actions')

urlpatterns = [
    # Main router URLs
    path('', include(router.urls)),
    
    # Additional API views that aren't ViewSets
    path('qr-scan/', views.QRCodeScanView.as_view(), name='qr-scan'),
    
    # Override group-meetings to return MeetingInstance data
    path('group-meetings/', additional_views.group_meetings_api, name='group-meetings-override'),
    path('calendar-events/', views.CalendarEventsView.as_view(), name='calendar-events'),
    path('equipment/available/', views.AvailableEquipmentView.as_view(), name='available-equipment'),
    path('equipment/<int:equipment_id>/checkin/', views.EquipmentCheckinView.as_view(), name='equipment-checkin'),
    path('equipment/<int:equipment_id>/checkout/', views.EquipmentCheckoutView.as_view(), name='equipment-checkout'),
    path('equipment/<int:equipment_id>/status/', views.EquipmentStatusView.as_view(), name='equipment-status'),
    
    # Basic API views that exist
    path('tasks/generate/', views.TaskGenerationView.as_view(), name='task-generation'),
    path('tasks/statistics/', views.TaskStatisticsView.as_view(), name='task-statistics'),
    path('tasks/initialize-queues/', views.InitializeRotationQueuesView.as_view(), name='initialize-rotation-queues'),
    
    # =============================================================================
    # TASK SYSTEM COMPATIBILITY ENDPOINTS
    # Bridge legacy frontend APIs to enhanced backend models
    # =============================================================================
    
    # Recurring Tasks Compatibility - Maps /api/recurring-tasks/ to TaskTemplate system
    path('recurring-tasks/', additional_views.RecurringTaskCompatibilityView.as_view(), name='recurring-tasks-compatibility'),
    path('recurring-tasks/<int:task_id>/assign/', additional_views.TaskAssignmentCompatibilityView.as_view(), name='recurring-tasks-assign'),
    
    # One-Time Tasks Compatibility - Maps /api/one-time-tasks/ to PeriodicTaskInstance system
    path('one-time-tasks/', additional_views.OneTimeTaskCompatibilityView.as_view(), name='one-time-tasks-compatibility'),
    path('one-time-tasks/<int:task_id>/claim/', additional_views.OneTimeTaskClaimView.as_view(), name='one-time-tasks-claim'),
]