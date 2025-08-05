"""
Frontend-compatible URL routing for schedule management
Maps existing backend functionality to frontend API expectations
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .frontend_api_views import (
    ScheduleViewSet, FrontendEquipmentViewSet, FrontendGroupMeetingViewSet,
    FrontendUserViewSet, FrontendMeetingConfigurationViewSet, FrontendRecurringTaskViewSet
)

# Create router for frontend-compatible APIs
frontend_router = DefaultRouter()

# Register frontend-compatible viewsets
frontend_router.register(r'schedules', ScheduleViewSet, basename='schedules')
frontend_router.register(r'equipment', FrontendEquipmentViewSet, basename='frontend-equipment')  
frontend_router.register(r'group-meetings', FrontendGroupMeetingViewSet, basename='frontend-group-meetings')
frontend_router.register(r'users', FrontendUserViewSet, basename='frontend-users')
frontend_router.register(r'meeting-configurations', FrontendMeetingConfigurationViewSet, basename='frontend-meeting-configs')
frontend_router.register(r'recurring-tasks', FrontendRecurringTaskViewSet, basename='frontend-recurring-tasks')

# Frontend-compatible URL patterns
urlpatterns = [
    # Main API routes that frontend expects
    path('api/', include(frontend_router.urls)),
    
    # Additional endpoints for specific frontend needs
    path('schedule/', include(frontend_router.urls)),  # For /schedule/equipment/ endpoints
]