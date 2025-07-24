from rest_framework import serializers
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type', 'priority',
            'is_read', 'is_dismissed', 'action_url', 'metadata', 
            'created_at', 'updated_at', 'expires_at', 'is_expired'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_expired']
    
    def to_representation(self, instance):
        """Custom serialization to include related object info if available"""
        data = super().to_representation(instance)
        
        # Add related object information if available
        if instance.content_object:
            try:
                if hasattr(instance.content_object, 'name'):
                    data['related_object'] = {
                        'type': instance.content_type.model,
                        'id': instance.object_id,
                        'name': instance.content_object.name
                    }
                elif hasattr(instance.content_object, 'title'):
                    data['related_object'] = {
                        'type': instance.content_type.model,
                        'id': instance.object_id,
                        'title': instance.content_object.title
                    }
            except Exception:
                # Handle cases where related object might not exist anymore
                data['related_object'] = None
        
        return data


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for NotificationPreference model"""
    
    class Meta:
        model = NotificationPreference
        fields = [
            'inventory_alerts', 'request_updates', 'system_notifications',
            'funding_alerts', 'enable_daily_digest', 'enable_weekly_digest'
        ]


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications"""
    
    class Meta:
        model = Notification
        fields = [
            'recipient', 'title', 'message', 'notification_type', 
            'priority', 'action_url', 'metadata', 'expires_at'
        ]
    
    def validate_recipient(self, value):
        """Ensure recipient is a valid user"""
        if not value.is_active:
            raise serializers.ValidationError("Cannot send notification to inactive user")
        return value


class BulkNotificationSerializer(serializers.Serializer):
    """Serializer for bulk notification operations"""
    
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="List of notification IDs to perform action on"
    )
    
    action = serializers.ChoiceField(
        choices=['mark_read', 'mark_unread', 'dismiss', 'delete'],
        help_text="Action to perform on the notifications"
    )
    
    def validate_notification_ids(self, value):
        """Validate that all notification IDs exist and belong to the user"""
        user = self.context['request'].user
        existing_ids = set(
            Notification.objects.filter(
                id__in=value, 
                recipient=user
            ).values_list('id', flat=True)
        )
        
        invalid_ids = set(value) - existing_ids
        if invalid_ids:
            raise serializers.ValidationError(
                f"Invalid notification IDs: {list(invalid_ids)}"
            )
        
        return value