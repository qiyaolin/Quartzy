from rest_framework import serializers
from django.contrib.auth.models import User
from .models import SystemSetting, UserPreference


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ['id', 'key', 'value', 'setting_type', 'description', 'is_admin_only', 'updated_at', 'updated_by']
        read_only_fields = ['id', 'updated_at', 'updated_by']

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = [
            'user', 'theme', 'language', 'email_notifications', 
            'push_notifications', 'items_per_page', 'auto_refresh_interval',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['user'] = request.user
        return super().create(validated_data)


class UserSettingsOverviewSerializer(serializers.Serializer):
    """Combined serializer for user settings overview"""
    user_info = serializers.SerializerMethodField()
    preferences = UserPreferenceSerializer()
    system_settings = serializers.SerializerMethodField()

    def get_user_info(self, obj):
        user = obj['user']
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': user.is_staff,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
        }

    def get_system_settings(self, obj):
        user = obj['user']
        if user.is_staff:
            # Admin can see all system settings
            settings = SystemSetting.objects.all()
        else:
            # Regular users can only see non-admin settings
            settings = SystemSetting.objects.filter(is_admin_only=False)
        
        return SystemSettingSerializer(settings, many=True).data