from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemSettingViewSet, UserPreferenceViewSet, AdminSettingsViewSet

router = DefaultRouter()
router.register(r'system', SystemSettingViewSet)
router.register(r'preferences', UserPreferenceViewSet, basename='preferences')
router.register(r'admin', AdminSettingsViewSet, basename='admin-settings')

urlpatterns = [
    path('', include(router.urls)),
]