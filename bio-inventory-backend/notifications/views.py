from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from .models import Notification, NotificationPreference
from .serializers import (
    NotificationSerializer, 
    NotificationPreferenceSerializer,
    BulkNotificationSerializer,
    NotificationCreateSerializer
)


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user notifications"""
    
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return notifications for the current user only"""
        user = self.request.user
        queryset = Notification.objects.for_user(user)
        
        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            is_read_bool = is_read.lower() in ['true', '1']
            queryset = queryset.filter(is_read=is_read_bool)
        
        # Filter by notification type
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
        
        # Exclude expired notifications unless explicitly requested
        include_expired = self.request.query_params.get('include_expired', 'false')
        if include_expired.lower() not in ['true', '1']:
            now = timezone.now()
            queryset = queryset.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=now)
            )
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return NotificationCreateSerializer
        elif self.action in ['bulk_action']:
            return BulkNotificationSerializer
        return NotificationSerializer
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'notification marked as read'})
    
    @action(detail=True, methods=['post'])
    def mark_unread(self, request, pk=None):
        """Mark a notification as unread"""
        notification = self.get_object()
        notification.is_read = False
        notification.save(update_fields=['is_read', 'updated_at'])
        return Response({'status': 'notification marked as unread'})
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss a notification"""
        notification = self.get_object()
        notification.mark_as_dismissed()
        return Response({'status': 'notification dismissed'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for the current user"""
        count = Notification.objects.mark_all_read(request.user)
        return Response({
            'status': 'all notifications marked as read',
            'count': count
        })
    
    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        """Perform bulk actions on notifications"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        notification_ids = serializer.validated_data['notification_ids']
        action_type = serializer.validated_data['action']
        
        notifications = Notification.objects.filter(
            id__in=notification_ids,
            recipient=request.user
        )
        
        if action_type == 'mark_read':
            count = notifications.update(is_read=True)
            message = f'{count} notifications marked as read'
        elif action_type == 'mark_unread':
            count = notifications.update(is_read=False)
            message = f'{count} notifications marked as unread'
        elif action_type == 'dismiss':
            count = notifications.update(is_dismissed=True)
            message = f'{count} notifications dismissed'
        elif action_type == 'delete':
            count = notifications.count()
            notifications.delete()
            message = f'{count} notifications deleted'
        
        return Response({
            'status': 'bulk action completed',
            'message': message,
            'count': count
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get notification summary for the current user"""
        user_notifications = Notification.objects.for_user(request.user)
        
        # Exclude expired notifications
        now = timezone.now()
        active_notifications = user_notifications.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        )
        
        summary = {
            'total': active_notifications.count(),
            'unread': active_notifications.filter(is_read=False).count(),
            'by_type': {},
            'by_priority': {}
        }
        
        # Count by type
        for choice in Notification.TYPE_CHOICES:
            type_key = choice[0]
            count = active_notifications.filter(notification_type=type_key).count()
            if count > 0:
                summary['by_type'][type_key] = count
        
        # Count by priority
        for choice in Notification.PRIORITY_CHOICES:
            priority_key = choice[0]
            count = active_notifications.filter(priority=priority_key).count()
            if count > 0:
                summary['by_priority'][priority_key] = count
        
        return Response(summary)


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user notification preferences"""
    
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return preferences for the current user only"""
        return NotificationPreference.objects.filter(user=self.request.user)
    
    def get_object(self):
        """Get or create notification preferences for the current user"""
        preferences, created = NotificationPreference.objects.get_or_create(
            user=self.request.user
        )
        return preferences
    
    def list(self, request, *args, **kwargs):
        """Return the user's notification preferences"""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Update the user's notification preferences"""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)