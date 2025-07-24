"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from users.views import CustomAuthToken # Import our new view
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

# Temporary API views for missing endpoints
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def notifications_summary(request):
    return Response({
        'total': 0,
        'unread': 0,
        'by_type': {},
        'by_priority': {}
    })

@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def settings_overview(request):
    from django.contrib.auth.models import User
    from settings.models import SystemSetting, UserPreference
    
    user = request.user
    preferences, created = UserPreference.objects.get_or_create(user=user)
    
    # Get system settings based on user role
    if user.is_staff:
        system_settings = SystemSetting.objects.all()
    else:
        system_settings = SystemSetting.objects.filter(is_admin_only=False)
    
    from settings.serializers import UserPreferenceSerializer, SystemSettingSerializer
    
    return Response({
        'user_info': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': user.is_staff,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
        },
        'preferences': UserPreferenceSerializer(preferences).data,
        'system_settings': SystemSettingSerializer(system_settings, many=True).data
    })

@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_preferences(request):
    from settings.models import UserPreference
    from settings.serializers import UserPreferenceSerializer
    
    preferences, created = UserPreference.objects.get_or_create(user=request.user)
    serializer = UserPreferenceSerializer(preferences, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)

@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_system_info(request):
    if not request.user.is_staff:
        return Response({'error': 'Administrator access required'}, status=403)
    
    from django.db import connection
    from django.contrib.auth.models import User
    from settings.models import SystemSetting, UserPreference
    
    # Get database stats
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM items_item")
        items_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM requests_request")
        requests_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM funding_fund")
        funds_count = cursor.fetchone()[0]

    users_count = User.objects.count()
    admin_count = User.objects.filter(is_staff=True).count()
    
    return Response({
        'system_stats': {
            'total_users': users_count,
            'admin_users': admin_count,
            'total_items': items_count,
            'total_requests': requests_count,
            'total_funds': funds_count,
        },
        'settings_count': SystemSetting.objects.count(),
        'preferences_configured': UserPreference.objects.count(),
    })

@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_bulk_update(request):
    if not request.user.is_staff:
        return Response({'error': 'Administrator access required'}, status=403)
    
    from settings.models import SystemSetting
    from settings.serializers import SystemSettingSerializer
    
    settings_data = request.data.get('settings', [])
    updated_settings = []
    
    for setting_data in settings_data:
        setting_id = setting_data.get('id')
        if setting_id:
            try:
                setting = SystemSetting.objects.get(id=setting_id)
                serializer = SystemSettingSerializer(
                    setting, 
                    data=setting_data, 
                    partial=True,
                    context={'request': request}
                )
                if serializer.is_valid():
                    serializer.save()
                    updated_settings.append(serializer.data)
            except SystemSetting.DoesNotExist:
                continue
    
    return Response({
        'message': f'Updated {len(updated_settings)} settings',
        'updated_settings': updated_settings
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/login/', CustomAuthToken.as_view(), name='api_token_auth'), # Use the new view
    path('api/', include('items.urls')),
    path('api/', include('requests.urls')),
    path('api/', include('users.urls')),
    path('api/', include('funding.urls')),
    path('api/', include('notifications.urls')),
    path('api/settings/', include('settings.urls')),
    # Temporary endpoints for missing functionality
    path('api/notifications/notifications/summary/', notifications_summary, name='notifications-summary'),
    path('api/settings/preferences/overview/', settings_overview, name='settings-overview'),
    path('api/settings/preferences/update-preferences/', update_preferences, name='update-preferences'),
    path('api/settings/admin/system-info/', admin_system_info, name='admin-system-info'),
    path('api/settings/admin/bulk-update/', admin_bulk_update, name='admin-bulk-update'),
]
