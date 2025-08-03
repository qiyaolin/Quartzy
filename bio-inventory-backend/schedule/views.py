from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from datetime import datetime, date
from django.utils.dateparse import parse_date
from .models import Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, RecurringTask, TaskInstance
from .serializers import (
    EventSerializer, EquipmentSerializer, BookingSerializer, 
    GroupMeetingSerializer, MeetingPresenterRotationSerializer, 
    RecurringTaskSerializer, TaskInstanceSerializer, CalendarEventSerializer
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