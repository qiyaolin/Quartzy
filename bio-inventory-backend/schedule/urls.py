from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet, EquipmentViewSet, BookingViewSet, 
    GroupMeetingViewSet, MeetingPresenterRotationViewSet, 
    RecurringTaskViewSet, TaskInstanceViewSet,
    EquipmentUsageLogViewSet, WaitingQueueEntryViewSet,
    # Intelligent Meeting Management Views
    MeetingConfigurationViewSet, MeetingInstanceViewSet, PresenterViewSet,
    RotationSystemViewSet, QueueEntryViewSet, SwapRequestViewSet,
    PresentationHistoryViewSet, IntelligentMeetingDashboardViewSet
)

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'events', EventViewSet)
router.register(r'equipment', EquipmentViewSet)
router.register(r'bookings', BookingViewSet)
router.register(r'group-meetings', GroupMeetingViewSet)
router.register(r'presenter-rotations', MeetingPresenterRotationViewSet)
router.register(r'recurring-tasks', RecurringTaskViewSet)
router.register(r'task-instances', TaskInstanceViewSet)
router.register(r'usage-logs', EquipmentUsageLogViewSet)
router.register(r'waiting-queue', WaitingQueueEntryViewSet)

# API URLs由路由器自动确定
urlpatterns = [
    path('', include(router.urls)),
]