"""
Frontend-compatible API views for schedule management
Maps existing backend models to match frontend API expectations
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth.models import User
from datetime import datetime, date, timedelta
from django.utils.dateparse import parse_date
from django.utils import timezone

from .models import (
    Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, 
    RecurringTask, TaskInstance, EquipmentUsageLog
)
from .serializers import (
    EventSerializer, EquipmentSerializer, BookingSerializer,
    GroupMeetingSerializer, MeetingPresenterRotationSerializer,
    RecurringTaskSerializer, TaskInstanceSerializer,
    UserSerializer
)


class ScheduleViewSet(viewsets.ModelViewSet):
    """
    Frontend-compatible Schedule API
    Maps to Event model to match frontend expectations
    """
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter events based on frontend query parameters"""
        queryset = Event.objects.all().order_by('start_time')
        
        # Date filtering for frontend calendar views
        date_param = self.request.query_params.get('date')
        view_param = self.request.query_params.get('view', 'day')
        
        if date_param:
            try:
                target_date = parse_date(date_param)
                if target_date:
                    if view_param == 'day':
                        queryset = queryset.filter(start_time__date=target_date)
                    elif view_param == 'week':
                        # Get week range
                        week_start = target_date - timedelta(days=target_date.weekday())
                        week_end = week_start + timedelta(days=6)
                        queryset = queryset.filter(
                            start_time__date__gte=week_start,
                            start_time__date__lte=week_end
                        )
                    elif view_param == 'month':
                        # Get month range
                        month_start = target_date.replace(day=1)
                        if target_date.month == 12:
                            month_end = target_date.replace(year=target_date.year + 1, month=1, day=1) - timedelta(days=1)
                        else:
                            month_end = target_date.replace(month=target_date.month + 1, day=1) - timedelta(days=1)
                        queryset = queryset.filter(
                            start_time__date__gte=month_start,
                            start_time__date__lte=month_end
                        )
            except ValueError:
                pass
        
        # Status filtering
        status_filter = self.request.query_params.get('status')
        if status_filter:
            # Map frontend status to backend booking status
            if hasattr(Event, 'booking'):
                queryset = queryset.filter(booking__status=status_filter)
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(description__icontains=search)
            )
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create schedule with proper frontend data mapping"""
        data = request.data.copy()
        
        # Map frontend fields to backend Event model
        event_data = {
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'event_type': 'meeting',  # Default type
            'created_by': request.user
        }
        
        # Handle date/time formatting from frontend
        date_str = data.get('date', '')
        start_time_str = data.get('start_time', '')
        end_time_str = data.get('end_time', '')
        
        if date_str and start_time_str:
            try:
                event_data['start_time'] = timezone.make_aware(
                    datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
                )
            except ValueError:
                return Response(
                    {'error': 'Invalid date/time format'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if date_str and end_time_str:
            try:
                event_data['end_time'] = timezone.make_aware(
                    datetime.strptime(f"{date_str} {end_time_str}", "%Y-%m-%d %H:%M")
                )
            except ValueError:
                # Default to 1 hour if end time invalid
                if event_data.get('start_time'):
                    event_data['end_time'] = event_data['start_time'] + timedelta(hours=1)
        
        # Create the event
        event = Event.objects.create(**event_data)
        
        # Return frontend-compatible response
        response_data = {
            'id': event.id,
            'title': event.title,
            'description': event.description,
            'date': event.start_time.date().isoformat() if event.start_time else '',
            'start_time': event.start_time.time().strftime('%H:%M') if event.start_time else '',
            'end_time': event.end_time.time().strftime('%H:%M') if event.end_time else '',
            'location': data.get('location', ''),
            'status': data.get('status', 'scheduled'),
            'created_at': event.created_at.isoformat(),
            'updated_at': event.updated_at.isoformat()
        }
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    def list(self, request, *args, **kwargs):
        """Return frontend-compatible schedule list"""
        queryset = self.get_queryset()
        schedules = []
        
        for event in queryset:
            schedule_data = {
                'id': event.id,
                'title': event.title,
                'description': event.description,
                'date': event.start_time.date().isoformat() if event.start_time else '',
                'start_time': event.start_time.time().strftime('%H:%M') if event.start_time else '',
                'end_time': event.end_time.time().strftime('%H:%M') if event.end_time else '',
                'location': '',  # Default empty
                'status': 'scheduled',  # Default status
                'attendees_count': 0,  # Default
                'created_at': event.created_at.isoformat(),
                'updated_at': event.updated_at.isoformat()
            }
            
            # Add type-specific information
            if hasattr(event, 'booking'):
                booking = event.booking
                schedule_data.update({
                    'location': booking.equipment.location,
                    'status': booking.status,
                    'equipment_name': booking.equipment.name
                })
            elif hasattr(event, 'group_meeting'):
                meeting = event.group_meeting
                schedule_data.update({
                    'presenter': meeting.presenter.username if meeting.presenter else '',
                    'topic': meeting.topic
                })
            elif hasattr(event, 'task_instance'):
                task = event.task_instance
                schedule_data.update({
                    'status': task.status,
                    'attendees_count': task.assigned_to.count()
                })
            
            schedules.append(schedule_data)
        
        return Response(schedules)
    
    @action(detail=False, methods=['post'])
    def initialize_defaults(self, request):
        """Initialize default schedules for new users"""
        # Create some sample events for demonstration
        today = timezone.now().date()
        defaults = []
        
        # Create sample lab meeting
        lab_meeting = Event.objects.create(
            title='Weekly Lab Meeting',
            description='Regular team coordination meeting',
            start_time=timezone.make_aware(
                datetime.combine(today + timedelta(days=1), datetime.min.time().replace(hour=10))
            ),
            end_time=timezone.make_aware(
                datetime.combine(today + timedelta(days=1), datetime.min.time().replace(hour=11))
            ),
            event_type='meeting',
            created_by=request.user
        )
        
        defaults.append({
            'id': lab_meeting.id,
            'title': lab_meeting.title,
            'description': lab_meeting.description,
            'date': lab_meeting.start_time.date().isoformat(),
            'start_time': lab_meeting.start_time.time().strftime('%H:%M'),
            'end_time': lab_meeting.end_time.time().strftime('%H:%M'),
            'location': 'Conference Room',
            'status': 'scheduled',
            'created_at': lab_meeting.created_at.isoformat(),
            'updated_at': lab_meeting.updated_at.isoformat()
        })
        
        # Create sample equipment maintenance task
        maintenance_task = Event.objects.create(
            title='Monthly Equipment Maintenance',
            description='Routine maintenance of lab equipment',
            start_time=timezone.make_aware(
                datetime.combine(today + timedelta(days=7), datetime.min.time().replace(hour=14))
            ),
            end_time=timezone.make_aware(
                datetime.combine(today + timedelta(days=7), datetime.min.time().replace(hour=16))
            ),
            event_type='task',
            created_by=request.user
        )
        
        defaults.append({
            'id': maintenance_task.id,
            'title': maintenance_task.title,
            'description': maintenance_task.description,
            'date': maintenance_task.start_time.date().isoformat(),
            'start_time': maintenance_task.start_time.time().strftime('%H:%M'),
            'end_time': maintenance_task.end_time.time().strftime('%H:%M'),
            'location': 'Lab',
            'status': 'pending',
            'created_at': maintenance_task.created_at.isoformat(),
            'updated_at': maintenance_task.updated_at.isoformat()
        })
        
        return Response(defaults)


class FrontendEquipmentViewSet(viewsets.ModelViewSet):
    """
    Frontend-compatible Equipment API
    Extends existing Equipment functionality for frontend
    """
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def initialize_defaults(self, request):
        """Initialize default equipment for new users"""
        # Create sample equipment if none exists
        if Equipment.objects.count() == 0:
            defaults = []
            
            equipment_data = [
                {
                    'name': 'Biosafety Cabinet BSC-1',
                    'description': 'Class II Type A2 Biosafety Cabinet',
                    'location': 'Lab Room 201',
                    'requires_qr_checkin': True,
                    'is_bookable': True
                },
                {
                    'name': 'Microscope - Olympus IX73',
                    'description': 'Inverted fluorescence microscope',
                    'location': 'Imaging Room',
                    'requires_qr_checkin': True,
                    'is_bookable': True
                },
                {
                    'name': 'PCR Machine - Applied Biosystems',
                    'description': 'Thermal cycler for PCR reactions',
                    'location': 'Molecular Lab',
                    'requires_qr_checkin': False,
                    'is_bookable': True
                },
                {
                    'name': 'Centrifuge - Eppendorf 5810R',
                    'description': 'Refrigerated tabletop centrifuge',
                    'location': 'General Lab',
                    'requires_qr_checkin': False,
                    'is_bookable': True
                }
            ]
            
            for eq_data in equipment_data:
                equipment = Equipment.objects.create(**eq_data)
                defaults.append({
                    'id': equipment.id,
                    'name': equipment.name,
                    'description': equipment.description,
                    'location': equipment.location,
                    'is_bookable': equipment.is_bookable,
                    'requires_qr_checkin': equipment.requires_qr_checkin,
                    'qr_code': equipment.qr_code,
                    'is_in_use': equipment.is_in_use,
                    'current_user': None,
                    'current_checkin_time': None,
                    'current_usage_duration': None,
                    'created_at': equipment.created_at.isoformat(),
                    'updated_at': equipment.updated_at.isoformat()
                })
            
            return Response(defaults)
        else:
            # Return existing equipment
            equipment_list = []
            for equipment in Equipment.objects.all():
                equipment_list.append({
                    'id': equipment.id,
                    'name': equipment.name,
                    'description': equipment.description,
                    'location': equipment.location,
                    'is_bookable': equipment.is_bookable,
                    'requires_qr_checkin': equipment.requires_qr_checkin,
                    'qr_code': equipment.qr_code,
                    'is_in_use': equipment.is_in_use,
                    'current_user': UserSerializer(equipment.current_user).data if equipment.current_user else None,
                    'current_checkin_time': equipment.current_checkin_time.isoformat() if equipment.current_checkin_time else None,
                    'current_usage_duration': str(equipment.current_usage_duration) if equipment.current_usage_duration else None,
                    'created_at': equipment.created_at.isoformat(),
                    'updated_at': equipment.updated_at.isoformat()
                })
            
            return Response(equipment_list)


class FrontendGroupMeetingViewSet(viewsets.ModelViewSet):
    """
    Frontend-compatible Group Meeting API
    """
    queryset = GroupMeeting.objects.all()
    serializer_class = GroupMeetingSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        """Return group meetings with frontend-compatible format"""
        meetings = []
        
        for meeting in GroupMeeting.objects.select_related('event', 'presenter'):
            meeting_data = {
                'id': meeting.id,
                'title': meeting.event.title,
                'description': meeting.event.description,
                'date': meeting.event.start_time.date().isoformat() if meeting.event.start_time else '',
                'start_time': meeting.event.start_time.time().strftime('%H:%M') if meeting.event.start_time else '',
                'end_time': meeting.event.end_time.time().strftime('%H:%M') if meeting.event.end_time else '',
                'location': '',  # Default
                'status': 'scheduled',  # Default
                'meeting_type': 'lab_meeting',  # Default
                'topic': meeting.topic,
                'presenter_ids': [meeting.presenter.id] if meeting.presenter else [],
                'presenters': [UserSerializer(meeting.presenter).data] if meeting.presenter else [],
                'materials_url': meeting.materials_url,
                'materials_file': meeting.materials_file.url if meeting.materials_file else None,
                'created_at': meeting.event.created_at.isoformat(),
                'updated_at': meeting.event.updated_at.isoformat()
            }
            meetings.append(meeting_data)
        
        return Response(meetings)


class FrontendUserViewSet(viewsets.ModelViewSet):
    """
    Frontend-compatible User API for active users
    """
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active users for frontend"""
        users = []
        for user in User.objects.filter(is_active=True).order_by('username'):
            users.append({
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'is_active': user.is_active
            })
        
        return Response(users)


class FrontendMeetingConfigurationViewSet(viewsets.ModelViewSet):
    """
    Frontend-compatible Meeting Configuration API
    """
    queryset = MeetingPresenterRotation.objects.all()
    serializer_class = MeetingPresenterRotationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        """Return meeting configurations in frontend format"""
        configs = []
        
        for rotation in MeetingPresenterRotation.objects.prefetch_related('user_list'):
            config_data = {
                'id': rotation.id,
                'meeting_type': 'lab_meeting',  # Default
                'title_template': rotation.name,
                'default_duration_minutes': 60,  # Default
                'default_location': 'Conference Room',  # Default
                'default_day_of_week': 1,  # Monday
                'default_time': '10:00',  # Default
                'presenter_count': rotation.user_list.count(),
                'auto_generate_weeks_ahead': 4,  # Default
                'is_active': rotation.is_active,
                'created_at': rotation.created_at.isoformat(),
                'updated_at': rotation.updated_at.isoformat()
            }
            configs.append(config_data)
        
        return Response(configs)


class FrontendRecurringTaskViewSet(viewsets.ModelViewSet):
    """
    Frontend-compatible Recurring Task API
    """
    queryset = RecurringTask.objects.all()
    serializer_class = RecurringTaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        """Return recurring tasks in frontend format"""
        tasks = []
        
        for task in RecurringTask.objects.prefetch_related('assignee_group'):
            task_data = {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'task_type': 'cell_culture_room_cleaning',  # Default
                'frequency': 'monthly',  # Default
                'assignee_count': task.assignee_group.count(),
                'location': 'Lab',  # Default
                'estimated_duration_hours': 2,  # Default
                'auto_assign': True,  # Default
                'next_due_date': (timezone.now().date() + timedelta(days=30)).isoformat(),  # Default
                'is_active': task.is_active,
                'created_at': task.created_at.isoformat(),
                'updated_at': task.updated_at.isoformat()
            }
            tasks.append(task_data)
        
        return Response(tasks)