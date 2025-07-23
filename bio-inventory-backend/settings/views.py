from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from .models import SystemSetting, UserPreference
from .serializers import SystemSettingSerializer, UserPreferenceSerializer, UserSettingsOverviewSerializer


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return SystemSetting.objects.all()
        else:
            return SystemSetting.objects.filter(is_admin_only=False)

    def create(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can create system settings'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_admin_only and not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can modify this setting'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can delete system settings'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class UserPreferenceViewSet(viewsets.ModelViewSet):
    serializer_class = UserPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserPreference.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create user preferences"""
        preferences, created = UserPreference.objects.get_or_create(
            user=self.request.user
        )
        return preferences

    @action(detail=False, methods=['get'], url_path='my-preferences')
    def my_preferences(self, request):
        """Get current user's preferences"""
        preferences, created = UserPreference.objects.get_or_create(
            user=request.user
        )
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)

    @action(detail=False, methods=['post', 'put'], url_path='update-preferences')
    def update_preferences(self, request):
        """Update current user's preferences"""
        preferences, created = UserPreference.objects.get_or_create(
            user=request.user
        )
        serializer = self.get_serializer(preferences, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        """Get complete settings overview for current user"""
        user = request.user
        preferences, created = UserPreference.objects.get_or_create(user=user)
        
        data = {
            'user': user,
            'preferences': preferences
        }
        
        serializer = UserSettingsOverviewSerializer(data)
        return Response(serializer.data)


class AdminSettingsViewSet(viewsets.ViewSet):
    """Admin-only settings management"""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Get all system settings for admin"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Administrator access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        settings = SystemSetting.objects.all()
        serializer = SystemSettingSerializer(settings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        """Bulk update system settings"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Administrator access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
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

    @action(detail=False, methods=['get'], url_path='system-info')
    def system_info(self, request):
        """Get system information for admin dashboard"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Administrator access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        from django.db import connection
        from django.contrib.auth.models import User
        
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