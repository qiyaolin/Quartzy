from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from datetime import datetime, date
from django.utils.dateparse import parse_date
from django.utils import timezone
from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog, WaitingQueueEntry,
    # Intelligent Meeting Management Models
    MeetingConfiguration, MeetingInstance, Presenter, RotationSystem,
    QueueEntry, SwapRequest, PresentationHistory
)
from .serializers import (
    EventSerializer, EquipmentSerializer, BookingSerializer, 
    GroupMeetingSerializer, MeetingPresenterRotationSerializer, 
    RecurringTaskSerializer, TaskInstanceSerializer, CalendarEventSerializer,
    EquipmentUsageLogSerializer, WaitingQueueEntrySerializer, QRCodeScanSerializer,
    # Intelligent Meeting Management Serializers
    MeetingConfigurationSerializer, MeetingInstanceSerializer, PresenterSerializer,
    RotationSystemSerializer, QueueEntrySerializer, SwapRequestSerializer,
    PresentationHistorySerializer, IntelligentMeetingDashboardSerializer,
    JournalClubSubmissionSerializer, MeetingGenerationSerializer
)


class EventViewSet(viewsets.ModelViewSet):
    """事件管理API"""
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    
    def get_queryset(self):
        queryset = Event.objects.all()
        
        # 按日期范围过滤
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start_date = parse_date(start_date)
                queryset = queryset.filter(start_time__date__gte=start_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_date = parse_date(end_date)
                queryset = queryset.filter(end_time__date__lte=end_date)
            except ValueError:
                pass
        
        # 按事件类型过滤
        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def calendar_view(self, request):
        """获取日历视图的统一事件数据"""
        queryset = self.get_queryset()
        calendar_events = []
        
        for event in queryset:
            event_data = {
                'id': event.id,
                'title': event.title,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'event_type': event.event_type,
                'description': event.description or '',
            }
            
            # 根据事件类型添加特定信息
            if event.event_type == 'booking' and hasattr(event, 'booking'):
                booking = event.booking
                event_data.update({
                    'equipment_name': booking.equipment.name,
                    'booking_status': booking.status,
                })
            
            elif event.event_type == 'meeting' and hasattr(event, 'group_meeting'):
                meeting = event.group_meeting
                event_data.update({
                    'presenter_name': meeting.presenter.username if meeting.presenter else '',
                })
            
            elif event.event_type == 'task' and hasattr(event, 'task_instance'):
                task = event.task_instance
                event_data.update({
                    'task_status': task.status,
                    'assigned_users': [user.username for user in task.assigned_to.all()],
                })
            
            calendar_events.append(event_data)
        
        serializer = CalendarEventSerializer(calendar_events, many=True)
        return Response(serializer.data)


class EquipmentViewSet(viewsets.ModelViewSet):
    """设备管理API"""
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    
    def get_queryset(self):
        queryset = Equipment.objects.all()
        
        # 只显示可预约的设备
        bookable_only = self.request.query_params.get('bookable_only')
        if bookable_only and bookable_only.lower() == 'true':
            queryset = queryset.filter(is_bookable=True)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        """获取设备可用性"""
        equipment = self.get_object()
        
        # 获取查询日期范围
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'start_date and end_date are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            start_date = parse_date(start_date)
            end_date = parse_date(end_date)
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取该时间段内的预约
        bookings = Booking.objects.filter(
            equipment=equipment,
            event__start_time__date__gte=start_date,
            event__end_time__date__lte=end_date,
            status__in=['confirmed', 'pending']
        ).select_related('event', 'user')
        
        booking_data = []
        for booking in bookings:
            booking_data.append({
                'id': booking.id,
                'start_time': booking.event.start_time,
                'end_time': booking.event.end_time,
                'user': booking.user.username,
                'status': booking.status,
                'title': booking.event.title,
            })
        
        return Response({
            'equipment': EquipmentSerializer(equipment).data,
            'bookings': booking_data,
        })
    
    @action(detail=False, methods=['post'])
    def qr_checkin(self, request):
        """Check in to equipment using QR code"""
        serializer = QRCodeScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        qr_code = serializer.validated_data['qr_code']
        scan_method = serializer.validated_data.get('scan_method', 'mobile_camera')
        notes = serializer.validated_data.get('notes', '')
        
        try:
            equipment = Equipment.objects.get(qr_code=qr_code, requires_qr_checkin=True)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found or QR check-in not enabled'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if equipment is already in use
        if equipment.is_in_use:
            return Response({
                'error': f'Equipment is currently in use by {equipment.current_user.username}',
                'current_user': equipment.current_user.username,
                'check_in_time': equipment.current_checkin_time,
                'duration': str(equipment.current_usage_duration)
            }, status=status.HTTP_409_CONFLICT)
        
        # Check in user
        try:
            equipment.check_in_user(request.user)
            
            # Update associated booking status if exists
            current_booking = Booking.objects.filter(
                equipment=equipment,
                user=request.user,
                event__start_time__lte=timezone.now(),
                event__end_time__gte=timezone.now(),
                status='confirmed'
            ).first()
            
            if current_booking:
                current_booking.status = 'in_progress'
                current_booking.save()
            
            return Response({
                'message': 'Successfully checked in',
                'equipment': EquipmentSerializer(equipment).data,
                'check_in_time': equipment.current_checkin_time,
                'booking': BookingSerializer(current_booking).data if current_booking else None
            })
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def qr_checkout(self, request):
        """Check out from equipment using QR code"""
        serializer = QRCodeScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        qr_code = serializer.validated_data['qr_code']
        notes = serializer.validated_data.get('notes', '')
        
        try:
            equipment = Equipment.objects.get(qr_code=qr_code, requires_qr_checkin=True)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found or QR check-in not enabled'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if equipment is in use by current user
        if not equipment.is_in_use:
            return Response(
                {'error': 'Equipment is not currently in use'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if equipment.current_user != request.user:
            return Response({
                'error': f'Equipment is being used by {equipment.current_user.username}',
                'current_user': equipment.current_user.username
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check out user
        try:
            usage_log = equipment.check_out_user(request.user)
            
            # Update associated booking
            current_booking = Booking.objects.filter(
                equipment=equipment,
                user=request.user,
                status='in_progress'
            ).first()
            
            if current_booking:
                current_booking.status = 'completed'
                current_booking.actual_end_time = timezone.now()
                current_booking.save()
                
                # Check for early finish notification
                current_booking.check_for_early_finish()
            
            return Response({
                'message': 'Successfully checked out',
                'equipment': EquipmentSerializer(equipment).data,
                'usage_log': EquipmentUsageLogSerializer(usage_log).data,
                'usage_duration': str(usage_log.usage_duration) if usage_log else None,
                'booking': BookingSerializer(current_booking).data if current_booking else None
            })
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def qr_code(self, request, pk=None):
        """Get QR code for equipment"""
        equipment = self.get_object()
        
        if not equipment.requires_qr_checkin:
            return Response(
                {'error': 'QR check-in not enabled for this equipment'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate QR code if not exists
        if not equipment.qr_code:
            equipment.save()  # This will auto-generate QR code
        
        return Response({
            'equipment_name': equipment.name,
            'qr_code': equipment.qr_code,
            'location': equipment.location,
            'is_in_use': equipment.is_in_use,
            'current_user': equipment.current_user.username if equipment.current_user else None,
            'qr_code_url': f"data:text/plain;base64,{equipment.qr_code}"
        })
    
    @action(detail=True, methods=['get'])
    def usage_logs(self, request, pk=None):
        """Get usage logs for equipment"""
        equipment = self.get_object()
        
        # Get query parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        user_id = request.query_params.get('user_id')
        
        logs = EquipmentUsageLog.objects.filter(equipment=equipment)
        
        if start_date:
            try:
                start_date = parse_date(start_date)
                logs = logs.filter(check_in_time__date__gte=start_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_date = parse_date(end_date)
                logs = logs.filter(check_in_time__date__lte=end_date)
            except ValueError:
                pass
        
        if user_id:
            logs = logs.filter(user_id=user_id)
        
        logs = logs.order_by('-check_in_time')[:50]  # Limit to 50 recent logs
        
        serializer = EquipmentUsageLogSerializer(logs, many=True)
        return Response({
            'equipment': EquipmentSerializer(equipment).data,
            'usage_logs': serializer.data,
            'total_logs': logs.count()
        })
    
    @action(detail=True, methods=['get'])
    def current_status(self, request, pk=None):
        """Get real-time status of equipment"""
        equipment = self.get_object()
        
        # Get current booking if any
        current_booking = None
        if equipment.is_in_use:
            current_booking = Booking.objects.filter(
                equipment=equipment,
                user=equipment.current_user,
                status='in_progress'
            ).first()
        
        # Get upcoming bookings for today
        today = timezone.now().date()
        upcoming_bookings = Booking.objects.filter(
            equipment=equipment,
            event__start_time__date=today,
            event__start_time__gt=timezone.now(),
            status='confirmed'
        ).order_by('event__start_time')[:5]
        
        return Response({
            'equipment': EquipmentSerializer(equipment).data,
            'current_booking': BookingSerializer(current_booking).data if current_booking else None,
            'upcoming_bookings': BookingSerializer(upcoming_bookings, many=True).data,
            'usage_duration': str(equipment.current_usage_duration) if equipment.current_usage_duration else None
        })


class BookingViewSet(viewsets.ModelViewSet):
    """预约管理API"""
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    
    def get_queryset(self):
        queryset = Booking.objects.select_related('event', 'user', 'equipment')
        
        # 按用户过滤
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # 按设备过滤
        equipment_id = self.request.query_params.get('equipment_id')
        if equipment_id:
            queryset = queryset.filter(equipment_id=equipment_id)
        
        # 按状态过滤
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """确认预约"""
        booking = self.get_object()
        booking.status = 'confirmed'
        booking.save()
        
        serializer = self.get_serializer(booking)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """取消预约"""
        booking = self.get_object()
        booking.status = 'cancelled'
        booking.save()
        
        serializer = self.get_serializer(booking)
        return Response(serializer.data)


class GroupMeetingViewSet(viewsets.ModelViewSet):
    """组会管理API"""
    queryset = GroupMeeting.objects.all()
    serializer_class = GroupMeetingSerializer
    
    def get_queryset(self):
        return GroupMeeting.objects.select_related('event', 'presenter')


class MeetingPresenterRotationViewSet(viewsets.ModelViewSet):
    """轮值管理API"""
    queryset = MeetingPresenterRotation.objects.all()
    serializer_class = MeetingPresenterRotationSerializer
    
    def get_queryset(self):
        queryset = MeetingPresenterRotation.objects.prefetch_related('user_list')
        
        # 只显示激活的轮值列表
        active_only = self.request.query_params.get('active_only')
        if active_only and active_only.lower() == 'true':
            queryset = queryset.filter(is_active=True)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def advance_presenter(self, request, pk=None):
        """轮换到下一个报告人"""
        rotation = self.get_object()
        rotation.advance_presenter()
        
        serializer = self.get_serializer(rotation)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def next_presenter(self, request, pk=None):
        """获取下一个报告人"""
        rotation = self.get_object()
        next_presenter = rotation.get_next_presenter()
        
        if next_presenter:
            from .serializers import UserSerializer
            return Response(UserSerializer(next_presenter).data)
        
        return Response({'message': 'No presenters in rotation list'})


class RecurringTaskViewSet(viewsets.ModelViewSet):
    """周期性任务管理API"""
    queryset = RecurringTask.objects.all()
    serializer_class = RecurringTaskSerializer
    
    def get_queryset(self):
        queryset = RecurringTask.objects.select_related('created_by').prefetch_related('assignee_group')
        
        # 只显示激活的任务
        active_only = self.request.query_params.get('active_only')
        if active_only and active_only.lower() == 'true':
            queryset = queryset.filter(is_active=True)
        
        return queryset


class TaskInstanceViewSet(viewsets.ModelViewSet):
    """任务实例管理API"""
    queryset = TaskInstance.objects.all()
    serializer_class = TaskInstanceSerializer
    
    def get_queryset(self):
        queryset = TaskInstance.objects.select_related(
            'recurring_task', 'event'
        ).prefetch_related('assigned_to')
        
        # 按状态过滤
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # 按分配用户过滤
        assigned_to = self.request.query_params.get('assigned_to')
        if assigned_to:
            queryset = queryset.filter(assigned_to=assigned_to)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """标记任务完成"""
        task = self.get_object()
        notes = request.data.get('notes', '')
        
        task.mark_completed(notes)
        
        serializer = self.get_serializer(task)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def start_task(self, request, pk=None):
        """开始任务"""
        task = self.get_object()
        task.status = 'in_progress'
        task.save()
        
        serializer = self.get_serializer(task)
        return Response(serializer.data)


class EquipmentUsageLogViewSet(viewsets.ModelViewSet):
    """Equipment usage log management API"""
    queryset = EquipmentUsageLog.objects.all()
    serializer_class = EquipmentUsageLogSerializer
    
    def get_queryset(self):
        queryset = EquipmentUsageLog.objects.select_related('equipment', 'user', 'booking')
        
        # Filter by equipment
        equipment_id = self.request.query_params.get('equipment_id')
        if equipment_id:
            queryset = queryset.filter(equipment_id=equipment_id)
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        if start_date:
            try:
                start_date = parse_date(start_date)
                queryset = queryset.filter(check_in_time__date__gte=start_date)
            except ValueError:
                pass
        
        end_date = self.request.query_params.get('end_date')
        if end_date:
            try:
                end_date = parse_date(end_date)
                queryset = queryset.filter(check_in_time__date__lte=end_date)
            except ValueError:
                pass
        
        return queryset.order_by('-check_in_time')
    
    @action(detail=False, methods=['get'])
    def active_sessions(self, request):
        """Get all currently active usage sessions"""
        active_logs = EquipmentUsageLog.objects.filter(
            is_active=True
        ).select_related('equipment', 'user', 'booking')
        
        serializer = self.get_serializer(active_logs, many=True)
        return Response({
            'active_sessions': serializer.data,
            'count': active_logs.count()
        })
    
    @action(detail=False, methods=['get'])
    def usage_statistics(self, request):
        """Get usage statistics for equipment"""
        from django.db.models import Count, Avg, Sum
        from datetime import timedelta
        
        # Get date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = EquipmentUsageLog.objects.filter(is_active=False)
        
        if start_date:
            try:
                start_date = parse_date(start_date)
                queryset = queryset.filter(check_in_time__date__gte=start_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_date = parse_date(end_date)
                queryset = queryset.filter(check_in_time__date__lte=end_date)
            except ValueError:
                pass
        
        # Usage statistics by equipment
        equipment_stats = queryset.values('equipment__name').annotate(
            total_sessions=Count('id'),
            total_duration=Sum('usage_duration'),
            avg_duration=Avg('usage_duration')
        ).order_by('-total_sessions')
        
        # Usage statistics by user
        user_stats = queryset.values('user__username').annotate(
            total_sessions=Count('id'),
            total_duration=Sum('usage_duration'),
            avg_duration=Avg('usage_duration')
        ).order_by('-total_sessions')
        
        return Response({
            'equipment_statistics': list(equipment_stats),
            'user_statistics': list(user_stats),
            'total_sessions': queryset.count(),
            'date_range': {
                'start_date': start_date,
                'end_date': end_date
            }
        })


class WaitingQueueEntryViewSet(viewsets.ModelViewSet):
    """Waiting queue management API"""
    queryset = WaitingQueueEntry.objects.all()
    serializer_class = WaitingQueueEntrySerializer
    
    def get_queryset(self):
        queryset = WaitingQueueEntry.objects.select_related(
            'equipment', 'user', 'time_slot'
        )
        
        # Filter by equipment
        equipment_id = self.request.query_params.get('equipment_id')
        if equipment_id:
            queryset = queryset.filter(equipment_id=equipment_id)
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Exclude expired entries by default
        include_expired = self.request.query_params.get('include_expired', 'false')
        if include_expired.lower() != 'true':
            queryset = queryset.filter(expires_at__gt=timezone.now())
        
        return queryset.order_by('equipment', 'position')
    
    def perform_create(self, serializer):
        """Set position when creating new queue entry"""
        equipment = serializer.validated_data['equipment']
        time_slot = serializer.validated_data['time_slot']
        
        # Get next position in queue for this equipment and time slot
        from django.db.models import Max
        max_position = WaitingQueueEntry.objects.filter(
            equipment=equipment,
            time_slot=time_slot,
            status='waiting'
        ).aggregate(max_pos=Max('position'))['max_pos'] or 0
        
        from datetime import timedelta
        serializer.save(
            position=max_position + 1,
            expires_at=timezone.now() + timedelta(hours=24)
        )
    
    @action(detail=True, methods=['post'])
    def notify(self, request, pk=None):
        """Send notification to user in queue"""
        queue_entry = self.get_object()
        
        if queue_entry.status != 'waiting':
            return Response(
                {'error': 'Can only notify waiting queue entries'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = queue_entry.notify_user()
        
        if success:
            return Response({
                'message': 'Notification sent successfully',
                'queue_entry': WaitingQueueEntrySerializer(queue_entry).data
            })
        else:
            return Response(
                {'error': 'Failed to send notification'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def convert_to_booking(self, request, pk=None):
        """Convert queue entry to actual booking"""
        queue_entry = self.get_object()
        
        if queue_entry.status != 'notified':
            return Response(
                {'error': 'Can only convert notified queue entries'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            booking = queue_entry.convert_to_booking()
            return Response({
                'message': 'Successfully converted to booking',
                'booking': BookingSerializer(booking).data,
                'queue_entry': WaitingQueueEntrySerializer(queue_entry).data
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to convert to booking: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def cleanup_expired(self, request):
        """Clean up expired queue entries"""
        expired_entries = WaitingQueueEntry.objects.filter(
            expires_at__lt=timezone.now(),
            status='waiting'
        )
        
        count = expired_entries.count()
        expired_entries.update(status='expired')
        
        return Response({
            'message': f'Cleaned up {count} expired queue entries',
            'expired_count': count
        })
    
    @action(detail=False, methods=['get'])
    def my_queue(self, request):
        """Get current user's queue entries"""
        queue_entries = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(queue_entries, many=True)
        
        return Response({
            'queue_entries': serializer.data,
            'count': queue_entries.count()
        })


# ===============================================
# Intelligent Meeting Management ViewSets
# ===============================================

class MeetingConfigurationViewSet(viewsets.ModelViewSet):
    """Meeting configuration management API"""
    queryset = MeetingConfiguration.objects.all()
    serializer_class = MeetingConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Only one configuration should exist, but return queryset for API consistency
        return MeetingConfiguration.objects.all()
    
    def perform_create(self, serializer):
        """Set creator when creating configuration"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def current_config(self, request):
        """Get current meeting configuration (there should only be one)"""
        try:
            config = MeetingConfiguration.objects.first()
            if config:
                serializer = self.get_serializer(config)
                return Response(serializer.data)
            else:
                return Response(
                    {'message': 'No meeting configuration found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def initialize_default(self, request):
        """Initialize default meeting configuration"""
        if MeetingConfiguration.objects.exists():
            return Response(
                {'error': 'Meeting configuration already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        config = MeetingConfiguration.objects.create(
            day_of_week=1,  # Monday
            start_time='10:00',
            location='Conference Room',
            created_by=request.user
        )
        
        serializer = self.get_serializer(config)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MeetingInstanceViewSet(viewsets.ModelViewSet):
    """Meeting instance management API"""
    queryset = MeetingInstance.objects.all()
    serializer_class = MeetingInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = MeetingInstance.objects.select_related('event').prefetch_related('presenters')
        
        # Filter by meeting type
        meeting_type = self.request.query_params.get('meeting_type')
        if meeting_type:
            queryset = queryset.filter(meeting_type=meeting_type)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        if start_date:
            try:
                start_date = parse_date(start_date)
                queryset = queryset.filter(date__gte=start_date)
            except ValueError:
                pass
        
        end_date = self.request.query_params.get('end_date')
        if end_date:
            try:
                end_date = parse_date(end_date)
                queryset = queryset.filter(date__lte=end_date)
            except ValueError:
                pass
        
        return queryset.order_by('-date')
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming meetings"""
        today = timezone.now().date()
        upcoming_meetings = self.get_queryset().filter(
            date__gte=today,
            status__in=['scheduled', 'confirmed']
        ).order_by('date')[:10]
        
        serializer = self.get_serializer(upcoming_meetings, many=True)
        return Response({
            'upcoming_meetings': serializer.data,
            'count': upcoming_meetings.count()
        })
    
    @action(detail=False, methods=['post'])
    def generate_meetings(self, request):
        """Generate meetings for a date range"""
        serializer = MeetingGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Implementation would go here to generate meetings
        # This is a complex operation that would involve the fair rotation algorithm
        return Response(
            {'message': 'Meeting generation not yet implemented'}, 
            status=status.HTTP_501_NOT_IMPLEMENTED
        )
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark meeting as completed"""
        meeting = self.get_object()
        meeting.status = 'completed'
        meeting.actual_duration = request.data.get('actual_duration')
        meeting.notes = request.data.get('notes', meeting.notes)
        meeting.save()
        
        # Mark all presenters as completed
        meeting.presenters.update(status='completed')
        
        serializer = self.get_serializer(meeting)
        return Response(serializer.data)


class PresenterViewSet(viewsets.ModelViewSet):
    """Presenter management API"""
    queryset = Presenter.objects.all()
    serializer_class = PresenterSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Presenter.objects.select_related(
            'meeting_instance', 'user', 'meeting_instance__event'
        )
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by meeting type
        meeting_type = self.request.query_params.get('meeting_type')
        if meeting_type:
            queryset = queryset.filter(meeting_instance__meeting_type=meeting_type)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-meeting_instance__date', 'order')
    
    @action(detail=False, methods=['get'])
    def my_presentations(self, request):
        """Get current user's presentations"""
        presentations = self.get_queryset().filter(user=request.user)
        
        # Separate by status
        upcoming = presentations.filter(
            meeting_instance__date__gte=timezone.now().date(),
            status__in=['assigned', 'confirmed']
        ).order_by('meeting_instance__date')
        
        completed = presentations.filter(
            status='completed'
        ).order_by('-meeting_instance__date')[:10]
        
        return Response({
            'upcoming_presentations': self.get_serializer(upcoming, many=True).data,
            'completed_presentations': self.get_serializer(completed, many=True).data,
            'upcoming_count': upcoming.count(),
            'completed_count': completed.count()
        })
    
    @action(detail=True, methods=['post'])
    def submit_materials(self, request, pk=None):
        """Submit presentation materials"""
        presenter = self.get_object()
        
        if presenter.user != request.user:
            return Response(
                {'error': 'You can only submit materials for your own presentations'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = JournalClubSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Update presenter with submitted materials
        data = serializer.validated_data
        presenter.paper_title = data.get('paper_title', presenter.paper_title)
        presenter.paper_url = data.get('paper_url', presenter.paper_url)
        if data.get('paper_file'):
            presenter.paper_file = data['paper_file']
        presenter.materials_submitted_at = timezone.now()
        presenter.status = 'confirmed'
        presenter.save()
        
        return Response({
            'message': 'Materials submitted successfully',
            'presenter': self.get_serializer(presenter).data
        })
    
    @action(detail=True, methods=['post'])
    def confirm_presentation(self, request, pk=None):
        """Confirm presentation"""
        presenter = self.get_object()
        
        if presenter.user != request.user:
            return Response(
                {'error': 'You can only confirm your own presentations'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        presenter.status = 'confirmed'
        presenter.save()
        
        return Response({
            'message': 'Presentation confirmed',
            'presenter': self.get_serializer(presenter).data
        })


class RotationSystemViewSet(viewsets.ModelViewSet):
    """Rotation system management API"""
    queryset = RotationSystem.objects.all()
    serializer_class = RotationSystemSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = RotationSystem.objects.prefetch_related('queue_entries')
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def queue_status(self, request, pk=None):
        """Get rotation queue status"""
        rotation_system = self.get_object()
        
        queue_entries = QueueEntry.objects.filter(
            rotation_system=rotation_system
        ).select_related('user').order_by('-priority', 'last_presented_date')
        
        serializer = QueueEntrySerializer(queue_entries, many=True)
        return Response({
            'rotation_system': self.get_serializer(rotation_system).data,
            'queue_entries': serializer.data,
            'queue_size': queue_entries.count()
        })
    
    @action(detail=True, methods=['post'])
    def recalculate_priorities(self, request, pk=None):
        """Recalculate all priority scores in the rotation system"""
        rotation_system = self.get_object()
        
        queue_entries = QueueEntry.objects.filter(rotation_system=rotation_system)
        for entry in queue_entries:
            entry.calculate_priority()
        
        return Response({
            'message': f'Recalculated priorities for {queue_entries.count()} entries',
            'recalculated_count': queue_entries.count()
        })


class QueueEntryViewSet(viewsets.ModelViewSet):
    """Queue entry management API"""
    queryset = QueueEntry.objects.all()
    serializer_class = QueueEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return QueueEntry.objects.select_related(
            'rotation_system', 'user'
        ).order_by('-priority', 'last_presented_date')
    
    @action(detail=True, methods=['post'])
    def recalculate_priority(self, request, pk=None):
        """Recalculate priority for this entry"""
        entry = self.get_object()
        old_priority = entry.priority
        new_priority = entry.calculate_priority()
        
        return Response({
            'message': 'Priority recalculated',
            'old_priority': old_priority,
            'new_priority': new_priority,
            'entry': self.get_serializer(entry).data
        })


class SwapRequestViewSet(viewsets.ModelViewSet):
    """Swap request management API"""
    queryset = SwapRequest.objects.all()
    serializer_class = SwapRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = SwapRequest.objects.select_related(
            'requester', 'original_presentation', 'target_presentation', 'admin_approved_by'
        )
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by request type
        request_type = self.request.query_params.get('request_type')
        if request_type:
            queryset = queryset.filter(request_type=request_type)
        
        # Filter by user (either as requester or target)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(
                Q(requester_id=user_id) | 
                Q(target_presentation__user_id=user_id)
            )
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Set requester when creating swap request"""
        serializer.save(requester=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's swap requests"""
        # Requests made by current user
        my_requests = self.get_queryset().filter(requester=request.user)
        
        # Requests targeting current user's presentations
        target_requests = self.get_queryset().filter(
            target_presentation__user=request.user,
            status='pending'
        )
        
        return Response({
            'my_requests': self.get_serializer(my_requests, many=True).data,
            'target_requests': self.get_serializer(target_requests, many=True).data,
            'my_requests_count': my_requests.count(),
            'target_requests_count': target_requests.count()
        })
    
    @action(detail=True, methods=['post'])
    def approve_by_target(self, request, pk=None):
        """Approve swap request by target user"""
        swap_request = self.get_object()
        
        if (swap_request.request_type != 'swap' or 
            not swap_request.target_presentation or 
            swap_request.target_presentation.user != request.user):
            return Response(
                {'error': 'Invalid request or permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        swap_request.approve_by_target_user(request.user)
        
        return Response({
            'message': 'Swap request approved by target user',
            'swap_request': self.get_serializer(swap_request).data
        })
    
    @action(detail=True, methods=['post'])
    def approve_by_admin(self, request, pk=None):
        """Approve swap request by admin"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        swap_request = self.get_object()
        swap_request.approve_by_admin(request.user)
        
        return Response({
            'message': 'Swap request approved by admin',
            'swap_request': self.get_serializer(swap_request).data
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject swap request"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        swap_request = self.get_object()
        reason = request.data.get('reason', 'Rejected by admin')
        swap_request.reject(reason)
        
        return Response({
            'message': 'Swap request rejected',
            'swap_request': self.get_serializer(swap_request).data
        })
    
    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        """Get pending swap requests requiring approval"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        pending_requests = self.get_queryset().filter(
            status='pending'
        ).filter(
            Q(admin_approved__isnull=True) | 
            Q(target_user_approved__isnull=True)
        )
        
        serializer = self.get_serializer(pending_requests, many=True)
        return Response({
            'pending_requests': serializer.data,
            'count': pending_requests.count()
        })


class PresentationHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Presentation history API (read-only)"""
    queryset = PresentationHistory.objects.all()
    serializer_class = PresentationHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return PresentationHistory.objects.select_related(
            'presenter', 'presenter__user', 'presenter__meeting_instance'
        ).order_by('-archived_at')
    
    @action(detail=False, methods=['get'])
    def user_statistics(self, request):
        """Get presentation statistics for all users"""
        from django.db.models import Count, Sum, Avg
        
        stats = PresentationHistory.objects.values(
            'presenter__user__username',
            'presenter__user__first_name',
            'presenter__user__last_name'
        ).annotate(
            total_presentations=Sum('presentation_count'),
            total_duration=Sum('total_duration'),
            avg_rating=Avg('average_rating')
        ).order_by('-total_presentations')
        
        return Response({
            'user_statistics': list(stats)
        })


# ===============================================
# Enhanced Dashboard and Utility Views
# ===============================================

class IntelligentMeetingDashboardViewSet(viewsets.ViewSet):
    """Intelligent meeting dashboard API"""
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request):
        """Get personalized dashboard data"""
        user = request.user
        today = timezone.now().date()
        
        # Next meeting
        next_meeting = MeetingInstance.objects.filter(
            date__gte=today,
            status__in=['scheduled', 'confirmed']
        ).order_by('date').first()
        
        # User's next presentation
        my_next_presentation = Presenter.objects.filter(
            user=user,
            meeting_instance__date__gte=today,
            status__in=['assigned', 'confirmed']
        ).order_by('meeting_instance__date').first()
        
        # Pending swap requests involving user
        pending_swaps = SwapRequest.objects.filter(
            Q(requester=user) | Q(target_presentation__user=user),
            status='pending'
        )
        
        # Upcoming deadlines (Journal Club submissions)
        upcoming_deadlines = []
        jc_presentations = Presenter.objects.filter(
            user=user,
            meeting_instance__meeting_type='journal_club',
            meeting_instance__date__gte=today,
            status='assigned',
            materials_submitted_at__isnull=True
        )
        
        for presentation in jc_presentations:
            config = MeetingConfiguration.objects.first()
            if config:
                from datetime import timedelta
                deadline = presentation.meeting_instance.date - timedelta(
                    days=config.jc_submission_deadline_days
                )
                if deadline >= today:
                    upcoming_deadlines.append({
                        'type': 'journal_club_submission',
                        'presentation_id': presentation.id,
                        'deadline': deadline,
                        'meeting_date': presentation.meeting_instance.date,
                        'days_remaining': (deadline - today).days
                    })
        
        # Meeting statistics
        meeting_stats = {
            'total_meetings_this_month': MeetingInstance.objects.filter(
                date__year=today.year,
                date__month=today.month
            ).count(),
            'my_presentations_this_year': Presenter.objects.filter(
                user=user,
                meeting_instance__date__year=today.year
            ).count(),
            'pending_swap_requests': pending_swaps.count()
        }
        
        dashboard_data = {
            'next_meeting': MeetingInstanceSerializer(next_meeting).data if next_meeting else None,
            'my_next_presentation': PresenterSerializer(my_next_presentation).data if my_next_presentation else None,
            'pending_swap_requests': SwapRequestSerializer(pending_swaps, many=True).data,
            'upcoming_deadlines': upcoming_deadlines,
            'meeting_statistics': meeting_stats
        }
        
        serializer = IntelligentMeetingDashboardSerializer(dashboard_data)
        return Response(serializer.data)