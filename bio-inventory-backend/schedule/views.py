from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from datetime import datetime, date
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.conf import settings
import logging
logger = logging.getLogger(__name__)

# Google Calendar integration
try:
    from .services.google_calendar_service import GoogleCalendarService
    from .services.calendar_sync_service import CalendarSyncService
except ImportError:
    GoogleCalendarService = None
    CalendarSyncService = None
    logging.warning("Google Calendar integration not available. Install google-api-python-client to enable sync.")
from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog, WaitingQueueEntry,
    # Periodic Task Management Models
    TaskTemplate, PeriodicTaskInstance, StatusChangeRecord,
    TaskRotationQueue, QueueMember, TaskSwapRequest, NotificationRecord,
    # Intelligent Meeting Management Models
    MeetingConfiguration, MeetingInstance, Presenter, RotationSystem,
    QueueEntry, SwapRequest, PresentationHistory
)
from .serializers import (
    EventSerializer, EquipmentSerializer, BookingSerializer, 
    GroupMeetingSerializer, MeetingPresenterRotationSerializer, 
    RecurringTaskSerializer, TaskInstanceSerializer, CalendarEventSerializer,
    EquipmentUsageLogSerializer, WaitingQueueEntrySerializer, QRCodeScanSerializer,
    # Periodic Task Management Serializers
    TaskTemplateSerializer, PeriodicTaskInstanceSerializer, StatusChangeRecordSerializer,
    TaskRotationQueueSerializer, QueueMemberSerializer, TaskSwapRequestSerializer,
    NotificationRecordSerializer, TaskCompletionSerializer, BatchTaskGenerationSerializer,
    TaskGenerationPreviewSerializer, TaskStatisticsSerializer,
    # Intelligent Meeting Management Serializers
    MeetingConfigurationSerializer, MeetingInstanceSerializer, PresenterSerializer,
    RotationSystemSerializer, QueueEntrySerializer, SwapRequestSerializer,
    PresentationHistorySerializer, IntelligentMeetingDashboardSerializer,
    JournalClubSubmissionSerializer, MeetingGenerationSerializer
)
from django.contrib.auth.models import User
from django.db.models import Count, Q, Avg, Sum
from django.http import Http404
from rest_framework.decorators import permission_classes
from datetime import timedelta
import json


class EventViewSet(viewsets.ModelViewSet):
    """事件管理API"""
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sync_service = None
        if GoogleCalendarService and CalendarSyncService and getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            try:
                gcal_service = GoogleCalendarService()
                self.sync_service = CalendarSyncService(gcal_service)
            except Exception as e:
                logging.warning(f"Failed to initialize Google Calendar sync: {e}")
                self.sync_service = None
    
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
        
        # 检查是否显示已取消的预约
        show_all = request.query_params.get('show_all')
        
        for event in queryset:
            # 如果是booking类型的事件，检查booking是否存在以及状态
            if event.event_type == 'booking':
                try:
                    booking = event.booking
                    # 跳过已取消的预约，除非明确请求显示所有状态
                    if booking.status == 'cancelled' and not show_all:
                        continue
                except Booking.DoesNotExist:
                    # 如果Event记录了booking类型但没有对应的booking对象，跳过
                    continue
            
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
    
    def perform_create(self, serializer):
        """Handle event creation with Google Calendar sync"""
        event = serializer.save()
        
        # Sync to Google Calendar if enabled
        if self.sync_service and getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True):
            try:
                self.sync_service.sync_event_to_google(event)
                logging.info(f"Event {event.id} synced to Google Calendar")
            except Exception as e:
                logging.error(f"Failed to sync event {event.id} to Google Calendar: {e}")
    
    def perform_update(self, serializer):
        """Handle event updates with Google Calendar sync"""
        event = serializer.save()
        
        # Sync to Google Calendar if enabled
        if self.sync_service and getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True):
            try:
                self.sync_service.sync_event_to_google(event, force_update=True)
                logging.info(f"Event {event.id} updated in Google Calendar")
            except Exception as e:
                logging.error(f"Failed to update event {event.id} in Google Calendar: {e}")
    
    def perform_destroy(self, instance):
        """Handle event deletion with Google Calendar sync"""
        # Remove from Google Calendar if enabled
        if self.sync_service and getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True):
            try:
                self.sync_service.remove_event_from_google(instance)
                logging.info(f"Event {instance.id} removed from Google Calendar")
            except Exception as e:
                logging.error(f"Failed to remove event {instance.id} from Google Calendar: {e}")
        
        instance.delete()


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
        
        # 默认排除已取消的预约，除非明确请求显示所有状态
        show_all = self.request.query_params.get('show_all')
        if not show_all:
            queryset = queryset.exclude(status='cancelled')
        
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
        
        # Check permissions - only booking owner or admin can cancel
        if booking.user != request.user and not request.user.is_staff:
            return Response({
                'error': 'You are not authorized to cancel this booking'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if booking.status == 'cancelled':
            return Response({
                'error': 'Booking is already cancelled'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if booking.status == 'completed':
            return Response({
                'error': 'Cannot cancel a completed booking'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason', 'No reason provided')
        
        # If equipment is currently in use for this booking, check it out
        if (booking.status == 'in_progress' and 
            booking.equipment.is_in_use and 
            booking.equipment.current_user == booking.user):
            booking.equipment.check_out_user(booking.user)
        
        booking.status = 'cancelled'
        booking.save()
        
        # Also mark or delete the associated Event to prevent it from appearing in calendar views
        if hasattr(booking, 'event') and booking.event:
            # Option 1: Delete the event entirely (recommended for cancelled bookings)
            booking.event.delete()
            # Option 2: Alternative - just mark the event with cancelled status
            # booking.event.status = 'cancelled'
            # booking.event.save()
        
        # Notify waiting queue if applicable
        if hasattr(booking.equipment, 'waiting_queue') and booking.equipment.waiting_queue.exists():
            # Process waiting queue for this time slot
            waiting_entries = booking.equipment.waiting_queue.filter(
                status='waiting',
                requested_start_time__lte=booking.event.end_time,
                requested_end_time__gte=booking.event.start_time
            ).order_by('position')
            
            for entry in waiting_entries[:1]:  # Notify first person in queue
                entry.notify_user()
        
        serializer = self.get_serializer(booking)
        return Response({
            'message': 'Booking cancelled successfully',
            'booking': serializer.data,
            'reason': reason
        })


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
# Periodic Task Management ViewSets
# ===============================================

class TaskTemplateViewSet(viewsets.ModelViewSet):
    """Task template management API"""
    queryset = TaskTemplate.objects.all()
    serializer_class = TaskTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = TaskTemplate.objects.select_related('created_by')
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    def perform_create(self, serializer):
        """Set creator when creating template"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def system_templates(self, request):
        """Get system predefined templates"""
        system_templates = self.get_queryset().filter(category='system')
        serializer = self.get_serializer(system_templates, many=True)
        return Response({
            'system_templates': serializer.data,
            'count': system_templates.count()
        })
    
    @action(detail=True, methods=['post'])
    def initialize_rotation_queue(self, request, pk=None):
        """Initialize rotation queue for this template"""
        template = self.get_object()
        
        # Check if queue already exists
        if hasattr(template, 'rotation_queue'):
            return Response({
                'error': 'Rotation queue already exists for this template'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create rotation queue
        rotation_queue = TaskRotationQueue.objects.create(template=template)
        
        # Add all active users to queue
        from django.contrib.auth.models import User
        active_users = User.objects.filter(
            is_active=True,
            is_staff=False
        ).exclude(username__in=['admin', 'print_server'])
        
        for user in active_users:
            QueueMember.objects.create(
                rotation_queue=rotation_queue,
                user=user
            )
        
        serializer = TaskRotationQueueSerializer(rotation_queue)
        return Response({
            'message': 'Rotation queue initialized successfully',
            'rotation_queue': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def preview_generation(self, request, pk=None):
        """Preview task generation for this template"""
        template = self.get_object()
        periods = request.data.get('periods', [])
        
        if not periods:
            return Response({
                'error': 'No periods specified'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        previews = []
        for period in periods:
            if template.should_generate_for_period(period):
                start_date, end_date = template.get_execution_window(period)
                
                # Get suggested assignees
                try:
                    if hasattr(template, 'rotation_queue'):
                        suggested_members = template.rotation_queue.assign_members_for_period(period)
                        suggested_assignees = [member.user.username for member in suggested_members]
                        assignee_details = [
                            UserSerializer(member.user).data for member in suggested_members
                        ]
                    else:
                        suggested_assignees = []
                        assignee_details = []
                except ValueError as e:
                    suggested_assignees = [f"Error: {str(e)}"]
                    assignee_details = []
                
                preview = TaskGenerationPreviewSerializer({
                    'period': period,
                    'template_name': template.name,
                    'execution_window': {
                        'start_date': start_date.isoformat(),
                        'end_date': end_date.isoformat()
                    },
                    'suggested_assignees': suggested_assignees,
                    'assignee_details': assignee_details
                })
                previews.append(preview.data)
        
        return Response({
            'previews': previews,
            'template': self.get_serializer(template).data
        })


class PeriodicTaskInstanceViewSet(viewsets.ModelViewSet):
    """Periodic task instance management API"""
    queryset = PeriodicTaskInstance.objects.all()
    serializer_class = PeriodicTaskInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sync_service = None
        if GoogleCalendarService and CalendarSyncService and getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            try:
                gcal_service = GoogleCalendarService()
                self.sync_service = CalendarSyncService(gcal_service)
            except Exception as e:
                logging.warning(f"Failed to initialize Google Calendar sync: {e}")
                self.sync_service = None
    
    def get_queryset(self):
        queryset = PeriodicTaskInstance.objects.select_related(
            'template', 'completed_by'
        )
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by period
        period = self.request.query_params.get('period')
        if period:
            queryset = queryset.filter(scheduled_period=period)
        
        # Filter by assignee
        assignee_id = self.request.query_params.get('assignee')
        if assignee_id:
            queryset = queryset.filter(current_assignees__contains=[int(assignee_id)])
        
        # Filter overdue tasks
        overdue_only = self.request.query_params.get('overdue_only')
        if overdue_only and overdue_only.lower() == 'true':
            from datetime import date
            queryset = queryset.filter(
                status__in=['scheduled', 'pending', 'in_progress'],
                execution_end_date__lt=date.today()
            )
        
        return queryset.order_by('-scheduled_period', 'execution_start_date')
    
    @action(detail=False, methods=['get'])
    def my_tasks(self, request):
        """Get current user's tasks"""
        user_tasks = self.get_queryset().filter(
            current_assignees__contains=[request.user.id]
        )
        
        # Separate by status
        current_tasks = user_tasks.filter(
            status__in=['scheduled', 'pending', 'in_progress']
        ).order_by('execution_start_date')
        
        completed_tasks = user_tasks.filter(
            status='completed'
        ).order_by('-completed_at')[:10]
        
        overdue_tasks = user_tasks.filter(
            status__in=['scheduled', 'pending', 'in_progress']
        ).filter(execution_end_date__lt=timezone.now().date())
        
        return Response({
            'current_tasks': self.get_serializer(current_tasks, many=True).data,
            'completed_tasks': self.get_serializer(completed_tasks, many=True).data,
            'overdue_tasks': self.get_serializer(overdue_tasks, many=True).data,
            'counts': {
                'current': current_tasks.count(),
                'completed': completed_tasks.count(),
                'overdue': overdue_tasks.count()
            }
        })
    
    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Mark task as completed"""
        task = self.get_object()
        
        if not task.can_be_completed_by(request.user):
            return Response({
                'error': 'You are not assigned to this task'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Validate completion data
        serializer = TaskCompletionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Mark as completed
            old_status = task.status
            task.mark_completed(request.user, **serializer.validated_data)
            
            # Add status change record
            task.add_status_change(old_status, 'completed', request.user)
            
            # Update queue member statistics
            if hasattr(task.template, 'rotation_queue'):
                queue_member = task.template.rotation_queue.queue_members.filter(
                    user=request.user
                ).first()
                if queue_member:
                    completion_hours = serializer.validated_data.get('completion_duration')
                    if completion_hours:
                        completion_hours = completion_hours / 60.0  # Convert to hours
                    queue_member.update_completion_stats(completion_hours)
            
            return Response({
                'message': 'Task marked as completed successfully',
                'task': self.get_serializer(task).data
            })
            
        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def start_task(self, request, pk=None):
        """Start working on task"""
        task = self.get_object()
        
        if not task.can_be_completed_by(request.user):
            return Response({
                'error': 'You are not assigned to this task'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if task.status != 'pending':
            return Response({
                'error': 'Task is not in pending status'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        old_status = task.status
        task.status = 'in_progress'
        task.save()
        
        # Add status change record
        task.add_status_change(old_status, 'in_progress', request.user)
        
        return Response({
            'message': 'Task started successfully',
            'task': self.get_serializer(task).data
        })
    
    @action(detail=True, methods=['post'])
    def cancel_task(self, request, pk=None):
        """Cancel periodic task"""
        task = self.get_object()
        
        # Check permissions - only assignees or admins can cancel
        if not task.can_be_completed_by(request.user) and not request.user.is_staff:
            return Response({
                'error': 'You are not authorized to cancel this task'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if task.status in ['completed', 'cancelled']:
            return Response({
                'error': f'Task is already {task.status} and cannot be cancelled'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason', 'No reason provided')
        
        old_status = task.status
        task.status = 'cancelled'
        task.save()
        
        # Add status change record
        task.add_status_change(old_status, 'cancelled', request.user, reason)
        
        return Response({
            'message': 'Task cancelled successfully',
            'task': self.get_serializer(task).data
        })
    
    @action(detail=False, methods=['post'])
    def batch_generate(self, request):
        """Batch generate periodic tasks"""
        serializer = BatchTaskGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        periods = serializer.validated_data['periods']
        template_ids = serializer.validated_data.get('template_ids')
        preview_only = serializer.validated_data.get('preview_only', True)
        
        # Get templates
        if template_ids:
            templates = TaskTemplate.objects.filter(id__in=template_ids, is_active=True)
        else:
            templates = TaskTemplate.objects.filter(is_active=True)
        
        generated_tasks = []
        errors = []
        
        for template in templates:
            for period in periods:
                if template.should_generate_for_period(period):
                    try:
                        start_date, end_date = template.get_execution_window(period)
                        
                        # Check if task already exists
                        existing_task = PeriodicTaskInstance.objects.filter(
                            template=template,
                            scheduled_period=period
                        ).first()
                        
                        if existing_task:
                            errors.append(f"Task already exists: {template.name} - {period}")
                            continue
                        
                        # Get assignees
                        try:
                            if hasattr(template, 'rotation_queue'):
                                selected_members = template.rotation_queue.assign_members_for_period(period)
                                assignee_ids = [member.user.id for member in selected_members]
                                primary_assignee = selected_members[0].user.id if selected_members else None
                            else:
                                assignee_ids = []
                                primary_assignee = None
                                errors.append(f"No rotation queue for template: {template.name}")
                                continue
                        except ValueError as e:
                            errors.append(f"Assignment error for {template.name} - {period}: {str(e)}")
                            continue
                        
                        if not preview_only:
                            # Create task instance
                            task_instance = PeriodicTaskInstance.objects.create(
                                template=template,
                                template_name=template.name,
                                scheduled_period=period,
                                execution_start_date=start_date,
                                execution_end_date=end_date,
                                original_assignees=assignee_ids,
                                current_assignees=assignee_ids,
                                assignment_metadata={
                                    'primary_assignee': primary_assignee,
                                    'assigned_at': timezone.now().isoformat()
                                }
                            )
                            generated_tasks.append(task_instance)
                        else:
                            # Create preview object
                            preview_task = {
                                'template_name': template.name,
                                'period': period,
                                'execution_window': f"{start_date} to {end_date}",
                                'assignees': [
                                    User.objects.get(id=user_id).username 
                                    for user_id in assignee_ids
                                ]
                            }
                            generated_tasks.append(preview_task)
                        
                    except Exception as e:
                        errors.append(f"Error generating {template.name} - {period}: {str(e)}")
        
        if preview_only:
            return Response({
                'message': f'Preview: {len(generated_tasks)} tasks would be generated',
                'preview_tasks': generated_tasks,
                'errors': errors
            })
        else:
            serialized_tasks = self.get_serializer(generated_tasks, many=True)
            return Response({
                'message': f'Successfully generated {len(generated_tasks)} tasks',
                'generated_tasks': serialized_tasks.data,
                'errors': errors
            })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get periodic task statistics"""
        from django.db.models import Count, Avg, Q
        from datetime import date
        
        queryset = self.get_queryset()
        
        # Filter by date range if provided
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(execution_start_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(execution_end_date__lte=end_date)
        
        # Overall statistics
        total_tasks = queryset.count()
        completed_tasks = queryset.filter(status='completed').count()
        overdue_tasks = queryset.filter(
            status__in=['scheduled', 'pending', 'in_progress'],
            execution_end_date__lt=date.today()
        ).count()
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        avg_completion_time = queryset.filter(
            completion_duration__isnull=False
        ).aggregate(avg_time=Avg('completion_duration'))['avg_time'] or 0
        
        # User statistics
        from django.contrib.auth.models import User
        user_stats = []
        for user in User.objects.filter(is_active=True):
            user_tasks = queryset.filter(current_assignees__contains=[user.id])
            user_completed = user_tasks.filter(status='completed').count()
            user_total = user_tasks.count()
            
            if user_total > 0:
                user_stats.append({
                    'user_id': user.id,
                    'username': user.username,
                    'total_tasks': user_total,
                    'completed_tasks': user_completed,
                    'completion_rate': (user_completed / user_total * 100)
                })
        
        # Template statistics
        template_stats = []
        for template in TaskTemplate.objects.filter(is_active=True):
            template_tasks = queryset.filter(template=template)
            template_completed = template_tasks.filter(status='completed').count()
            template_total = template_tasks.count()
            
            template_stats.append({
                'template_id': template.id,
                'template_name': template.name,
                'total_tasks': template_total,
                'completed_tasks': template_completed,
                'completion_rate': (template_completed / template_total * 100) if template_total > 0 else 0
            })
        
        stats = TaskStatisticsSerializer({
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'overdue_tasks': overdue_tasks,
            'completion_rate': completion_rate,
            'average_completion_time': avg_completion_time,
            'user_statistics': user_stats,
            'template_statistics': template_stats
        })
        
        return Response(stats.data)
    
    def perform_create(self, serializer):
        """Handle task creation with Google Calendar sync"""
        task = serializer.save()
        
        # Sync to Google Calendar if enabled and task syncing is enabled
        if (self.sync_service and 
            getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True) and 
            getattr(settings, 'GOOGLE_CALENDAR_SYNC_TASKS', False)):
            try:
                self.sync_service.sync_task_to_google(task)
                logging.info(f"Task {task.id} synced to Google Calendar")
            except Exception as e:
                logging.error(f"Failed to sync task {task.id} to Google Calendar: {e}")
    
    def perform_update(self, serializer):
        """Handle task updates with Google Calendar sync"""
        task = serializer.save()
        
        # Sync to Google Calendar if enabled and task syncing is enabled
        if (self.sync_service and 
            getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True) and 
            getattr(settings, 'GOOGLE_CALENDAR_SYNC_TASKS', False)):
            try:
                self.sync_service.sync_task_to_google(task, force_update=True)
                logging.info(f"Task {task.id} updated in Google Calendar")
            except Exception as e:
                logging.error(f"Failed to update task {task.id} in Google Calendar: {e}")
    
    def perform_destroy(self, instance):
        """Handle task deletion with Google Calendar sync"""
        # Remove from Google Calendar if enabled and task syncing is enabled
        if (self.sync_service and 
            getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True) and 
            getattr(settings, 'GOOGLE_CALENDAR_SYNC_TASKS', False)):
            try:
                self.sync_service.remove_task_from_google(instance)
                logging.info(f"Task {instance.id} removed from Google Calendar")
            except Exception as e:
                logging.error(f"Failed to remove task {instance.id} from Google Calendar: {e}")
        
        instance.delete()


class TaskRotationQueueViewSet(viewsets.ModelViewSet):
    """Task rotation queue management API"""
    queryset = TaskRotationQueue.objects.all()
    serializer_class = TaskRotationQueueSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return TaskRotationQueue.objects.select_related('template').prefetch_related(
            'queue_members__user'
        )
    
    @action(detail=True, methods=['post'])
    def add_members(self, request, pk=None):
        """Add members to rotation queue"""
        queue = self.get_object()
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response({
                'error': 'No user IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        added_members = []
        errors = []
        
        for user_id in user_ids:
            try:
                user = User.objects.get(id=user_id)
                member, created = QueueMember.objects.get_or_create(
                    rotation_queue=queue,
                    user=user
                )
                if created:
                    added_members.append(user.username)
                else:
                    errors.append(f"User {user.username} already in queue")
            except User.DoesNotExist:
                errors.append(f"User with ID {user_id} not found")
        
        return Response({
            'message': f'Added {len(added_members)} members to queue',
            'added_members': added_members,
            'errors': errors,
            'queue': self.get_serializer(queue).data
        })
    
    @action(detail=True, methods=['post'])
    def recalculate_priorities(self, request, pk=None):
        """Recalculate priority scores for all queue members"""
        queue = self.get_object()
        
        updated_count = 0
        for member in queue.queue_members.all():
            old_priority = member.priority_score
            new_priority = queue._calculate_member_priority(member, timezone.now().date())
            member.priority_score = new_priority
            member.save()
            updated_count += 1
        
        return Response({
            'message': f'Recalculated priorities for {updated_count} members',
            'queue': self.get_serializer(queue).data
        })


class TaskSwapRequestViewSet(viewsets.ModelViewSet):
    """Task swap request management API"""
    queryset = TaskSwapRequest.objects.all()
    serializer_class = TaskSwapRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = TaskSwapRequest.objects.select_related(
            'task_instance', 'from_user', 'to_user', 'admin_approved_by'
        )
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by user involvement
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(
                Q(from_user_id=user_id) | Q(to_user_id=user_id)
            )
        
        # Filter public pool
        public_pool = self.request.query_params.get('public_pool')
        if public_pool is not None:
            queryset = queryset.filter(is_public_pool=public_pool.lower() == 'true')
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Set requester when creating swap request"""
        serializer.save(from_user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's swap requests"""
        # Requests made by current user
        my_requests = self.get_queryset().filter(from_user=request.user)
        
        # Requests targeting current user
        target_requests = self.get_queryset().filter(
            to_user=request.user,
            status='pending'
        )
        
        # Public pool requests that user can claim
        pool_requests = self.get_queryset().filter(
            is_public_pool=True,
            status='pending'
        ).exclude(from_user=request.user)
        
        return Response({
            'my_requests': self.get_serializer(my_requests, many=True).data,
            'target_requests': self.get_serializer(target_requests, many=True).data,
            'pool_requests': self.get_serializer(pool_requests, many=True).data,
            'counts': {
                'my_requests': my_requests.count(),
                'target_requests': target_requests.count(),
                'pool_requests': pool_requests.count()
            }
        })
    
    @action(detail=True, methods=['post'])
    def approve_by_target(self, request, pk=None):
        """Approve swap request by target user"""
        swap_request = self.get_object()
        
        if swap_request.to_user != request.user:
            return Response({
                'error': 'You are not the target user for this request'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            swap_request.approve_by_target_user()
            return Response({
                'message': 'Swap request approved by target user',
                'swap_request': self.get_serializer(swap_request).data
            })
        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def approve_by_admin(self, request, pk=None):
        """Approve swap request by admin"""
        if not request.user.is_staff:
            return Response({
                'error': 'Admin permission required'
            }, status=status.HTTP_403_FORBIDDEN)
        
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
            return Response({
                'error': 'Admin permission required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        swap_request = self.get_object()
        reason = request.data.get('reason', 'Rejected by admin')
        swap_request.reject(reason)
        
        return Response({
            'message': 'Swap request rejected',
            'swap_request': self.get_serializer(swap_request).data
        })
    
    @action(detail=True, methods=['post'])
    def publish_to_pool(self, request, pk=None):
        """Publish request to public swap pool"""
        swap_request = self.get_object()
        
        if swap_request.from_user != request.user:
            return Response({
                'error': 'You can only publish your own requests'
            }, status=status.HTTP_403_FORBIDDEN)
        
        swap_request.publish_to_pool()
        
        return Response({
            'message': 'Request published to public pool',
            'swap_request': self.get_serializer(swap_request).data
        })
    
    @action(detail=True, methods=['post'])
    def claim_from_pool(self, request, pk=None):
        """Claim request from public pool"""
        swap_request = self.get_object()
        
        if not swap_request.is_public_pool:
            return Response({
                'error': 'Request is not in public pool'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if swap_request.from_user == request.user:
            return Response({
                'error': 'You cannot claim your own request'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            swap_request.claim_from_pool(request.user)
            return Response({
                'message': 'Request claimed successfully',
                'swap_request': self.get_serializer(swap_request).data
            })
        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


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
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sync_service = None
        if GoogleCalendarService and CalendarSyncService and getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            try:
                gcal_service = GoogleCalendarService()
                self.sync_service = CalendarSyncService(gcal_service)
            except Exception as e:
                logging.warning(f"Failed to initialize Google Calendar sync: {e}")
                self.sync_service = None
    
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
    
    @action(detail=False, methods=['post'], url_path='generate')
    def generate_meetings(self, request):
        logger.debug(f"generate_meetings called with request.data: {request.data}")
        """Generate meetings for a date range"""
        serializer = MeetingGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Extract validated data
            validated_data = serializer.validated_data
            logger.debug(f"Meeting generation request - dates: {validated_data.get('start_date')} to {validated_data.get('end_date')}")
            
            start_date = validated_data.get('start_date')
            end_date = validated_data.get('end_date')
            meeting_types = validated_data.get('meeting_types', ['research_update', 'journal_club'])
            auto_assign_presenters = validated_data.get('auto_assign_presenters', True)
            
            logger.debug(f"Parameters: types={meeting_types} (type: {type(meeting_types)}), auto_assign={auto_assign_presenters}")
            
            # Use the MeetingGenerationService
            from .services.meeting_generation import MeetingGenerationService
            generation_service = MeetingGenerationService()
            
            try:
                result = generation_service.generate_meetings(
                    start_date=start_date,
                    end_date=end_date,
                    meeting_types=meeting_types,
                    auto_assign_presenters=auto_assign_presenters
                )
            except Exception as e:
                logger.error(f"Error in generate_meetings: {e}", exc_info=True)
                return Response({'error': f'Failed to generate meetings: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Return the generated meetings with serialized data
            generated_meetings_data = []
            for meeting_instance in result['generated_meetings']:
                # Get presenters for this meeting
                presenters = meeting_instance.presenters.all() if hasattr(meeting_instance, 'presenters') else []
                
                meeting_data = {
                    'id': meeting_instance.id,
                    'date': meeting_instance.date,
                    'meeting_type': meeting_instance.meeting_type,
                    'status': meeting_instance.status,
                    'presenters': [
                        {
                            'id': presenter.id,
                            'user': {
                                'id': presenter.user.id,
                                'username': presenter.user.username,
                                'first_name': presenter.user.first_name,
                                'last_name': presenter.user.last_name,
                                'email': presenter.user.email
                            }
                        }
                        for presenter in presenters
                    ]
                }
                generated_meetings_data.append(meeting_data)
            
            return Response({
                'success': True,
                'message': f'Successfully generated {result["count"]} meetings',
                'count': result['count'],
                'generated_meetings': generated_meetings_data,
                'date_range': {
                    'start_date': start_date,
                    'end_date': end_date
                }
            }, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to generate meetings: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel meeting"""
        meeting = self.get_object()
        
        # Check permissions - admin or assigned presenter can cancel
        is_presenter = meeting.presenters.filter(
            user=request.user, 
            status__in=['assigned', 'confirmed']
        ).exists()
        
        if not request.user.is_staff and not is_presenter:
            return Response({
                'error': 'You are not authorized to cancel this meeting'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if meeting.status in ['completed', 'cancelled']:
            return Response({
                'error': f'Meeting is already {meeting.status} and cannot be cancelled'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason', 'No reason provided')
        reschedule = request.data.get('reschedule', False)
        
        old_status = meeting.status
        meeting.status = 'cancelled'
        meeting.cancellation_reason = reason
        meeting.cancelled_by = request.user
        meeting.cancelled_at = timezone.now()
        meeting.save()
        
        # Update presenters status
        meeting.presenters.update(status='cancelled')
        
        # If reschedule requested, keep track for rescheduling
        if reschedule:
            # Add metadata for rescheduling
            meeting.metadata = meeting.metadata or {}
            meeting.metadata['reschedule_requested'] = True
            meeting.metadata['reschedule_requested_by'] = request.user.id
            meeting.metadata['reschedule_requested_at'] = timezone.now().isoformat()
            meeting.save()
        
        serializer = self.get_serializer(meeting)
        return Response({
            'message': 'Meeting cancelled successfully',
            'meeting': serializer.data,
            'reason': reason,
            'reschedule_requested': reschedule
        })
    
    def perform_create(self, serializer):
        """Handle meeting creation with Google Calendar sync"""
        meeting = serializer.save()
        
        # Sync to Google Calendar if enabled
        if self.sync_service and getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True):
            try:
                self.sync_service.sync_meeting_to_google(meeting)
                logging.info(f"Meeting {meeting.id} synced to Google Calendar")
            except Exception as e:
                logging.error(f"Failed to sync meeting {meeting.id} to Google Calendar: {e}")
    
    def perform_update(self, serializer):
        """Handle meeting updates with Google Calendar sync"""
        meeting = serializer.save()
        
        # Sync to Google Calendar if enabled
        if self.sync_service and getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True):
            try:
                self.sync_service.sync_meeting_to_google(meeting, force_update=True)
                logging.info(f"Meeting {meeting.id} updated in Google Calendar")
            except Exception as e:
                logging.error(f"Failed to update meeting {meeting.id} in Google Calendar: {e}")
    
    def perform_destroy(self, instance):
        """Handle meeting deletion with Google Calendar sync"""
        # Remove from Google Calendar if enabled
        if self.sync_service and getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True):
            try:
                self.sync_service.remove_meeting_from_google(instance)
                logging.info(f"Meeting {instance.id} removed from Google Calendar")
            except Exception as e:
                logging.error(f"Failed to remove meeting {instance.id} from Google Calendar: {e}")
        
        instance.delete()


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
    
    @action(detail=False, methods=['post'])
    def update_rotation(self, request):
        """Update rotation list with active/inactive status changes"""
        try:
            rotation_type = request.data.get('rotationType', 'research_update')
            rotation_list = request.data.get('rotationList', [])
            
            # Get or create default rotation system
            rotation_system, created = RotationSystem.objects.get_or_create(
                name="Default Rotation",
                defaults={'is_active': True}
            )
            
            # Get current configuration
            config = MeetingConfiguration.objects.first()
            if not config:
                return Response(
                    {'error': 'Meeting configuration not found. Please set up meeting configuration first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update active members based on rotation list
            active_user_ids = []
            inactive_user_ids = []
            
            for entry in rotation_list:
                user_id = entry.get('presenterId')
                is_active = entry.get('isActive', True)
                
                if is_active:
                    active_user_ids.append(user_id)
                else:
                    inactive_user_ids.append(user_id)
            
            # Update meeting configuration active members
            if active_user_ids:
                active_users = User.objects.filter(id__in=active_user_ids)
                config.active_members.set(active_users)
            
            # Remove inactive users from rotation queue or mark them differently
            QueueEntry.objects.filter(
                rotation_system=rotation_system,
                user_id__in=inactive_user_ids
            ).delete()
            
            # Ensure active users have queue entries
            for user_id in active_user_ids:
                user = User.objects.get(id=user_id)
                queue_entry, created = QueueEntry.objects.get_or_create(
                    rotation_system=rotation_system,
                    user=user,
                    defaults={
                        'postpone_count': 0,
                        'priority': 100.0
                    }
                )
            
            # Recalculate priorities
            queue_entries = QueueEntry.objects.filter(rotation_system=rotation_system)
            for entry in queue_entries:
                entry.calculate_priority()
            
            return Response({
                'message': 'Rotation updated successfully',
                'type': rotation_type,
                'active_participants': len(active_user_ids),
                'inactive_participants': len(inactive_user_ids)
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to update rotation: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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


# ===============================================
# Additional API Views (Referenced in URLs)
# ===============================================

class QRCodeScanView(APIView):
    """QR Code scanning endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Process QR code scan"""
        serializer = QRCodeScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        qr_code = serializer.validated_data['qr_code']
        action = request.data.get('action', 'checkin')  # checkin or checkout
        
        try:
            equipment = Equipment.objects.get(qr_code=qr_code, requires_qr_checkin=True)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found or QR check-in not enabled'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if action == 'checkin':
            try:
                equipment.check_in_user(request.user)
                return Response({
                    'message': 'Successfully checked in',
                    'equipment': EquipmentSerializer(equipment).data
                })
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        elif action == 'checkout':
            try:
                usage_log = equipment.check_out_user(request.user)
                return Response({
                    'message': 'Successfully checked out',
                    'equipment': EquipmentSerializer(equipment).data,
                    'usage_log': EquipmentUsageLogSerializer(usage_log).data if usage_log else None
                })
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        else:
            return Response(
                {'error': 'Invalid action. Use "checkin" or "checkout"'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class CalendarEventsView(APIView):
    """Unified calendar events view"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get unified calendar events"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        event_types = request.query_params.get('types', 'all').split(',')
        
        queryset = Event.objects.all()
        
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
        
        if 'all' not in event_types:
            queryset = queryset.filter(event_type__in=event_types)
        
        calendar_events = []
        for event in queryset:
            event_data = CalendarEventSerializer(event).data
            
            # Add type-specific data
            if event.event_type == 'meeting' and hasattr(event, 'meeting_instance'):
                meeting = event.meeting_instance
                presenters = meeting.presenters.all()
                event_data.update({
                    'meeting_type': meeting.meeting_type,
                    'status': meeting.status,
                    'presenters': [{'name': p.user.get_full_name() or p.user.username, 'topic': p.topic} for p in presenters]
                })
            
            calendar_events.append(event_data)
        
        return Response({'events': calendar_events})


class AvailableEquipmentView(APIView):
    """Get available equipment for booking"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get equipment available for booking in date range"""
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
        
        equipment_list = Equipment.objects.filter(is_bookable=True)
        available_equipment = []
        
        for equipment in equipment_list:
            # Check availability in the date range
            conflicts = Booking.objects.filter(
                equipment=equipment,
                event__start_time__date__lte=end_date,
                event__end_time__date__gte=start_date,
                status__in=['confirmed', 'in_progress']
            )
            
            availability_data = EquipmentSerializer(equipment).data
            availability_data['conflicts'] = BookingSerializer(conflicts, many=True).data
            availability_data['is_available'] = not conflicts.exists()
            
            available_equipment.append(availability_data)
        
        return Response({'equipment': available_equipment})


class EquipmentCheckinView(APIView):
    """Equipment check-in endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, equipment_id):
        """Check in to equipment"""
        try:
            equipment = Equipment.objects.get(id=equipment_id)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            equipment.check_in_user(request.user)
            return Response({
                'message': 'Successfully checked in',
                'equipment': EquipmentSerializer(equipment).data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EquipmentCheckoutView(APIView):
    """Equipment check-out endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, equipment_id):
        """Check out from equipment"""
        try:
            equipment = Equipment.objects.get(id=equipment_id)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            usage_log = equipment.check_out_user(request.user)
            return Response({
                'message': 'Successfully checked out',
                'equipment': EquipmentSerializer(equipment).data,
                'usage_log': EquipmentUsageLogSerializer(usage_log).data if usage_log else None
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EquipmentStatusView(APIView):
    """Get real-time equipment status"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, equipment_id):
        """Get equipment status"""
        try:
            equipment = Equipment.objects.get(id=equipment_id)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
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
# ===============================================
# Enhanced Periodic Task Management Views
# ===============================================

class TaskTemplateViewSet(viewsets.ModelViewSet):
    """Task template management API"""
    queryset = TaskTemplate.objects.all()
    serializer_class = TaskTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter templates based on user permissions"""
        queryset = TaskTemplate.objects.all()
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('name')
    
    def perform_create(self, serializer):
        """Set current user as creator"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate/deactivate template"""
        template = self.get_object()
        is_active = request.data.get('is_active', True)
        template.is_active = is_active
        template.save()
        
        return Response({
            'status': 'success',
            'is_active': template.is_active
        })
    
    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """Clone template with new name"""
        template = self.get_object()
        new_name = request.data.get('name', f"{template.name} (Copy)")
        
        # Create new template
        new_template = TaskTemplate.objects.create(
            name=new_name,
            description=template.description,
            task_type=template.task_type,
            category='custom',  # Cloned templates are always custom
            frequency=template.frequency,
            interval=template.interval,
            start_date=template.start_date,
            end_date=template.end_date,
            min_people=template.min_people,
            max_people=template.max_people,
            default_people=template.default_people,
            estimated_hours=template.estimated_hours,
            window_type=template.window_type,
            fixed_start_day=template.fixed_start_day,
            fixed_end_day=template.fixed_end_day,
            flexible_position=template.flexible_position,
            flexible_duration=template.flexible_duration,
            priority=template.priority,
            created_by=request.user,
            is_active=False  # Start as inactive
        )
        
        return Response(TaskTemplateSerializer(new_template).data)


class PeriodicTaskInstanceViewSet(viewsets.ModelViewSet):
    """Periodic task instance management API"""
    queryset = PeriodicTaskInstance.objects.all()
    serializer_class = PeriodicTaskInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sync_service = None
        if GoogleCalendarService and CalendarSyncService and getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            try:
                gcal_service = GoogleCalendarService()
                self.sync_service = CalendarSyncService(gcal_service)
            except Exception as e:
                logging.warning(f"Failed to initialize Google Calendar sync: {e}")
                self.sync_service = None
    
    def get_queryset(self):
        """Filter task instances"""
        queryset = PeriodicTaskInstance.objects.select_related(
            'template', 'completed_by'
        ).prefetch_related('template__created_by')
        
        # Filter by period
        period = self.request.query_params.get('period')
        if period:
            queryset = queryset.filter(scheduled_period=period)
        
        # Filter by status
        task_status = self.request.query_params.get('status')
        if task_status:
            queryset = queryset.filter(status=task_status)
        
        # Filter by assignee
        assignee_id = self.request.query_params.get('assignee')
        if assignee_id:
            try:
                assignee_id = int(assignee_id)
                queryset = queryset.filter(current_assignees__contains=[assignee_id])
            except (ValueError, TypeError):
                pass
        
        # Filter by template
        template_id = self.request.query_params.get('template')
        if template_id:
            queryset = queryset.filter(template_id=template_id)
        
        # Get user's tasks only
        my_tasks = self.request.query_params.get('my_tasks')
        if my_tasks and my_tasks.lower() == 'true':
            queryset = queryset.filter(current_assignees__contains=[self.request.user.id])
        
        return queryset.order_by('-scheduled_period', 'execution_start_date')
    
    @action(detail=False, methods=['get'])
    def my_tasks(self, request):
        """Get current user's tasks"""
        user_id = request.user.id
        
        # Current tasks (pending, in_progress)
        current_tasks = self.get_queryset().filter(
            current_assignees__contains=[user_id],
            status__in=['pending', 'in_progress']
        ).order_by('execution_end_date')
        
        # Upcoming tasks
        upcoming_tasks = self.get_queryset().filter(
            current_assignees__contains=[user_id],
            status='scheduled',
            execution_start_date__gt=date.today()
        ).order_by('execution_start_date')[:5]
        
        # Recently completed tasks
        completed_tasks = self.get_queryset().filter(
            current_assignees__contains=[user_id],
            status='completed'
        ).order_by('-completed_at')[:10]
        
        return Response({
            'current': PeriodicTaskInstanceSerializer(current_tasks, many=True, context={'request': request}).data,
            'upcoming': PeriodicTaskInstanceSerializer(upcoming_tasks, many=True, context={'request': request}).data,
            'completed': PeriodicTaskInstanceSerializer(completed_tasks, many=True, context={'request': request}).data,
            'statistics': self._get_user_statistics(user_id)
        })
    
    def _get_user_statistics(self, user_id):
        """Get user task statistics"""
        all_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user_id]
        )
        
        total_tasks = all_tasks.count()
        completed_tasks = all_tasks.filter(status='completed').count()
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Average completion time
        completed_with_duration = all_tasks.filter(
            status='completed',
            completion_duration__isnull=False
        )
        avg_duration = completed_with_duration.aggregate(
            avg=Avg('completion_duration')
        )['avg'] or 0
        
        return {
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'completion_rate': round(completion_rate, 1),
            'average_completion_time': round(avg_duration, 1) if avg_duration else None
        }
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark task as completed"""
        task = self.get_object()
        
        if not task.can_be_completed_by(request.user):
            return Response(
                {'error': 'You are not assigned to this task'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = TaskCompletionSerializer(data=request.data)
        if serializer.is_valid():
            try:
                task.mark_completed(request.user, **serializer.validated_data)
                
                # Update queue member statistics
                self._update_completion_stats(request.user, task)
                
                return Response({
                    'status': 'success',
                    'message': 'Task marked as completed',
                    'task': PeriodicTaskInstanceSerializer(task, context={'request': request}).data
                })
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def _update_completion_stats(self, user, task):
        """Update queue member completion statistics"""
        try:
            queue = task.template.rotation_queue
            member = queue.queue_members.get(user=user)
            
            duration_hours = None
            if task.completion_duration:
                duration_hours = task.completion_duration / 60.0
            
            member.update_completion_stats(duration_hours)
        except (TaskRotationQueue.DoesNotExist, QueueMember.DoesNotExist):
            pass
    
    @action(detail=True, methods=['post'])
    def update_assignees(self, request, pk=None):
        """Update task assignees (admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        task = self.get_object()
        assignee_ids = request.data.get('assignee_ids', [])
        
        # Validate assignee IDs
        if not isinstance(assignee_ids, list):
            return Response(
                {'error': 'assignee_ids must be a list'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify all users exist
        users = User.objects.filter(id__in=assignee_ids)
        if users.count() != len(assignee_ids):
            return Response(
                {'error': 'One or more user IDs not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update assignees
        old_assignees = list(task.current_assignees)
        task.current_assignees = assignee_ids
        
        # Update assignment metadata
        metadata = task.assignment_metadata or {}
        metadata['manual_adjustments'] = metadata.get('manual_adjustments', [])
        metadata['manual_adjustments'].append({
            'changed_by': request.user.id,
            'changed_at': timezone.now().isoformat(),
            'old_assignees': old_assignees,
            'new_assignees': assignee_ids,
            'reason': request.data.get('reason', '')
        })
        task.assignment_metadata = metadata
        task.save()
        
        return Response(PeriodicTaskInstanceSerializer(task, context={'request': request}).data)
    
    def perform_create(self, serializer):
        """Handle task creation with Google Calendar sync"""
        task = serializer.save()
        
        # Sync to Google Calendar if enabled and task syncing is enabled
        if (self.sync_service and 
            getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True) and 
            getattr(settings, 'GOOGLE_CALENDAR_SYNC_TASKS', False)):
            try:
                self.sync_service.sync_task_to_google(task)
                logging.info(f"Task {task.id} synced to Google Calendar")
            except Exception as e:
                logging.error(f"Failed to sync task {task.id} to Google Calendar: {e}")
    
    def perform_update(self, serializer):
        """Handle task updates with Google Calendar sync"""
        task = serializer.save()
        
        # Sync to Google Calendar if enabled and task syncing is enabled
        if (self.sync_service and 
            getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True) and 
            getattr(settings, 'GOOGLE_CALENDAR_SYNC_TASKS', False)):
            try:
                self.sync_service.sync_task_to_google(task, force_update=True)
                logging.info(f"Task {task.id} updated in Google Calendar")
            except Exception as e:
                logging.error(f"Failed to update task {task.id} in Google Calendar: {e}")
    
    def perform_destroy(self, instance):
        """Handle task deletion with Google Calendar sync"""
        # Remove from Google Calendar if enabled and task syncing is enabled
        if (self.sync_service and 
            getattr(settings, 'GOOGLE_CALENDAR_AUTO_SYNC', True) and 
            getattr(settings, 'GOOGLE_CALENDAR_SYNC_TASKS', False)):
            try:
                self.sync_service.remove_task_from_google(instance)
                logging.info(f"Task {instance.id} removed from Google Calendar")
            except Exception as e:
                logging.error(f"Failed to remove task {instance.id} from Google Calendar: {e}")
        
        instance.delete()


class TaskSwapRequestViewSet(viewsets.ModelViewSet):
    """Task swap request management API"""
    queryset = TaskSwapRequest.objects.all()
    serializer_class = TaskSwapRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter swap requests based on user"""
        queryset = TaskSwapRequest.objects.select_related(
            'task_instance', 'from_user', 'to_user', 'admin_approved_by'
        )
        
        # Filter by status
        request_status = self.request.query_params.get('status')
        if request_status:
            queryset = queryset.filter(status=request_status)
        
        # Filter by request type
        request_type = self.request.query_params.get('type')
        if request_type:
            queryset = queryset.filter(request_type=request_type)
        
        # Get user's requests (sent and received)
        my_requests = self.request.query_params.get('my_requests')
        if my_requests and my_requests.lower() == 'true':
            queryset = queryset.filter(
                Q(from_user=self.request.user) | Q(to_user=self.request.user)
            )
        
        # Get public pool requests
        public_pool = self.request.query_params.get('public_pool')
        if public_pool and public_pool.lower() == 'true':
            queryset = queryset.filter(is_public_pool=True, status='pending')
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Create swap request"""
        task_instance = serializer.validated_data.get('task_instance')
        
        # Verify user is assigned to this task
        if self.request.user.id not in task_instance.current_assignees:
            raise serializers.ValidationError("You are not assigned to this task")
        
        serializer.save(from_user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def create_swap(self, request):
        """Create a task swap request"""
        task_id = request.data.get('task_id')
        to_user_id = request.data.get('to_user_id')
        reason = request.data.get('reason', '')
        is_public = request.data.get('is_public', False)
        
        try:
            task = PeriodicTaskInstance.objects.get(id=task_id)
        except PeriodicTaskInstance.DoesNotExist:
            return Response(
                {'error': 'Task not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify user is assigned to this task
        if request.user.id not in task.current_assignees:
            return Response(
                {'error': 'You are not assigned to this task'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create swap request
        swap_request = TaskSwapRequest.objects.create(
            task_instance=task,
            request_type='transfer' if not to_user_id else 'swap',
            from_user=request.user,
            to_user_id=to_user_id if to_user_id else None,
            reason=reason,
            is_public_pool=is_public and not to_user_id
        )
        
        if is_public and not to_user_id:
            swap_request.publish_to_pool()
        
        return Response(TaskSwapRequestSerializer(swap_request).data)
    
    @action(detail=True, methods=['post'])
    def approve_by_target(self, request, pk=None):
        """Approve swap request by target user"""
        swap_request = self.get_object()
        
        if swap_request.to_user != request.user:
            return Response(
                {'error': 'You are not the target user for this request'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        swap_request.approve_by_target_user()
        return Response(TaskSwapRequestSerializer(swap_request).data)
    
    @action(detail=True, methods=['post'])
    def approve_by_admin(self, request, pk=None):
        """Approve swap request by admin"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        swap_request = self.get_object()
        swap_request.approve_by_admin(request.user)
        return Response(TaskSwapRequestSerializer(swap_request).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject swap request"""
        swap_request = self.get_object()
        
        # Check if user has permission to reject
        can_reject = (
            request.user == swap_request.to_user or 
            request.user.is_staff
        )
        
        if not can_reject:
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        reason = request.data.get('reason', '')
        swap_request.reject(reason)
        return Response(TaskSwapRequestSerializer(swap_request).data)
    
    @action(detail=True, methods=['post'])
    def claim_from_pool(self, request, pk=None):
        """Claim request from public pool"""
        swap_request = self.get_object()
        
        if not swap_request.is_public_pool:
            return Response(
                {'error': 'Request not in public pool'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        swap_request.claim_from_pool(request.user)
        return Response(TaskSwapRequestSerializer(swap_request).data)


class TaskGenerationView(APIView):
    """Task generation and preview API"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Generate or preview tasks for specified periods"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = BatchTaskGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        periods = serializer.validated_data['periods']
        template_ids = serializer.validated_data.get('template_ids')
        preview_only = serializer.validated_data.get('preview_only', True)
        
        # Get templates to process
        templates = TaskTemplate.objects.filter(is_active=True)
        if template_ids:
            templates = templates.filter(id__in=template_ids)
        
        generated_tasks = []
        preview_data = []
        
        try:
            for period in periods:
                for template in templates:
                    if template.should_generate_for_period(period):
                        # Get execution window
                        start_date, end_date = template.get_execution_window(period)
                        
                        # Check if task already exists
                        existing_task = PeriodicTaskInstance.objects.filter(
                            template=template,
                            scheduled_period=period
                        ).first()
                        
                        if existing_task:
                            continue
                        
                        # Get suggested assignees
                        assignees = self._assign_users_to_task(template, period)
                        
                        preview_item = {
                            'period': period,
                            'template_name': template.name,
                            'execution_window': {
                                'start_date': start_date.isoformat(),
                                'end_date': end_date.isoformat()
                            },
                            'suggested_assignees': [user.username for user in assignees],
                            'assignee_details': [{'id': u.id, 'username': u.username, 'email': u.email} for u in assignees]
                        }
                        preview_data.append(preview_item)
                        
                        if not preview_only:
                            # Create the task instance
                            task = PeriodicTaskInstance.objects.create(
                                template=template,
                                template_name=template.name,
                                scheduled_period=period,
                                execution_start_date=start_date,
                                execution_end_date=end_date,
                                current_assignees=[u.id for u in assignees],
                                original_assignees=[u.id for u in assignees],
                                assignment_metadata={
                                    'assigned_at': timezone.now().isoformat(),
                                    'assigned_by': 'system',
                                    'primary_assignee': assignees[0].id if assignees else None
                                }
                            )
                            generated_tasks.append(task)
            
            response_data = {
                'preview': preview_data,
                'summary': {
                    'total_tasks': len(preview_data),
                    'periods': len(periods),
                    'templates': templates.count()
                }
            }
            
            if not preview_only:
                response_data['generated_tasks'] = len(generated_tasks)
                response_data['message'] = f"Successfully generated {len(generated_tasks)} tasks"
            
            return Response(response_data)
            
        except Exception as e:
            return Response(
                {'error': f"Error generating tasks: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _assign_users_to_task(self, template, period):
        """Assign users to task using rotation queue"""
        try:
            rotation_queue = template.rotation_queue
            assigned_members = rotation_queue.assign_members_for_period(period)
            return [member.user for member in assigned_members]
        except:
            # Fallback: get all eligible users
            eligible_users = User.objects.filter(
                is_active=True
            ).exclude(
                username__in=['admin', 'print_server']
            )
            
            # Simple assignment: take first N users
            required_count = template.default_people
            return list(eligible_users[:required_count])


class TaskRotationQueueViewSet(viewsets.ModelViewSet):
    """Task rotation queue management API"""
    queryset = TaskRotationQueue.objects.all()
    serializer_class = TaskRotationQueueSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter rotation queues"""
        return TaskRotationQueue.objects.select_related('template').prefetch_related(
            'queue_members__user'
        ).order_by('template__name')
    
    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        """Add member to rotation queue"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        queue = self.get_object()
        user_id = request.data.get('user_id')
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if already in queue
        if queue.queue_members.filter(user=user).exists():
            return Response(
                {'error': 'User already in queue'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add to queue
        QueueMember.objects.create(
            rotation_queue=queue,
            user=user,
            is_active=True
        )
        
        return Response({'status': 'success', 'message': f'{user.username} added to queue'})
    
    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        """Remove member from rotation queue"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        queue = self.get_object()
        user_id = request.data.get('user_id')
        
        try:
            member = queue.queue_members.get(user_id=user_id)
            member.delete()
            return Response({'status': 'success', 'message': 'Member removed from queue'})
        except QueueMember.DoesNotExist:
            return Response(
                {'error': 'Member not found in queue'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def set_member_availability(self, request, pk=None):
        """Set member availability for specific periods"""
        queue = self.get_object()
        user_id = request.data.get('user_id')
        exclude_periods = request.data.get('exclude_periods', [])
        
        # Users can set their own availability, admins can set anyone's
        if not request.user.is_staff and request.user.id != user_id:
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            member = queue.queue_members.get(user_id=user_id)
            member.set_unavailable_periods(exclude_periods)
            return Response({'status': 'success', 'message': 'Availability updated'})
        except QueueMember.DoesNotExist:
            return Response(
                {'error': 'Member not found in queue'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class TaskStatisticsView(APIView):
    """Task statistics and analytics API"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get comprehensive task statistics"""
        # Overall statistics
        total_tasks = PeriodicTaskInstance.objects.count()
        completed_tasks = PeriodicTaskInstance.objects.filter(status='completed').count()
        overdue_tasks = PeriodicTaskInstance.objects.filter(status='overdue').count()
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Average completion time
        avg_completion = PeriodicTaskInstance.objects.filter(
            status='completed',
            completion_duration__isnull=False
        ).aggregate(avg=Avg('completion_duration'))['avg'] or 0
        
        # User statistics
        user_stats = []
        for user in User.objects.filter(is_active=True).exclude(username__in=['admin', 'print_server']):
            user_tasks = PeriodicTaskInstance.objects.filter(
                current_assignees__contains=[user.id]
            )
            user_completed = user_tasks.filter(status='completed')
            
            user_stats.append({
                'user': user.username,
                'user_id': user.id,
                'total_tasks': user_tasks.count(),
                'completed_tasks': user_completed.count(),
                'completion_rate': (user_completed.count() / user_tasks.count() * 100) if user_tasks.count() > 0 else 0,
                'avg_completion_time': user_completed.aggregate(avg=Avg('completion_duration'))['avg'] or 0
            })
        
        # Template statistics
        template_stats = []
        for template in TaskTemplate.objects.filter(is_active=True):
            template_tasks = PeriodicTaskInstance.objects.filter(template=template)
            template_completed = template_tasks.filter(status='completed')
            
            template_stats.append({
                'template': template.name,
                'template_id': template.id,
                'total_instances': template_tasks.count(),
                'completed_instances': template_completed.count(),
                'completion_rate': (template_completed.count() / template_tasks.count() * 100) if template_tasks.count() > 0 else 0,
                'avg_completion_time': template_completed.aggregate(avg=Avg('completion_duration'))['avg'] or 0
            })
        
        return Response({
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'overdue_tasks': overdue_tasks,
            'completion_rate': round(completion_rate, 1),
            'average_completion_time': round(avg_completion, 1),
            'user_statistics': sorted(user_stats, key=lambda x: x['completion_rate'], reverse=True),
            'template_statistics': sorted(template_stats, key=lambda x: x['completion_rate'], reverse=True)
        })


class InitializeRotationQueuesView(APIView):
    """Initialize rotation queues for all active templates"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Initialize rotation queues"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        templates = TaskTemplate.objects.filter(is_active=True)
        eligible_users = User.objects.filter(
            is_active=True
        ).exclude(
            username__in=['admin', 'print_server']
        )
        
        created_queues = []
        
        for template in templates:
            # Create rotation queue if it doesn't exist
            queue, created = TaskRotationQueue.objects.get_or_create(
                template=template,
                defaults={
                    'algorithm': 'fair_rotation',
                    'min_gap_months': 1,
                    'consider_workload': True,
                    'random_factor': 0.1
                }
            )
            
            if created:
                # Add all eligible users to the queue
                for user in eligible_users:
                    QueueMember.objects.get_or_create(
                        rotation_queue=queue,
                        user=user,
                        defaults={
                            'is_active': True,
                            'total_assignments': 0,
                            'completion_rate': 100.0,
                            'priority_score': 50.0
                        }
                    )
                
                created_queues.append(template.name)
        
        return Response({
            'status': 'success',
            'message': f"Initialized rotation queues for {len(created_queues)} templates",
            'created_queues': created_queues
        })


# ===============================================
# Unified Dashboard API - Phase 1 Optimization
# ===============================================

class UnifiedDashboardViewSet(viewsets.ViewSet):
    """
    Unified dashboard providing all schedule-related information in a single view.
    Optimizes user experience by reducing navigation complexity.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Get unified dashboard overview for current user"""
        user = request.user
        today = timezone.now().date()
        next_week = today + timedelta(days=7)

        try:
            # Today's events
            today_events = self._get_today_events(user, today)

            # Upcoming meetings
            upcoming_meetings = self._get_upcoming_meetings(user, today, next_week)

            # My tasks
            my_tasks = self._get_my_tasks(user)

            # Equipment bookings
            equipment_bookings = self._get_equipment_bookings(user, today, next_week)

            # Pending actions requiring user attention
            pending_actions = self._get_pending_actions(user)

            # Quick stats
            stats = self._get_user_stats(user)

            return Response({
                'today_events': today_events,
                'upcoming_meetings': upcoming_meetings,
                'my_tasks': my_tasks,
                'equipment_bookings': equipment_bookings,
                'pending_actions': pending_actions,
                'stats': stats,
                'last_updated': timezone.now()
            })

        except Exception as e:
            # A simple log for production debugging
            print(f"Error in UnifiedDashboardViewSet.overview for user {user.id}: {e}")
            return Response(
                {'error': f'Failed to load dashboard: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_today_events(self, user, today):
        """Get all events for today"""
        events = Event.objects.filter(
            start_time__date=today
        ).select_related(
            'booking__equipment', 
            'task_instance'
        ).prefetch_related(
            'meeting_instance__presenters__user',
            'task_instance__assigned_to'
        ).order_by('start_time')

        today_events = []
        for event in events:
            event_data = {
                'id': event.id,
                'title': event.title,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'event_type': event.event_type,
                'description': event.description,
                'is_mine': False
            }

            if event.event_type == 'booking' and hasattr(event, 'booking') and event.booking:
                event_data['is_mine'] = event.booking.user == user
                event_data['equipment_name'] = event.booking.equipment.name
                event_data['status'] = event.booking.status
            elif event.event_type == 'meeting' and hasattr(event, 'meeting_instance') and event.meeting_instance:
                presenters = event.meeting_instance.presenters.all()
                event_data['is_mine'] = any(p.user == user for p in presenters)
                event_data['meeting_type'] = event.meeting_instance.meeting_type
            elif event.event_type == 'task' and hasattr(event, 'task_instance') and event.task_instance:
                assigned_users = event.task_instance.assigned_to.all()
                event_data['is_mine'] = user in assigned_users
                event_data['task_status'] = event.task_instance.status

            today_events.append(event_data)

        return today_events

    def _get_upcoming_meetings(self, user, start_date, end_date):
        """Get upcoming meetings for the user"""
        meetings = MeetingInstance.objects.filter(
            date__gt=start_date,
            date__lte=end_date,
            status__in=['scheduled', 'confirmed']
        ).prefetch_related('presenters__user').order_by('date')

        upcoming_meetings = []
        for meeting in meetings[:5]:
            presenters = meeting.presenters.all()
            is_presenter = any(p.user == user for p in presenters)

            meeting_data = {
                'id': meeting.id,
                'date': meeting.date,
                'meeting_type': meeting.meeting_type,
                'status': meeting.status,
                'is_presenter': is_presenter,
                'presenter_names': [p.user.username for p in presenters],
                'materials_required': meeting.meeting_type == 'journal_club',
                'materials_submitted': False
            }

            if is_presenter and meeting.meeting_type == 'journal_club':
                presenter = presenters.filter(user=user).first()
                if presenter:
                    meeting_data['materials_submitted'] = bool(
                        presenter.paper_title or presenter.paper_url or presenter.paper_file
                    )

            upcoming_meetings.append(meeting_data)

        return upcoming_meetings

    def _get_my_tasks(self, user):
        """Get user's assigned tasks"""
        task_instances = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user.id],
            status__in=['scheduled', 'pending', 'in_progress']
        ).select_related('template').order_by('execution_end_date')

        my_tasks = []
        for task in task_instances:
            task_data = {
                'id': task.id,
                'template_name': task.template_name,
                'scheduled_period': task.scheduled_period,
                'execution_start_date': task.execution_start_date,
                'execution_end_date': task.execution_end_date,
                'status': task.status,
                'is_overdue': task.is_overdue(),
                'priority': task.template.priority if task.template else 'medium',
                'estimated_hours': task.template.estimated_hours if task.template else None,
                'can_complete': task.can_be_completed_by(user),
                'is_primary': task.get_primary_assignee() == user
            }
            my_tasks.append(task_data)

        return my_tasks

    def _get_equipment_bookings(self, user, start_date, end_date):
        """Get user's equipment bookings"""
        bookings = Booking.objects.filter(
            user=user,
            event__start_time__date__gte=start_date,
            event__end_time__date__lte=end_date,
            status__in=['confirmed', 'pending', 'in_progress']
        ).select_related('equipment', 'event').order_by('event__start_time')

        equipment_bookings = []
        for booking in bookings:
            time_until_val = None
            if booking.event.start_time > timezone.now():
                time_until_val = (booking.event.start_time - timezone.now()).total_seconds() / 3600

            booking_data = {
                'id': booking.id,
                'equipment_name': booking.equipment.name,
                'equipment_location': booking.equipment.location,
                'start_time': booking.event.start_time,
                'end_time': booking.event.end_time,
                'status': booking.status,
                'requires_qr_checkin': booking.equipment.requires_qr_checkin,
                'is_today': booking.event.start_time.date() == start_date,
                'time_until': time_until_val
            }
            equipment_bookings.append(booking_data)

        return equipment_bookings

    def _get_pending_actions(self, user):
        """Get actions requiring user attention"""
        pending_actions = []

        jc_meetings = MeetingInstance.objects.filter(
            meeting_type='journal_club',
            date__gt=timezone.now().date(),
            presenters__user=user,
            presenters__materials_submitted_at__isnull=True
        ).prefetch_related('presenters')

        for meeting in jc_meetings:
            presenter = meeting.presenters.filter(user=user).first()
            if presenter:
                days_until = (meeting.date - timezone.now().date()).days
                urgency = 'high' if days_until <= 3 else 'medium' if days_until <= 7 else 'low'
                pending_actions.append({
                    'type': 'journal_club_submission',
                    'title': 'Submit Journal Club Paper',
                    'description': f'Paper submission required for {meeting.date}',
                    'urgency': urgency,
                    'due_date': meeting.date,
                    'days_remaining': days_until,
                    'action_url': f'/schedule/meetings/{meeting.id}/paper-submission/',
                    'meeting_id': meeting.id
                })

        if user.is_staff:
            pending_swaps = TaskSwapRequest.objects.filter(
                status='pending',
                admin_approved__isnull=True
            ).select_related('from_user', 'task_instance__template')
            for swap in pending_swaps:
                pending_actions.append({
                    'type': 'task_swap_approval',
                    'title': 'Task Swap Request',
                    'description': f'{swap.from_user.username} requests to swap {swap.task_instance.template_name}',
                    'urgency': 'medium',
                    'action_url': f'/schedule/task-swap-requests/{swap.id}/',
                    'swap_id': swap.id
                })

        meeting_swaps = SwapRequest.objects.filter(
            target_presentation__user=user,
            status='pending',
            target_user_approved__isnull=True
        ).select_related('requester', 'original_presentation__meeting_instance')
        for swap in meeting_swaps:
            pending_actions.append({
                'type': 'meeting_swap_approval',
                'title': 'Meeting Swap Request',
                'description': f'{swap.requester.username} wants to swap presentation for {swap.original_presentation.meeting_instance.date}',
                'urgency': 'medium',
                'action_url': f'/schedule/swap-requests/{swap.id}/',
                'swap_id': swap.id
            })

        return pending_actions

    def _get_user_stats(self, user):
        """Get user statistics"""
        now = timezone.now()
        this_year = now.year

        # Count total presentations with meaningful statuses (assigned, confirmed, completed)
        # Only exclude swapped and postponed presentations
        presentations_total = Presenter.objects.filter(
            user=user
        ).exclude(
            status__in=['swapped', 'postponed']
        ).count()
        
        # Also keep the current year count for potential future use
        presentations_this_year = Presenter.objects.filter(
            user=user,
            meeting_instance__date__year=this_year
        ).exclude(
            status__in=['swapped', 'postponed']
        ).count()

        # Use icontains for SQLite compatibility instead of contains for JSON field
        tasks_completed = PeriodicTaskInstance.objects.filter(
            current_assignees__icontains=f'"{user.id}"',
            status='completed',
            completed_at__year=this_year
        ).count()

        usage_logs = EquipmentUsageLog.objects.filter(
            user=user,
            check_in_time__month=now.month,
            check_in_time__year=now.year,
            is_active=False
        )
        total_hours = sum(log.usage_duration.total_seconds() / 3600 for log in usage_logs if log.usage_duration)

        return {
            'presentations_total': presentations_total,
            'presentations_this_year': presentations_this_year,
            'tasks_completed_this_year': tasks_completed,
            'equipment_hours_this_month': round(total_hours, 1),
            'active_bookings': Booking.objects.filter(user=user, status__in=['confirmed', 'in_progress']).count(),
            'pending_swap_requests': TaskSwapRequest.objects.filter(from_user=user, status='pending').count()
        }


# ===============================================
# Quick Action APIs - Phase 2 Optimization  
# ===============================================

class QuickActionViewSet(viewsets.ViewSet):
    """
    Quick actions for streamlined user interactions.
    Reduces multi-step workflows to single actions.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def quick_book_equipment(self, request):
        """One-click equipment booking with intelligent defaults"""
        equipment_id = request.data.get('equipment_id')
        duration_minutes = request.data.get('duration_minutes', 60)
        start_time_str = request.data.get('start_time')  # Optional, defaults to now
        auto_checkin = request.data.get('auto_checkin', False)
        
        try:
            equipment = Equipment.objects.get(id=equipment_id, is_bookable=True)
        except Equipment.DoesNotExist:
            return Response(
                {'error': 'Equipment not found or not bookable'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Parse start time or use now
        if start_time_str:
            try:
                start_time = timezone.datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            except ValueError:
                return Response(
                    {'error': 'Invalid start_time format'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            start_time = timezone.now()
        
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        # Check for conflicts
        conflicts = Booking.objects.filter(
            equipment=equipment,
            event__start_time__lt=end_time,
            event__end_time__gt=start_time,
            status__in=['confirmed', 'pending']
        )
        
        if conflicts.exists():
            return Response(
                {'error': 'Time slot conflicts with existing booking'}, 
                status=status.HTTP_409_CONFLICT
            )
        
        # Create event and booking
        event = Event.objects.create(
            title=f"{equipment.name} Booking",
            start_time=start_time,
            end_time=end_time,
            event_type='booking',
            description=f"Quick booking by {request.user.username}",
            created_by=request.user
        )
        
        booking = Booking.objects.create(
            event=event,
            user=request.user,
            equipment=equipment,
            status='confirmed',
            notes=f"Quick booking - {duration_minutes} minutes"
        )
        
        # Auto check-in if requested and equipment supports QR
        if auto_checkin and equipment.requires_qr_checkin and not equipment.is_in_use:
            try:
                equipment.check_in_user(request.user)
                booking.status = 'in_progress'
                booking.save()
            except ValueError as e:
                # Booking created but check-in failed
                pass
        
        return Response({
            'status': 'success',
            'message': f'Equipment booked successfully for {duration_minutes} minutes',
            'booking': {
                'id': booking.id,
                'equipment_name': equipment.name,
                'start_time': start_time,
                'end_time': end_time,
                'status': booking.status,
                'auto_checked_in': auto_checkin and equipment.requires_qr_checkin and not equipment.is_in_use
            }
        })
    
    @action(detail=False, methods=['post'])
    def extend_booking(self, request):
        """Extend current booking duration"""
        booking_id = request.data.get('booking_id')
        extra_minutes = request.data.get('extra_minutes', 30)
        
        try:
            booking = Booking.objects.get(
                id=booking_id,
                user=request.user,
                status__in=['confirmed', 'in_progress']
            )
        except Booking.DoesNotExist:
            return Response(
                {'error': 'Booking not found or not owned by user'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate new end time
        new_end_time = booking.event.end_time + timedelta(minutes=extra_minutes)
        
        # Check for conflicts with the extension
        conflicts = Booking.objects.filter(
            equipment=booking.equipment,
            event__start_time__lt=new_end_time,
            event__end_time__gt=booking.event.end_time,
            status__in=['confirmed', 'pending']
        ).exclude(id=booking.id)
        
        if conflicts.exists():
            next_booking = conflicts.order_by('event__start_time').first()
            max_extension = (next_booking.event.start_time - booking.event.end_time).total_seconds() / 60
            return Response(
                {
                    'error': f'Cannot extend by {extra_minutes} minutes. Maximum extension: {int(max_extension)} minutes',
                    'max_extension_minutes': int(max_extension)
                }, 
                status=status.HTTP_409_CONFLICT
            )
        
        # Update booking
        booking.event.end_time = new_end_time
        booking.event.save()
        
        return Response({
            'status': 'success',
            'message': f'Booking extended by {extra_minutes} minutes',
            'new_end_time': new_end_time
        })
    
    @action(detail=False, methods=['post'])
    def complete_task(self, request):
        """Quick task completion with optional evidence upload"""
        task_id = request.data.get('task_id')
        completion_notes = request.data.get('completion_notes', '')
        completion_duration = request.data.get('completion_duration')  # in minutes
        completion_rating = request.data.get('completion_rating')  # 1-5 scale
        
        try:
            task = PeriodicTaskInstance.objects.get(id=task_id)
        except PeriodicTaskInstance.DoesNotExist:
            return Response(
                {'error': 'Task not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not task.can_be_completed_by(request.user):
            return Response(
                {'error': 'You are not assigned to this task'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Complete the task
        completion_data = {
            'completion_notes': completion_notes,
        }
        
        if completion_duration:
            completion_data['completion_duration'] = completion_duration
        if completion_rating:
            completion_data['completion_rating'] = completion_rating
        
        task.mark_completed(request.user, **completion_data)
        
        # Update queue member statistics
        if hasattr(task.template, 'rotation_queue'):
            queue_member = QueueMember.objects.filter(
                rotation_queue=task.template.rotation_queue,
                user=request.user
            ).first()
            if queue_member:
                completion_hours = completion_duration / 60 if completion_duration else None
                queue_member.update_completion_stats(completion_hours)
        
        return Response({
            'status': 'success',
            'message': 'Task completed successfully',
            'completed_at': task.completed_at,
            'completion_duration': task.completion_duration,
            'completion_rating': task.completion_rating
        })


# Import additional views for intelligent meeting management
from .additional_views import (
    AdminDashboardView, PersonalDashboardView, QuebecHolidaysView,
    IsHolidayView, NextAvailableDateView, GenerateMeetingsView,
    UploadPaperView, SubmitPaperUrlView, PaperSubmissionView,
    DistributePaperView, PaperArchiveView, SendNotificationView,
    NotificationHistoryView, FileUploadView, FileDownloadView,
    FileDeleteView, UsersView, UserDetailView
)
