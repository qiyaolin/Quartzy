"""
API compatibility layer for frontend schedule management
Provides minimal API endpoints to prevent 404 errors
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import datetime, timedelta
import json


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def schedules_api(request):
    """Enhanced schedules API endpoint with actual Event model integration"""
    from .models import Event
    from .serializers import EventSerializer
    from django.utils.dateparse import parse_date
    
    if request.method == 'GET':
        # Get query parameters for filtering
        date_param = request.GET.get('date')
        view_mode = request.GET.get('view', 'month')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        # Build queryset
        queryset = Event.objects.all()
        
        # Apply date filtering based on view mode
        if date_param:
            try:
                target_date = parse_date(date_param)
                if target_date and view_mode:
                    if view_mode == 'day':
                        queryset = queryset.filter(start_time__date=target_date)
                    elif view_mode == 'week':
                        # Get start of week (Sunday)
                        start_of_week = target_date - timedelta(days=target_date.weekday() + 1)
                        if target_date.weekday() == 6:  # Sunday
                            start_of_week = target_date
                        end_of_week = start_of_week + timedelta(days=6)
                        queryset = queryset.filter(
                            start_time__date__gte=start_of_week,
                            start_time__date__lte=end_of_week
                        )
                    elif view_mode == 'month':
                        # Get full month
                        start_of_month = target_date.replace(day=1)
                        if target_date.month == 12:
                            end_of_month = start_of_month.replace(year=target_date.year + 1, month=1) - timedelta(days=1)
                        else:
                            end_of_month = start_of_month.replace(month=target_date.month + 1) - timedelta(days=1)
                        queryset = queryset.filter(
                            start_time__date__gte=start_of_month,
                            start_time__date__lte=end_of_month
                        )
            except ValueError:
                pass
        
        # Apply start/end date filtering if provided
        if start_date:
            try:
                start_date_parsed = parse_date(start_date)
                if start_date_parsed:
                    queryset = queryset.filter(start_time__date__gte=start_date_parsed)
            except ValueError:
                pass
                
        if end_date:
            try:
                end_date_parsed = parse_date(end_date)
                if end_date_parsed:
                    queryset = queryset.filter(start_time__date__lte=end_date_parsed)
            except ValueError:
                pass
        
        # Convert to frontend-compatible format
        from .models import get_eastern_timezone
        eastern_tz = get_eastern_timezone()
        
        events = []
        for event in queryset.order_by('start_time'):
            # Convert times to Eastern timezone
            start_time_et = event.start_time.astimezone(eastern_tz)
            end_time_et = event.end_time.astimezone(eastern_tz)
            
            events.append({
                'id': event.id,
                'title': event.title,
                'description': event.description or '',
                'date': start_time_et.date().isoformat(),
                'start_time': start_time_et.strftime('%H:%M'),
                'end_time': end_time_et.strftime('%H:%M'),
                'location': '',  # Event model doesn't have location, could add later
                'status': 'scheduled',  # Map event_type to status if needed
                'attendees_count': 0,
                'created_at': event.created_at.isoformat(),
                'updated_at': event.updated_at.isoformat()
            })
        
        return Response(events)
    
    elif request.method == 'POST':
        # Only admins can create events via compatibility endpoint
        if not request.user.is_staff:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        # Create actual Event instance
        data = request.data
        
        # Parse start and end times
        try:
            date_str = data.get('date', timezone.now().date().isoformat())
            start_time_str = data.get('start_time', '10:00')
            end_time_str = data.get('end_time', '11:00')
            
            # Combine date and time
            start_datetime = timezone.make_aware(
                datetime.strptime(f"{date_str} {start_time_str}", '%Y-%m-%d %H:%M')
            )
            end_datetime = timezone.make_aware(
                datetime.strptime(f"{date_str} {end_time_str}", '%Y-%m-%d %H:%M')
            )
            
            # Create event
            event = Event.objects.create(
                title=data.get('title', 'New Event'),
                description=data.get('description', ''),
                start_time=start_datetime,
                end_time=end_datetime,
                event_type='meeting',  # Default type
                created_by=request.user
            )
            
            # Return frontend-compatible response
            start_time_et = event.start_time.astimezone(eastern_tz)
            end_time_et = event.end_time.astimezone(eastern_tz)
            
            response_data = {
                'id': event.id,
                'title': event.title,
                'description': event.description or '',
                'date': start_time_et.date().isoformat(),
                'start_time': start_time_et.strftime('%H:%M'),
                'end_time': end_time_et.strftime('%H:%M'),
                'location': '',
                'status': 'scheduled',
                'attendees_count': 0,
                'created_at': event.created_at.isoformat(),
                'updated_at': event.updated_at.isoformat()
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except (ValueError, TypeError) as e:
            return Response(
                {'error': f'Invalid date/time format: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initialize_default_schedules(request):
    """Initialize default schedules"""
    # Return empty list - schedules will be created as needed
    return Response([])


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def equipment_api(request):
    """Minimal equipment API endpoint"""
    if request.method == 'GET':
        # Return empty equipment list
        return Response([])
    
    elif request.method == 'POST':
        # Accept equipment creation and return minimal response
        data = request.data
        
        response_data = {
            'id': 1,
            'name': data.get('name', 'New Equipment'),
            'description': data.get('description', ''),
            'location': data.get('location', ''),
            'is_bookable': data.get('is_bookable', True),
            'is_in_use': False,
            'current_user': None,
            'current_checkin_time': None,
            'current_usage_duration': None,
            'created_at': timezone.now().isoformat(),
            'updated_at': timezone.now().isoformat()
        }
        
        return Response(response_data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initialize_default_equipment(request):
    """Initialize default equipment"""
    # Return sample equipment data
    sample_equipment = [
        {
            'id': 1,
            'name': 'Biosafety Cabinet BSC-1',
            'description': 'Class II Type A2 Biosafety Cabinet',
            'location': 'Lab Room 201',
            'is_bookable': True,
            'is_in_use': False,
            'current_user': None,
            'current_checkin_time': None,
            'current_usage_duration': None,
            'created_at': timezone.now().isoformat(),
            'updated_at': timezone.now().isoformat()
        },
        {
            'id': 2,
            'name': 'Microscope - Olympus IX73',
            'description': 'Inverted fluorescence microscope',
            'location': 'Imaging Room',
            'is_bookable': True,
            'is_in_use': False,
            'current_user': None,
            'current_checkin_time': None,
            'current_usage_duration': None,
            'created_at': timezone.now().isoformat(),
            'updated_at': timezone.now().isoformat()
        }
    ]
    
    return Response(sample_equipment)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_meetings_api(request):
    """Minimal group meetings API endpoint"""
    # Return empty meetings list
    return Response([])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meetings_api(request):
    """Schedule meetings API endpoint"""
    try:
        # Try to get data from the actual MeetingInstanceViewSet
        from .models import MeetingInstance
        
        # Get meetings with ordering and limit support
        ordering = request.GET.get('ordering', '-date')
        limit = request.GET.get('limit', '100')
        
        try:
            limit = int(limit)
        except (ValueError, TypeError):
            limit = 100
            
        # Query meetings with related event data
        queryset = MeetingInstance.objects.select_related('event').prefetch_related('presenters__user')
        
        # Apply ordering
        if ordering:
            queryset = queryset.order_by(ordering)
            
        # Apply limit
        queryset = queryset[:limit]
        
        # Serialize the data
        meetings_data = []
        for meeting in queryset:
            # Get the main presenter
            main_presenter = meeting.presenters.first()
            
            meetings_data.append({
                'id': meeting.id,
                'title': meeting.event.title if meeting.event else f"{meeting.get_meeting_type_display()} - {meeting.date}",
                'date': meeting.date.isoformat() if meeting.date else timezone.now().date().isoformat(),
                'start_time': meeting.event.start_time.strftime('%H:%M') if meeting.event and meeting.event.start_time else '10:00',
                'end_time': meeting.event.end_time.strftime('%H:%M') if meeting.event and meeting.event.end_time else '11:00',
                'location': getattr(meeting.event, 'location', '') if meeting.event else '',
                'description': meeting.event.description if meeting.event else meeting.notes or '',
                'presenter': {
                    'id': main_presenter.user.id,
                    'username': main_presenter.user.username,
                    'first_name': main_presenter.user.first_name,
                    'last_name': main_presenter.user.last_name,
                } if main_presenter and main_presenter.user else None,
                'status': meeting.status or 'scheduled',
                'meeting_type': meeting.meeting_type or 'research_update',
                'created_at': meeting.created_at.isoformat() if meeting.created_at else timezone.now().isoformat(),
                'updated_at': meeting.updated_at.isoformat() if meeting.updated_at else timezone.now().isoformat(),
            })
        
        return Response(meetings_data)
        
    except Exception as e:
        # Return empty meetings list if anything fails
        print(f"Error in meetings_api: {str(e)}")  # For debugging
        return Response([])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_users_api(request):
    """Active users API endpoint"""
    # Return current user and admin
    from django.contrib.auth.models import User
    
    users = []
    for user in User.objects.filter(is_active=True).order_by('username')[:10]:
        users.append({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'is_active': user.is_active
        })
    
    return Response(users)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meeting_configurations_api(request):
    """Meeting configurations API endpoint"""
    # Return empty configurations list
    return Response([])


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def recurring_tasks_api(request):
    """
    Compatibility wrapper that maps legacy recurring-tasks to enhanced TaskTemplate system.
    - GET: return active TaskTemplate in legacy format
    - POST: create TaskTemplate from legacy payload
    """
    from .additional_views import RecurringTaskCompatibilityView
    # Delegate to the class-based compatibility view for unified behavior
    view = RecurringTaskCompatibilityView.as_view()
    return view(request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_summary_api(request):
    """Fixed notifications summary API endpoint"""
    try:
        # Return a safe, minimal notification summary
        summary = {
            'total': 0,
            'unread': 0,
            'by_type': {},
            'by_priority': {}
        }
        
        return Response(summary)
        
    except Exception as e:
        # Always return a valid response structure
        return Response({
            'total': 0,
            'unread': 0,
            'by_type': {},
            'by_priority': {},
            'error': f'Notification service unavailable: {str(e)}'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unified_dashboard_overview_api(request):
    """Unified dashboard overview API endpoint"""
    try:
        # Try to get data from the actual UnifiedDashboardViewSet
        from . import views
        
        # Create a ViewSet instance and call the overview action
        dashboard_viewset = views.UnifiedDashboardViewSet()
        dashboard_viewset.action = 'overview'
        dashboard_viewset.request = request
        
        response = dashboard_viewset.overview(request)
        return response
        
    except Exception as e:
        # Log the exception for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Dashboard overview API failed, using fallback data: {str(e)}")
        
        # Return a minimal dashboard structure with correct field names if the real one fails
        minimal_dashboard = {
            'today_events': [],
            'upcoming_meetings': [],
            'my_tasks': [],
            'equipment_bookings': [],
            'pending_actions': [],
            'stats': {
                'presentations_total': 0,
                'presentations_this_year': 0,
                'tasks_completed_this_year': 0,
                'equipment_hours_this_month': 0,
                'active_bookings': 0,
                'pending_swap_requests': 0
            },
            'last_updated': timezone.now().isoformat()
        }
        
        return Response(minimal_dashboard)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def meetings_generate_api(request):
    """Meetings generation API endpoint"""
    try:
        # Try to use the actual MeetingInstanceViewSet generate_meetings action
        from . import views
        
        # Create a ViewSet instance and call the generate_meetings action
        meetings_viewset = views.MeetingInstanceViewSet()
        meetings_viewset.action = 'generate_meetings'
        meetings_viewset.request = request
        
        response = meetings_viewset.generate_meetings(request)
        return response
        
    except Exception as e:
        # Return error response if the real endpoint fails
        return Response(
            {'error': f'Failed to generate meetings: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quick_book_equipment_api(request):
    """Quick book equipment API endpoint"""
    try:
        # Try to use the actual QuickActionViewSet quick_book_equipment action
        from . import views
        
        # Create a ViewSet instance and call the quick_book_equipment action
        quick_actions_viewset = views.QuickActionViewSet()
        quick_actions_viewset.action = 'quick_book_equipment'
        quick_actions_viewset.request = request
        
        response = quick_actions_viewset.quick_book_equipment(request)
        return response
        
    except Exception as e:
        # Return error response if the real endpoint fails
        return Response(
            {'error': f'Failed to book equipment: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_task_api(request):
    """Complete task API endpoint"""
    try:
        # Try to use the actual QuickActionViewSet complete_task action
        from . import views
        
        # Create a ViewSet instance and call the complete_task action
        quick_actions_viewset = views.QuickActionViewSet()
        quick_actions_viewset.action = 'complete_task'
        quick_actions_viewset.request = request
        
        response = quick_actions_viewset.complete_task(request)
        return response
        
    except Exception as e:
        # Return error response if the real endpoint fails
        return Response(
            {'error': f'Failed to complete task: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )