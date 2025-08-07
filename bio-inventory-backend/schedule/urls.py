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
router.register(r'group-meetings', views.GroupMeetingViewSet, basename='group-meetings')
router.register(r'presenter-rotations', views.MeetingPresenterRotationViewSet, basename='presenter-rotations')
router.register(r'recurring-tasks', views.RecurringTaskViewSet, basename='recurring-tasks')
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
router.register(r'rotation-system', views.RotationSystemViewSet, basename='rotation-system')
router.register(r'queue-entries', views.QueueEntryViewSet, basename='queue-entries')
router.register(r'swap-requests', views.SwapRequestViewSet, basename='swap-requests')
router.register(r'presentation-history', views.PresentationHistoryViewSet, basename='presentation-history')

# Dashboard ViewSets
router.register(r'meeting-dashboard', views.IntelligentMeetingDashboardViewSet, basename='meeting-dashboard')

urlpatterns = [
    # Main router URLs
    path('', include(router.urls)),
    
    # Additional API views that aren't ViewSets
    path('qr-scan/', views.QRCodeScanView.as_view(), name='qr-scan'),
    path('calendar-events/', views.CalendarEventsView.as_view(), name='calendar-events'),
    path('equipment/available/', views.AvailableEquipmentView.as_view(), name='available-equipment'),
    path('equipment/<int:equipment_id>/checkin/', views.EquipmentCheckinView.as_view(), name='equipment-checkin'),
    path('equipment/<int:equipment_id>/checkout/', views.EquipmentCheckoutView.as_view(), name='equipment-checkout'),
    path('equipment/<int:equipment_id>/status/', views.EquipmentStatusView.as_view(), name='equipment-status'),
    
    # Intelligent Meeting Management API views
    path('admin-dashboard/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
    path('personal-dashboard/', views.PersonalDashboardView.as_view(), name='personal-dashboard'),
    path('quebec-holidays/<int:year>/', views.QuebecHolidaysView.as_view(), name='quebec-holidays'),
    path('is-holiday/<str:date>/', views.IsHolidayView.as_view(), name='is-holiday'),
    path('next-available-date/<str:preferred_date>/', views.NextAvailableDateView.as_view(), name='next-available-date'),
    path('meetings/generate/', views.GenerateMeetingsView.as_view(), name='generate-meetings'),
    path('meetings/<int:meeting_id>/upload-paper/', views.UploadPaperView.as_view(), name='upload-paper'),
    path('meetings/<int:meeting_id>/submit-paper-url/', views.SubmitPaperUrlView.as_view(), name='submit-paper-url'),
    path('meetings/<int:meeting_id>/paper-submission/', views.PaperSubmissionView.as_view(), name='paper-submission'),
    path('meetings/<int:meeting_id>/distribute-paper/', views.DistributePaperView.as_view(), name='distribute-paper'),
    path('paper-archive/', views.PaperArchiveView.as_view(), name='paper-archive'),
    path('notifications/send/', views.SendNotificationView.as_view(), name='send-notification'),
    path('notification-history/', views.NotificationHistoryView.as_view(), name='notification-history'),
    path('files/upload/', views.FileUploadView.as_view(), name='file-upload'),
    path('files/download/<str:file_key>/', views.FileDownloadView.as_view(), name='file-download'),
    path('files/<str:file_key>/', views.FileDeleteView.as_view(), name='file-delete'),
    path('users/', views.UsersView.as_view(), name='users'),
    path('users/<int:user_id>/', views.UserDetailView.as_view(), name='user-detail'),
    
    # Enhanced Periodic Task Management API views
    path('tasks/generate/', views.TaskGenerationView.as_view(), name='task-generation'),
    path('tasks/statistics/', views.TaskStatisticsView.as_view(), name='task-statistics'),
    path('tasks/initialize-queues/', views.InitializeRotationQueuesView.as_view(), name='initialize-rotation-queues'),
    
    # Enhanced Periodic Task Management - additional_views
    path('enhanced-templates/', views.EnhancedTaskTemplateView.as_view(), name='enhanced-task-templates'),
    path('task-generation-preview/', views.TaskGenerationPreviewView.as_view(), name='task-generation-preview'),
    path('batch-task-generation/', views.BatchTaskGenerationView.as_view(), name='batch-task-generation'),
    path('my-tasks/', views.MyTasksView.as_view(), name='my-tasks'),
    path('tasks/<int:task_id>/complete/', views.TaskCompletionView.as_view(), name='task-completion'),
    path('task-swaps/', views.TaskSwapRequestView.as_view(), name='task-swap-requests'),
    path('task-swaps/<int:request_id>/<str:action>/', views.SwapRequestActionView.as_view(), name='swap-request-action'),
    path('task-statistics/', views.TaskStatisticsView.as_view(), name='task-statistics-enhanced'),
    path('admin-task-dashboard/', views.AdminTaskDashboardView.as_view(), name='admin-task-dashboard'),
]