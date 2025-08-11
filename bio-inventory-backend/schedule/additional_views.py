# Additional API views for intelligent meeting management and periodic task system
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from django.db.models import Q, Count, Sum, Avg
from django.db.models.functions import Extract
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import datetime, date, timedelta
from typing import List, Dict
import logging

from .models import (
    # Meeting Management Models
    MeetingInstance, Presenter, SwapRequest, MeetingConfiguration,
    QueueEntry, RotationSystem, Equipment, Booking, Event,
    # Periodic Task Management Models
    TaskTemplate, PeriodicTaskInstance, TaskRotationQueue, 
    QueueMember, TaskSwapRequest, NotificationRecord,
    # Legacy Models for compatibility
    RecurringTask, TaskInstance
)
from .serializers import (
    # Meeting Management Serializers
    MeetingInstanceSerializer, PresenterSerializer, SwapRequestSerializer,
    MeetingGenerationSerializer, JournalClubSubmissionSerializer, UserSerializer,
    # Periodic Task Management Serializers
    TaskTemplateSerializer, PeriodicTaskInstanceSerializer,
    TaskRotationQueueSerializer, QueueMemberSerializer,
    TaskSwapRequestSerializer, TaskGenerationPreviewSerializer,
    BatchTaskGenerationSerializer, TaskStatisticsSerializer,
    TaskCompletionSerializer,
    # Legacy Serializers for compatibility
    RecurringTaskSerializer, TaskInstanceSerializer
)

# Import services if they exist
try:
    from .services.task_assignment_service import (
        TaskGenerationService, TaskSwapService, TaskStatisticsService,
        TaskAssignmentError
    )
except ImportError:
    # Fallback if services not available
    TaskGenerationService = None
    TaskSwapService = None
    TaskStatisticsService = None
    TaskAssignmentError = Exception

logger = logging.getLogger(__name__)


class AdminDashboardView(APIView):
    """Admin dashboard with comprehensive system overview"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get admin dashboard data"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        today = timezone.now().date()
        
        # Meeting statistics
        total_meetings = MeetingInstance.objects.count()
        meetings_this_month = MeetingInstance.objects.filter(
            date__year=today.year,
            date__month=today.month
        ).count()
        
        upcoming_meetings = MeetingInstance.objects.filter(
            date__gte=today,
            status__in=['scheduled', 'confirmed']
        ).count()
        
        # Pending approvals
        pending_swaps = SwapRequest.objects.filter(status='pending').count()
        
        # Journal Club submissions status
        jc_presentations = Presenter.objects.filter(
            meeting_instance__meeting_type='journal_club',
            meeting_instance__date__gte=today,
            status='assigned'
        )
        
        missing_submissions = jc_presentations.filter(
            materials_submitted_at__isnull=True
        ).count()
        
        # Equipment usage statistics
        active_equipment = Equipment.objects.filter(is_in_use=True).count()
        total_equipment = Equipment.objects.filter(is_bookable=True).count()
        
        # Recent activity
        recent_swap_requests = SwapRequest.objects.filter(
            created_at__gte=today - timedelta(days=7)
        ).select_related('requester', 'original_presentation')[:5]
        
        dashboard_data = {
            'meeting_statistics': {
                'total_meetings': total_meetings,
                'meetings_this_month': meetings_this_month,
                'upcoming_meetings': upcoming_meetings
            },
            'pending_items': {
                'swap_requests': pending_swaps,
                'missing_jc_submissions': missing_submissions
            },
            'equipment_status': {
                'active_equipment': active_equipment,
                'total_equipment': total_equipment,
                'utilization_rate': (active_equipment / total_equipment * 100) if total_equipment > 0 else 0
            },
            'recent_activity': SwapRequestSerializer(recent_swap_requests, many=True).data
        }
        
        return Response(dashboard_data)


class PersonalDashboardView(APIView):
    """Personal dashboard for individual users"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get personalized dashboard data"""
        user = request.user
        today = timezone.now().date()
        
        # Next presentation
        next_presentation = Presenter.objects.filter(
            user=user,
            meeting_instance__date__gte=today,
            status__in=['assigned', 'confirmed']
        ).order_by('meeting_instance__date').first()
        
        # Upcoming meetings
        upcoming_meetings = MeetingInstance.objects.filter(
            date__gte=today,
            status__in=['scheduled', 'confirmed']
        ).order_by('date')[:5]
        
        # Swap requests involving user
        my_swap_requests = SwapRequest.objects.filter(
            Q(requester=user) | Q(target_presentation__user=user),
            status='pending'
        )
        
        # Journal Club deadlines
        jc_deadlines = []
        config = MeetingConfiguration.objects.first()
        if config:
            jc_presentations = Presenter.objects.filter(
                user=user,
                meeting_instance__meeting_type='journal_club',
                meeting_instance__date__gte=today,
                status='assigned',
                materials_submitted_at__isnull=True
            )
            
            for presentation in jc_presentations:
                deadline = presentation.meeting_instance.date - timedelta(
                    days=config.jc_submission_deadline_days
                )
                final_deadline = presentation.meeting_instance.date - timedelta(
                    days=config.jc_final_deadline_days
                )
                
                if deadline >= today:
                    jc_deadlines.append({
                        'presentation_id': presentation.id,
                        'meeting_date': presentation.meeting_instance.date,
                        'deadline': deadline,
                        'final_deadline': final_deadline,
                        'days_remaining': (deadline - today).days,
                        'urgency': 'urgent' if (deadline - today).days <= 3 else 'normal'
                    })
        
        # Equipment bookings today
        today_bookings = Booking.objects.filter(
            user=user,
            event__start_time__date=today,
            status__in=['confirmed', 'in_progress']
        ).select_related('equipment', 'event')
        
        dashboard_data = {
            'next_presentation': PresenterSerializer(next_presentation).data if next_presentation else None,
            'upcoming_meetings': MeetingInstanceSerializer(upcoming_meetings, many=True).data,
            'swap_requests': SwapRequestSerializer(my_swap_requests, many=True).data,
            'jc_deadlines': jc_deadlines,
            'today_equipment_bookings': [
                {
                    'id': booking.id,
                    'equipment_name': booking.equipment.name,
                    'start_time': booking.event.start_time,
                    'end_time': booking.event.end_time,
                    'status': booking.status
                }
                for booking in today_bookings
            ],
            'statistics': {
                'presentations_this_year': Presenter.objects.filter(
                    user=user,
                    meeting_instance__date__year=today.year
                ).count(),
                'active_swap_requests': my_swap_requests.count()
            }
        }
        
        return Response(dashboard_data)


class QuebecHolidaysView(APIView):
    """Quebec holidays information"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, year):
        """Get Quebec holidays for a specific year"""
        from .services import QuebecHolidayService
        
        try:
            service = QuebecHolidayService()
            holidays = service.get_holidays_for_year(year)
            
            return Response({
                'year': year,
                'holidays': holidays,
                'count': len(holidays)
            })
        except Exception as e:
            return Response({
                'error': f'Failed to get holidays: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class IsHolidayView(APIView):
    """Check if a specific date is a holiday"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, date):
        """Check if date is a Quebec holiday"""
        try:
            check_date = parse_date(date)
            if not check_date:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .services import QuebecHolidayService
            
            service = QuebecHolidayService()
            is_holiday = service.is_holiday(check_date)
            holiday_name = service.get_holiday_name(check_date) if is_holiday else None
            
            return Response({
                'date': check_date,
                'is_holiday': is_holiday,
                'holiday_name': holiday_name
            })
        except Exception as e:
            return Response({
                'error': f'Failed to check holiday: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NextAvailableDateView(APIView):
    """Get next available meeting date"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, preferred_date):
        """Get next available date for meetings"""
        try:
            preferred = parse_date(preferred_date)
            if not preferred:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .services import QuebecHolidayService
            
            service = QuebecHolidayService()
            next_date = service.get_next_meeting_date(preferred)
            
            return Response({
                'preferred_date': preferred,
                'next_available_date': next_date,
                'days_difference': (next_date - preferred).days
            })
        except Exception as e:
            return Response({
                'error': f'Failed to find next available date: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateMeetingsView(APIView):
    """Generate meetings for a date range"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Generate meetings based on configuration"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = MeetingGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from .services.meeting_generation import MeetingGenerationService
            
            data = serializer.validated_data
            service = MeetingGenerationService()
            generated_meetings = service.generate_meetings(
                data['start_date'],
                data['end_date'],
                data.get('meeting_types', ['research_update', 'journal_club']),
                data.get('auto_assign_presenters', True)
            )
            
            return Response({
                'message': f'Generated {len(generated_meetings)} meetings',
                'meetings': MeetingInstanceSerializer(generated_meetings, many=True).data,
                'start_date': data['start_date'],
                'end_date': data['end_date']
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to generate meetings: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UploadPaperView(APIView):
    """Upload paper for Journal Club"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, meeting_id):
        """Upload paper file for Journal Club"""
        try:
            meeting = MeetingInstance.objects.get(id=meeting_id)
        except MeetingInstance.DoesNotExist:
            return Response(
                {'error': 'Meeting not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Find presenter for this user and meeting
        try:
            presenter = Presenter.objects.get(
                meeting_instance=meeting,
                user=request.user
            )
        except Presenter.DoesNotExist:
            return Response(
                {'error': 'You are not a presenter for this meeting'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if meeting.meeting_type != 'journal_club':
            return Response(
                {'error': 'Paper upload is only for Journal Club meetings'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process file upload
        paper_file = request.FILES.get('paper_file')
        paper_title = request.data.get('paper_title', '')
        
        if not paper_file:
            return Response(
                {'error': 'Paper file is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        presenter.paper_file = paper_file
        presenter.paper_title = paper_title
        presenter.materials_submitted_at = timezone.now()
        presenter.status = 'confirmed'
        presenter.save()
        
        return Response({
            'message': 'Paper uploaded successfully',
            'presenter': PresenterSerializer(presenter).data
        })


class SubmitPaperUrlView(APIView):
    """Submit paper URL for Journal Club"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, meeting_id):
        """Submit paper URL for Journal Club"""
        try:
            meeting = MeetingInstance.objects.get(id=meeting_id)
        except MeetingInstance.DoesNotExist:
            return Response(
                {'error': 'Meeting not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Find presenter for this user and meeting
        try:
            presenter = Presenter.objects.get(
                meeting_instance=meeting,
                user=request.user
            )
        except Presenter.DoesNotExist:
            return Response(
                {'error': 'You are not a presenter for this meeting'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if meeting.meeting_type != 'journal_club':
            return Response(
                {'error': 'Paper submission is only for Journal Club meetings'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = JournalClubSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        presenter.paper_url = data.get('paper_url')
        presenter.paper_title = data.get('paper_title', presenter.paper_title)
        presenter.materials_submitted_at = timezone.now()
        presenter.status = 'confirmed'
        presenter.save()
        
        return Response({
            'message': 'Paper URL submitted successfully',
            'presenter': PresenterSerializer(presenter).data
        })


class PaperSubmissionView(APIView):
    """Get paper submission status"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, meeting_id):
        """Get paper submission status for a meeting"""
        try:
            meeting = MeetingInstance.objects.get(id=meeting_id)
        except MeetingInstance.DoesNotExist:
            return Response(
                {'error': 'Meeting not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if meeting.meeting_type != 'journal_club':
            return Response(
                {'error': 'This endpoint is only for Journal Club meetings'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        presenters = meeting.presenters.all()
        submission_status = []
        
        for presenter in presenters:
            has_submitted = (presenter.paper_file or presenter.paper_url) and presenter.materials_submitted_at
            
            config = MeetingConfiguration.objects.first()
            deadline = None
            final_deadline = None
            
            if config:
                deadline = meeting.date - timedelta(days=config.jc_submission_deadline_days)
                final_deadline = meeting.date - timedelta(days=config.jc_final_deadline_days)
            
            submission_status.append({
                'presenter': {
                    'id': presenter.user.id,
                    'username': presenter.user.username,
                    'full_name': presenter.user.get_full_name()
                },
                'has_submitted': has_submitted,
                'submitted_at': presenter.materials_submitted_at,
                'paper_title': presenter.paper_title,
                'has_file': bool(presenter.paper_file),
                'has_url': bool(presenter.paper_url),
                'deadline': deadline,
                'final_deadline': final_deadline,
                'is_overdue': deadline and timezone.now().date() > deadline if deadline else False
            })
        
        return Response({
            'meeting': MeetingInstanceSerializer(meeting).data,
            'submission_status': submission_status
        })


class DistributePaperView(APIView):
    """Distribute paper to all members"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, meeting_id):
        """Distribute paper to all active members"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            meeting = MeetingInstance.objects.get(id=meeting_id)
        except MeetingInstance.DoesNotExist:
            return Response(
                {'error': 'Meeting not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if meeting.meeting_type != 'journal_club':
            return Response(
                {'error': 'Paper distribution is only for Journal Club meetings'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find presenters with submitted papers
        presenters_with_papers = meeting.presenters.filter(
            Q(paper_file__isnull=False) | Q(paper_url__isnull=False),
            materials_submitted_at__isnull=False
        )
        
        if not presenters_with_papers.exists():
            return Response(
                {'error': 'No papers have been submitted for this meeting'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from notifications.email_service import EmailNotificationService
            from .models import MeetingConfiguration
            
            config = MeetingConfiguration.objects.first()
            if not config:
                return Response(
                    {'error': 'Meeting configuration not found'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get all active members
            recipients = list(config.active_members.all())
            
            # Send paper distribution email
            context = {
                'meeting': meeting,
                'presenters': presenters_with_papers,
                'papers': [
                    {
                        'presenter': p.user.get_full_name() or p.user.username,
                        'title': p.paper_title,
                        'file': p.paper_file,
                        'url': p.paper_url
                    }
                    for p in presenters_with_papers
                ]
            }
            
            success = EmailNotificationService.send_email_notification(
                recipients=recipients,
                subject=f'Journal Club Papers - {meeting.date}',
                template_name='jc_materials_distributed',
                context=context
            )
            
            if success:
                return Response({
                    'message': f'Papers distributed to {len(recipients)} members',
                    'recipients_count': len(recipients),
                    'papers_count': presenters_with_papers.count()
                })
            else:
                return Response(
                    {'error': 'Failed to send distribution emails'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        except Exception as e:
            return Response(
                {'error': f'Failed to distribute papers: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaperArchiveView(APIView):
    """Paper archive for historical papers"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get archived papers"""
        # Filter parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        presenter_id = request.query_params.get('presenter_id')
        search_query = request.query_params.get('search', '')
        
        # Base queryset - Journal Club presentations with submitted materials
        queryset = Presenter.objects.filter(
            meeting_instance__meeting_type='journal_club',
            materials_submitted_at__isnull=False
        ).select_related(
            'user', 'meeting_instance'
        ).exclude(
            Q(paper_file__isnull=True) & Q(paper_url__isnull=True)
        )
        
        # Apply filters
        if start_date:
            try:
                start_date = parse_date(start_date)
                queryset = queryset.filter(meeting_instance__date__gte=start_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_date = parse_date(end_date)
                queryset = queryset.filter(meeting_instance__date__lte=end_date)
            except ValueError:
                pass
        
        if presenter_id:
            queryset = queryset.filter(user_id=presenter_id)
        
        if search_query:
            queryset = queryset.filter(
                Q(paper_title__icontains=search_query) |
                Q(user__username__icontains=search_query) |
                Q(user__first_name__icontains=search_query) |
                Q(user__last_name__icontains=search_query)
            )
        
        # Order by most recent first
        queryset = queryset.order_by('-meeting_instance__date')
        
        # Paginate results
        from django.core.paginator import Paginator
        paginator = Paginator(queryset, 20)  # 20 papers per page
        page_number = request.query_params.get('page', 1)
        page = paginator.get_page(page_number)
        
        papers_data = []
        for presenter in page.object_list:
            papers_data.append({
                'id': presenter.id,
                'meeting_date': presenter.meeting_instance.date,
                'presenter': {
                    'id': presenter.user.id,
                    'username': presenter.user.username,
                    'full_name': presenter.user.get_full_name()
                },
                'paper_title': presenter.paper_title,
                'has_file': bool(presenter.paper_file),
                'has_url': bool(presenter.paper_url),
                'paper_url': presenter.paper_url,
                'submitted_at': presenter.materials_submitted_at,
                'file_download_url': f'/api/schedule/files/download/{presenter.paper_file.name}/' if presenter.paper_file else None
            })
        
        return Response({
            'papers': papers_data,
            'pagination': {
                'total_count': paginator.count,
                'total_pages': paginator.num_pages,
                'current_page': page.number,
                'has_next': page.has_next(),
                'has_previous': page.has_previous()
            }
        })


class SendNotificationView(APIView):
    """Send custom notifications"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Send notification to users"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        recipients_ids = request.data.get('recipients', [])
        subject = request.data.get('subject', '')
        message = request.data.get('message', '')
        template_name = request.data.get('template_name', 'admin_announcement')
        
        if not recipients_ids:
            return Response(
                {'error': 'Recipients are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not subject or not message:
            return Response(
                {'error': 'Subject and message are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth.models import User
            from notifications.email_service import EmailNotificationService
            
            recipients = User.objects.filter(id__in=recipients_ids)
            
            context = {
                'subject': subject,
                'message': message,
                'sender': request.user.get_full_name() or request.user.username
            }
            
            success = EmailNotificationService.send_email_notification(
                recipients=list(recipients),
                subject=subject,
                template_name=template_name,
                context=context
            )
            
            if success:
                return Response({
                    'message': f'Notification sent to {recipients.count()} recipients'
                })
            else:
                return Response(
                    {'error': 'Failed to send notifications'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        except Exception as e:
            return Response(
                {'error': f'Failed to send notifications: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OneTimeTasksView(APIView):
    """一次性任务：创建/列表"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """列出开放的一次性任务（未被领取或进行中）"""
        from .models import PeriodicTaskInstance, TaskTemplate
        tasks = PeriodicTaskInstance.objects.filter(
            template__task_type='one_time'
        ).exclude(status='completed').order_by('-created_at')[:100]
        return Response(PeriodicTaskInstanceSerializer(tasks, many=True, context={'request': request}).data)

    def post(self, request):
        """创建一次性任务（全员可领取）。
        body: { name, description, deadline (YYYY-MM-DD), remind_reoffer (bool, 可选) }
        """
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from .models import TaskTemplate, PeriodicTaskInstance
        name = request.data.get('name')
        description = request.data.get('description', '')
        deadline = request.data.get('deadline')  # YYYY-MM-DD
        remind_reoffer = bool(request.data.get('remind_reoffer', False))

        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils.dateparse import parse_date
        end_date = parse_date(deadline) if deadline else timezone.now().date()
        start_date = timezone.now().date()

        # 创建 one-time 模板（或复用同名非激活模板）
        template, _ = TaskTemplate.objects.get_or_create(
            name=name,
            defaults={
                'description': description,
                'task_type': 'one_time',
                'category': 'custom',
                'start_date': start_date,
                'end_date': end_date,
                'min_people': 1,
                'max_people': 1,
                'default_people': 1,
                'window_type': 'fixed',
                'fixed_start_day': start_date.day,
                'fixed_end_day': end_date.day,
                'priority': 'medium',
                'is_active': True,
                'created_by': request.user,
            }
        )

        # 创建任务实例，未分配，状态 scheduled
        task = PeriodicTaskInstance.objects.create(
            template=template,
            template_name=template.name,
            scheduled_period=f"{start_date.strftime('%Y-%m')}",
            execution_start_date=start_date,
            execution_end_date=end_date,
            status='scheduled',
            original_assignees=[],
            current_assignees=[],
            assignment_metadata={'one_time': True, 'remind_reoffer': remind_reoffer, 'created_by': request.user.id}
        )

        # 群发邮件到全员
        try:
            from django.contrib.auth.models import User
            recipients = list(User.objects.filter(is_active=True))
            from notifications.email_service import EmailNotificationService
            
            success = EmailNotificationService.send_email_notification(
                recipients=recipients,
                subject=f"One-time Task: {template.name}",
                template_name='one_time_task_created',
                context={
                    'task': {'name': template.name, 'description': template.description, 'deadline': str(end_date)},
                    'claim_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/one-time-tasks/{task.id}/claim"
                }
            )
            
            if not success:
                logger.warning(f"Failed to send one-time task creation emails for task {task.id}")
            else:
                logger.info(f"Successfully sent one-time task creation emails for task {task.id} to {len(recipients)} recipients")
                
        except Exception as e:
            logger.error(f"Error sending one-time task creation emails for task {task.id}: {e}")

        return Response(PeriodicTaskInstanceSerializer(task, context={'request': request}).data, status=status.HTTP_201_CREATED)


class OneTimeTaskActionView(APIView):
    """一次性任务领取/完成"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, task_id, action):
        from django.db import transaction
        from .models import PeriodicTaskInstance
        try:
            task = PeriodicTaskInstance.objects.select_for_update().get(id=task_id)
        except PeriodicTaskInstance.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            task = PeriodicTaskInstance.objects.select_for_update().get(id=task_id)
            if action == 'claim':
                if task.current_assignees:
                    return Response({'error': 'Task already claimed'}, status=status.HTTP_409_CONFLICT)
                task.current_assignees = [request.user.id]
                task.original_assignees = [request.user.id]
                task.status = 'in_progress'
                meta = task.assignment_metadata or {}
                meta['claimed_at'] = timezone.now().isoformat()
                meta['claimed_by'] = request.user.id
                task.assignment_metadata = meta
                task.save()

                # 通知创建者（模板创建人）
                try:
                    creator = task.template.created_by
                    if creator and creator.email:  # Only send if creator has email
                        from notifications.email_service import EmailNotificationService
                        success = EmailNotificationService.send_email_notification(
                            recipients=[creator],
                            subject=f"Task Claimed: {task.template_name}",
                            template_name='one_time_task_claimed',
                            context={
                                'task': {'name': task.template_name},
                                'creator_name': creator.get_full_name() or creator.username,
                                'claimer_name': request.user.get_full_name() or request.user.username,
                                'view_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/one-time-tasks"
                            }
                        )
                        
                        if not success:
                            logger.warning(f"Failed to send task claimed email to creator {creator.username} for task {task.id}")
                        else:
                            logger.info(f"Successfully sent task claimed email to creator {creator.username} for task {task.id}")
                    else:
                        logger.info(f"No creator or email found for task {task.id}, skipping claimed notification")
                        
                except Exception as e:
                    logger.error(f"Error sending task claimed email for task {task.id}: {e}")

                # 同步通知管理员（所有 is_staff 用户）
                try:
                    from django.contrib.auth.models import User
                    from notifications.email_service import EmailNotificationService
                    admin_users = list(User.objects.filter(is_staff=True, is_active=True))
                    if admin_users:
                        admin_success = EmailNotificationService.send_email_notification(
                            recipients=admin_users,
                            subject=f"One-time Task Claimed: {task.template_name}",
                            template_name='one_time_task_claimed',
                            context={
                                'task': {'name': task.template_name},
                                'creator_name': 'Admin Team',
                                'claimer_name': request.user.get_full_name() or request.user.username,
                                'view_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/one-time-tasks"
                            }
                        )
                        if not admin_success:
                            logger.warning(f"Failed to send admin claimed notifications for task {task.id}")
                        else:
                            logger.info(f"Sent admin claimed notifications for task {task.id} to {len(admin_users)} admins")
                except Exception as e:
                    logger.warning(f"Error notifying admins for claimed task {task.id}: {e}")

                return Response(PeriodicTaskInstanceSerializer(task, context={'request': request}).data)

            elif action == 'complete':
                if request.user.id not in task.current_assignees:
                    return Response({'error': 'You are not the assignee'}, status=status.HTTP_403_FORBIDDEN)
                if task.status not in ['scheduled', 'pending', 'in_progress']:
                    return Response({'error': 'Task not in completable state'}, status=status.HTTP_400_BAD_REQUEST)

                # 仅备注/照片为可选，评分不需要
                serializer = TaskCompletionSerializer(data=request.data)
                if not serializer.is_valid():
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                data = serializer.validated_data
                # 强制移除评分
                data.pop('completion_rating', None)

                task.mark_completed(request.user, **data)
                return Response(PeriodicTaskInstanceSerializer(task, context={'request': request}).data)

            else:
                return Response({'error': 'Unsupported action'}, status=status.HTTP_400_BAD_REQUEST)


class NotificationHistoryView(APIView):
    """Notification history"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get notification history"""
        # This would integrate with the notifications app
        # For now, return placeholder
        return Response({
            'notifications': [],
            'message': 'Notification history integration pending'
        })


class FileUploadView(APIView):
    """General file upload endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Upload file and return file key"""
        uploaded_file = request.FILES.get('file')
        file_type = request.data.get('file_type', 'general')
        
        if not uploaded_file:
            return Response(
                {'error': 'File is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate unique file key
        import uuid
        import os
        file_extension = os.path.splitext(uploaded_file.name)[1]
        file_key = f"{file_type}/{uuid.uuid4().hex}{file_extension}"
        
        # Save file (this would integrate with your file storage system)
        # For now, return the file key
        return Response({
            'file_key': file_key,
            'original_name': uploaded_file.name,
            'size': uploaded_file.size,
            'content_type': uploaded_file.content_type
        })


class FileDownloadView(APIView):
    """File download endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, file_key):
        """Download file by key"""
        # This would integrate with your file storage system
        return Response({
            'error': 'File download not yet implemented'
        }, status=status.HTTP_501_NOT_IMPLEMENTED)


class FileDeleteView(APIView):
    """File deletion endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request, file_key):
        """Delete file by key"""
        # This would integrate with your file storage system
        return Response({
            'message': 'File deletion not yet implemented'
        }, status=status.HTTP_501_NOT_IMPLEMENTED)


class UsersView(APIView):
    """Users list endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get list of users"""
        from django.contrib.auth.models import User
        from .serializers import UserSerializer
        
        users = User.objects.filter(is_active=True).order_by('username')
        search_query = request.query_params.get('search', '')
        
        if search_query:
            users = users.filter(
                Q(username__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(email__icontains=search_query)
            )
        
        serializer = UserSerializer(users, many=True)
        return Response({'users': serializer.data})


class UserDetailView(APIView):
    """User detail endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, user_id):
        """Get user details"""
        try:
            from django.contrib.auth.models import User
            from .serializers import UserSerializer
            
            user = User.objects.get(id=user_id)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


# ============================================================================
# ENHANCED PERIODIC TASK MANAGEMENT VIEWS
# ============================================================================

class EnhancedTaskTemplateView(APIView):
    """Enhanced TaskTemplate management with batch operations"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get all task templates with filtering"""
        queryset = TaskTemplate.objects.all()
        
        # Apply filters
        category = request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        is_active = request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        serializer = TaskTemplateSerializer(queryset.order_by('name'), many=True)
        return Response(serializer.data)
    
    def post(self, request):
        """Create new task template (admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin permission required'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = TaskTemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskGenerationPreviewView(APIView):
    """Preview task generation without creating tasks"""
    permission_classes = [permissions.IsAdminUser]
    
    def post(self, request):
        """Preview task generation for multiple periods"""
        serializer = TaskGenerationPreviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        period_list = data['periods']
        template_ids = data.get('template_ids')
        
        try:
            if TaskGenerationService:
                preview_data = TaskGenerationService.preview_task_generation(
                    period_list, template_ids
                )
            else:
                # Fallback implementation
                preview_data = self._fallback_preview_generation(period_list, template_ids)
            
            return Response({
                'preview_data': preview_data,
                'summary': {
                    'periods_count': len(period_list),
                    'tasks_to_generate': len(preview_data),
                    'templates_involved': len(set(item['template_id'] for item in preview_data)),
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Task generation preview failed: {str(e)}")
            return Response(
                {'error': f'Preview generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _fallback_preview_generation(self, period_list, template_ids=None):
        """Fallback preview implementation when service not available"""
        if template_ids:
            templates = TaskTemplate.objects.filter(id__in=template_ids, is_active=True)
        else:
            templates = TaskTemplate.objects.filter(is_active=True)
        
        preview_data = []
        for period_str in period_list:
            for template in templates:
                if template.should_generate_for_period(period_str):
                    start_date, end_date = template.get_execution_window(period_str)
                    preview_data.append({
                        'template_id': template.id,
                        'template_name': template.name,
                        'period': period_str,
                        'execution_start_date': start_date,
                        'execution_end_date': end_date,
                        'assignees': ['Auto-assignment not available'],
                        'estimated_hours': template.estimated_hours,
                        'priority': template.priority,
                    })
        
        return preview_data


class BatchTaskGenerationView(APIView):
    """Generate tasks for multiple periods at once"""
    permission_classes = [permissions.IsAdminUser]
    
    def post(self, request):
        """Generate tasks for multiple periods"""
        serializer = BatchTaskGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        period_list = data['periods']
        template_ids = data.get('template_ids')
        
        try:
            if TaskGenerationService:
                results = TaskGenerationService.batch_generate_tasks(period_list, template_ids)
            else:
                # Fallback implementation
                results = self._fallback_batch_generation(period_list, template_ids)
            
            total_generated = sum(len(tasks) for tasks in results.values())
            successful_periods = sum(1 for tasks in results.values() if tasks)
            
            return Response({
                'summary': {
                    'total_tasks_generated': total_generated,
                    'successful_periods': successful_periods,
                    'failed_periods': len(period_list) - successful_periods,
                    'periods_processed': len(period_list)
                },
                'results_by_period': {
                    period: len(tasks) for period, tasks in results.items()
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Batch task generation failed: {str(e)}")
            return Response(
                {'error': f'Batch generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _fallback_batch_generation(self, period_list, template_ids=None):
        """Fallback generation when service not available"""
        results = {}
        for period_str in period_list:
            results[period_str] = []
            # Simple fallback - would need actual implementation
        return results


class MyTasksView(APIView):
    """Get tasks assigned to the current user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get tasks assigned to current user, categorized by status"""
        user = request.user
        
        # Get all tasks assigned to user
        user_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user.id]
        ).select_related('template', 'completed_by')
        
        # Categorize tasks
        today = date.today()
        
        current_tasks = user_tasks.filter(
            status__in=['scheduled', 'pending', 'in_progress'],
            execution_end_date__gte=today
        ).order_by('execution_end_date')[:10]
        
        upcoming_tasks = user_tasks.filter(
            status='scheduled',
            execution_start_date__gt=today
        ).order_by('execution_start_date')[:5]
        
        completed_tasks = user_tasks.filter(
            status='completed'
        ).order_by('-completed_at')[:10]
        
        overdue_tasks = user_tasks.filter(
            status__in=['scheduled', 'pending', 'in_progress'],
            execution_end_date__lt=today
        ).order_by('execution_end_date')
        
        # Get basic statistics
        total_tasks = user_tasks.count()
        completed_count = user_tasks.filter(status='completed').count()
        completion_rate = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
        
        return Response({
            'current_tasks': PeriodicTaskInstanceSerializer(
                current_tasks, many=True, context={'request': request}
            ).data,
            'upcoming_tasks': PeriodicTaskInstanceSerializer(
                upcoming_tasks, many=True, context={'request': request}
            ).data,
            'completed_tasks': PeriodicTaskInstanceSerializer(
                completed_tasks, many=True, context={'request': request}
            ).data,
            'overdue_tasks': PeriodicTaskInstanceSerializer(
                overdue_tasks, many=True, context={'request': request}
            ).data,
            'statistics': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_count,
                'completion_rate': round(completion_rate, 1),
                'current_tasks': current_tasks.count(),
                'overdue_tasks': overdue_tasks.count(),
            }
        }, status=status.HTTP_200_OK)


class TaskCompletionView(APIView):
    """Mark tasks as completed"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, task_id):
        """Mark a specific task as completed"""
        try:
            task = PeriodicTaskInstance.objects.get(id=task_id)
        except PeriodicTaskInstance.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Check if user can complete this task
        if user.id not in task.current_assignees:
            return Response(
                {'error': 'You are not assigned to this task'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if task is in valid state for completion
        if task.status not in ['scheduled', 'pending', 'in_progress']:
            return Response(
                {'error': f'Task cannot be completed in {task.status} status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate completion data
        serializer = TaskCompletionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        completion_data = serializer.validated_data
        
        try:
            # Mark task as completed
            if hasattr(task, 'mark_completed'):
                task.mark_completed(user, **completion_data)
            else:
                # Fallback completion
                task.status = 'completed'
                task.completed_by = user
                task.completed_at = timezone.now()
                for field in ['completion_duration', 'completion_notes', 'completion_photos']:
                    if field in completion_data:
                        setattr(task, field, completion_data[field])
                task.save()
            
            # Send completion notifications
            try:
                from .services.notification_service import TaskNotificationService
                TaskNotificationService.notify_task_completion(
                    task_instance=task,
                    completed_by=user,
                    completion_notes=completion_data.get('completion_notes')
                )
            except Exception as e:
                logger.warning(f"Failed to send completion notifications: {str(e)}")
            
            return Response(
                PeriodicTaskInstanceSerializer(task, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"Task completion failed: {str(e)}")
            return Response(
                {'error': f'Failed to mark task as completed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TaskSwapRequestView(APIView):
    """Manage task swap requests"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get swap requests involving the user"""
        user = request.user
        
        # Get requests based on involvement filter
        involvement_filter = request.query_params.get('involvement', 'all')
        
        if involvement_filter == 'my_requests':
            queryset = TaskSwapRequest.objects.filter(from_user=user)
        elif involvement_filter == 'requests_to_me':
            queryset = TaskSwapRequest.objects.filter(to_user=user)
        elif involvement_filter == 'public_pool':
            queryset = TaskSwapRequest.objects.filter(
                is_public_pool=True, 
                status='pending'
            ).exclude(from_user=user)  # Exclude own requests
        else:
            # All requests involving user
            queryset = TaskSwapRequest.objects.filter(
                Q(from_user=user) | Q(to_user=user)
            )
        
        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        queryset = queryset.select_related(
            'task_instance__template', 'from_user', 'to_user'
        ).order_by('-created_at')
        
        return Response(
            TaskSwapRequestSerializer(
                queryset, many=True, context={'request': request}
            ).data
        )
    
    def post(self, request):
        """Create a new swap request"""
        serializer = TaskSwapRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate user is assigned to the task
        task_instance = serializer.validated_data['task_instance']
        if request.user.id not in task_instance.current_assignees:
            return Response(
                {'error': 'You are not assigned to this task'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            if TaskSwapService:
                swap_request = TaskSwapService.create_swap_request(
                    task_instance=task_instance,
                    from_user=request.user,
                    to_user=serializer.validated_data.get('to_user'),
                    request_type=serializer.validated_data.get('request_type', 'swap'),
                    reason=serializer.validated_data.get('reason', ''),
                    is_public_pool=serializer.validated_data.get('is_public_pool', False)
                )
            else:
                # Fallback creation
                swap_request = serializer.save(from_user=request.user)
            
            return Response(
                TaskSwapRequestSerializer(swap_request, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"Swap request creation failed: {str(e)}")
            return Response(
                {'error': f'Failed to create swap request: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SwapRequestActionView(APIView):
    """Handle swap request actions (approve, reject, claim)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, request_id, action):
        """Perform action on swap request"""
        try:
            swap_request = TaskSwapRequest.objects.get(id=request_id)
        except TaskSwapRequest.DoesNotExist:
            return Response(
                {'error': 'Swap request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        if action == 'approve':
            return self._handle_approve(swap_request, user, request.data)
        elif action == 'reject':
            return self._handle_reject(swap_request, user, request.data)
        elif action == 'claim':
            return self._handle_claim(swap_request, user)
        else:
            return Response(
                {'error': 'Invalid action'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _handle_approve(self, swap_request, user, data):
        """Handle approve action"""
        is_admin = user.is_staff or user.is_superuser
        is_target_user = (swap_request.to_user == user)
        
        if not (is_admin or is_target_user):
            return Response(
                {'error': 'You are not authorized to approve this request'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            if TaskSwapService:
                was_executed = TaskSwapService.approve_swap_request(
                    swap_request, user, is_admin
                )
            else:
                # Fallback approval
                if is_admin:
                    swap_request.admin_approved = True
                    swap_request.admin_approved_by = user
                    swap_request.admin_approved_at = timezone.now()
                else:
                    swap_request.target_user_approved = True
                    swap_request.target_user_approved_at = timezone.now()
                swap_request.save()
                was_executed = False
            
            return Response({
                'message': 'Swap request approved' + (' and executed' if was_executed else ''),
                'executed': was_executed,
                'swap_request': TaskSwapRequestSerializer(swap_request).data
            })
            
        except Exception as e:
            logger.error(f"Swap approval failed: {str(e)}")
            return Response(
                {'error': f'Failed to approve swap request: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _handle_reject(self, swap_request, user, data):
        """Handle reject action"""
        is_admin = user.is_staff or user.is_superuser
        is_target_user = (swap_request.to_user == user)
        
        if not (is_admin or is_target_user):
            return Response(
                {'error': 'You are not authorized to reject this request'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        reason = data.get('reason', '')
        swap_request.status = 'rejected'
        if reason:
            swap_request.reason += f"\n\nRejection reason: {reason}"
        swap_request.save()
        
        return Response({
            'message': 'Swap request rejected',
            'swap_request': TaskSwapRequestSerializer(swap_request).data
        })
    
    def _handle_claim(self, swap_request, user):
        """Handle claim action for public pool requests"""
        if not swap_request.is_public_pool:
            return Response(
                {'error': 'This request is not in the public pool'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if swap_request.status != 'pending':
            return Response(
                {'error': 'This request is no longer available'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if TaskSwapService:
                updated_request = TaskSwapService.claim_from_pool(swap_request, user)
            else:
                # Fallback claim
                swap_request.to_user = user
                swap_request.is_public_pool = False
                swap_request.save()
                updated_request = swap_request
            
            return Response({
                'message': 'Successfully claimed swap request',
                'swap_request': TaskSwapRequestSerializer(updated_request).data
            })
            
        except Exception as e:
            logger.error(f"Pool claim failed: {str(e)}")
            return Response(
                {'error': f'Failed to claim from pool: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TaskStatisticsView(APIView):
    """Get task-related statistics"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get comprehensive task statistics"""
        user_id = request.query_params.get('user_id')
        
        if user_id:
            # Get statistics for specific user
            try:
                target_user = User.objects.get(id=user_id)
                if TaskStatisticsService:
                    stats = TaskStatisticsService.get_user_statistics(target_user)
                else:
                    stats = self._get_basic_user_stats(target_user)
                
                return Response({
                    'user_statistics': stats,
                    'user': {
                        'id': target_user.id,
                        'username': target_user.username,
                        'full_name': target_user.get_full_name() or target_user.username
                    }
                })
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Get system-wide statistics (admin only)
            if not request.user.is_staff:
                return Response(
                    {'error': 'Admin permission required for system statistics'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if TaskStatisticsService:
                stats = TaskStatisticsService.get_system_statistics()
            else:
                stats = self._get_basic_system_stats()
            
            return Response({'system_statistics': stats})
    
    def _get_basic_user_stats(self, user):
        """Basic user statistics fallback"""
        user_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user.id]
        )
        
        total_tasks = user_tasks.count()
        completed_count = user_tasks.filter(status='completed').count()
        completion_rate = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
        
        return {
            'total_tasks': total_tasks,
            'completed_tasks': completed_count,
            'completion_rate': round(completion_rate, 1),
            'current_tasks': user_tasks.filter(
                status__in=['scheduled', 'pending', 'in_progress']
            ).count(),
            'overdue_tasks': user_tasks.filter(
                status__in=['scheduled', 'pending', 'in_progress'],
                execution_end_date__lt=date.today()
            ).count(),
        }
    
    def _get_basic_system_stats(self):
        """Basic system statistics fallback"""
        all_tasks = PeriodicTaskInstance.objects.all()
        
        return {
            'total_tasks': all_tasks.count(),
            'completed_tasks': all_tasks.filter(status='completed').count(),
            'active_templates': TaskTemplate.objects.filter(is_active=True).count(),
            'total_swaps': TaskSwapRequest.objects.count(),
        }


class AdminTaskDashboardView(APIView):
    """Admin dashboard for task management"""
    permission_classes = [permissions.IsAdminUser]
    
    def get(self, request):
        """Get comprehensive admin dashboard for periodic tasks"""
        
        # Basic task statistics
        total_tasks = PeriodicTaskInstance.objects.count()
        completed_tasks = PeriodicTaskInstance.objects.filter(status='completed').count()
        overdue_tasks = PeriodicTaskInstance.objects.filter(
            status__in=['scheduled', 'pending', 'in_progress'],
            execution_end_date__lt=date.today()
        ).count()
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Recent activities
        recent_completions = PeriodicTaskInstance.objects.filter(
            status='completed',
            completed_at__gte=timezone.now() - timedelta(days=7)
        ).select_related('template', 'completed_by').order_by('-completed_at')[:5]
        
        recent_assignments = PeriodicTaskInstance.objects.filter(
            status='scheduled',
            created_at__gte=timezone.now() - timedelta(days=7)
        ).select_related('template').order_by('-created_at')[:5]
        
        # Pending swap requests
        pending_swaps = TaskSwapRequest.objects.filter(
            status='pending'
        ).select_related('task_instance__template', 'from_user', 'to_user')[:5]
        
        # Template statistics
        active_templates = TaskTemplate.objects.filter(is_active=True).count()
        
        return Response({
            'task_statistics': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'overdue_tasks': overdue_tasks,
                'completion_rate': round(completion_rate, 1),
                'active_templates': active_templates
            },
            'recent_activities': {
                'recent_completions': PeriodicTaskInstanceSerializer(
                    recent_completions, many=True, context={'request': request}
                ).data,
                'recent_assignments': PeriodicTaskInstanceSerializer(
                    recent_assignments, many=True, context={'request': request}
                ).data,
                'pending_swaps': TaskSwapRequestSerializer(
                    pending_swaps, many=True, context={'request': request}
                ).data
            },
            'alerts': {
                'overdue_count': overdue_tasks,
                'pending_swaps_count': pending_swaps.count(),
            }
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_meetings_api(request):
    """Group meetings API endpoint that returns MeetingInstance data"""
    try:
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
        logger = logging.getLogger(__name__)
        logger.error(f"Error in group_meetings_api: {str(e)}")
        return Response([])


# =============================================================================
# COMPREHENSIVE TASK INTEGRATION SYSTEM
# Bridge between legacy frontend APIs and enhanced backend models
# =============================================================================

class TaskSystemAdapter:
    """
    Data transformation adapter between legacy and enhanced task systems
    """
    
    @staticmethod
    def tasktemplate_to_recurringtask(template: TaskTemplate) -> dict:
        """
        Transform TaskTemplate (enhanced) to RecurringTask (legacy) format
        """
        return {
            'id': template.id,
            'title': template.name,
            'description': template.description,
            'task_type': template.category or 'custom',
            'frequency': template.frequency or 'monthly',
            'assignee_count': template.default_people,
            'location': 'Lab',  # Default location
            'estimated_duration_hours': float(template.estimated_hours) if template.estimated_hours else 2.0,
            'auto_assign': True,  # Enhanced system supports auto-assignment
            'is_active': template.is_active,
            'next_due_date': template.start_date.isoformat() if template.start_date else None,
            'last_assigned_date': template.updated_at.isoformat() if template.updated_at else None,
            'last_assigned_user_ids': [],  # Will be populated from rotation queue
            'assignee_group': [],  # Will be populated from rotation queue
            'cron_schedule': f"0 0 1 */{template.interval or 1} *" if template.frequency == 'monthly' else "0 0 * * 0",
            'created_at': template.created_at.isoformat(),
            'updated_at': template.updated_at.isoformat(),
        }
    
    @staticmethod
    def periodictask_to_onetimetask(instance: PeriodicTaskInstance) -> dict:
        """
        Transform PeriodicTaskInstance to OneTimeTask format
        """
        return {
            'id': instance.id,
            'template_name': instance.template_name,
            'execution_start_date': instance.execution_start_date.isoformat(),
            'execution_end_date': instance.execution_end_date.isoformat(),
            'status': instance.status,
            'current_assignees': list(instance.get_assignees().values_list('id', flat=True)),
            'assignment_metadata': instance.assignment_metadata or {},
        }
    
    @staticmethod
    def populate_rotation_data(task_data: dict, template: TaskTemplate) -> dict:
        """
        Enhance task data with rotation queue information
        """
        try:
            rotation_queue = template.rotation_queues.first()
            if rotation_queue:
                # Get eligible users from rotation queue
                eligible_users = rotation_queue.queue_members.filter(is_active=True)
                task_data['assignee_group'] = [
                    {
                        'id': member.user.id,
                        'username': member.user.username,
                        'first_name': member.user.first_name,
                        'last_name': member.user.last_name,
                        'email': member.user.email,
                        'is_active': member.is_active
                    }
                    for member in eligible_users
                ]
                
                # Get last assigned users from most recent task instance
                recent_instance = PeriodicTaskInstance.objects.filter(
                    template=template
                ).order_by('-created_at').first()
                
                if recent_instance:
                    task_data['last_assigned_user_ids'] = list(
                        recent_instance.get_assignees().values_list('id', flat=True)
                    )
                    task_data['last_assigned_date'] = recent_instance.created_at.isoformat()
                    
        except Exception as e:
            logger.warning(f"Could not populate rotation data for template {template.id}: {e}")
        
        return task_data


class RecurringTaskCompatibilityView(APIView):
    """
    Compatibility endpoint for /api/recurring-tasks/
    Maps to enhanced TaskTemplate system
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Return TaskTemplate data in legacy RecurringTask format
        """
        try:
            templates = TaskTemplate.objects.filter(is_active=True)
            adapted_tasks = []
            
            for template in templates:
                task_data = TaskSystemAdapter.tasktemplate_to_recurringtask(template)
                task_data = TaskSystemAdapter.populate_rotation_data(task_data, template)
                adapted_tasks.append(task_data)
            
            return Response(adapted_tasks)
            
        except Exception as e:
            logger.error(f"Error in RecurringTaskCompatibilityView: {e}")
            return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """
        Create new TaskTemplate from legacy RecurringTask format
        """
        try:
            data = request.data
            
            # Transform legacy format to enhanced format
            template_data = {
                'name': data.get('title', ''),
                'description': data.get('description', ''),
                'task_type': 'recurring',
                'frequency': data.get('frequency', 'monthly'),
                'interval': 1,
                'category': data.get('task_type', 'custom'),
                'default_people': data.get('assignee_count', 1),
                'min_people': 1,
                'max_people': data.get('assignee_count', 1),
                'estimated_hours': data.get('estimated_duration_hours', 2.0),
                'is_active': data.get('is_active', True),
                'created_by': request.user
            }
            
            template = TaskTemplate.objects.create(**template_data)
            
            # Create rotation queue if assignee group is provided
            if 'assignee_group_ids' in data and data['assignee_group_ids']:
                from .models import TaskRotationQueue, QueueMember
                
                rotation_queue = TaskRotationQueue.objects.create(
                    template=template,
                    algorithm='fair_rotation'
                )
                
                # Add users to rotation queue
                for user_id in data['assignee_group_ids']:
                    try:
                        user = User.objects.get(id=user_id)
                        QueueMember.objects.create(
                            queue=rotation_queue,
                            user=user,
                            is_active=True
                        )
                    except User.DoesNotExist:
                        continue
            
            # Return in legacy format
            result = TaskSystemAdapter.tasktemplate_to_recurringtask(template)
            result = TaskSystemAdapter.populate_rotation_data(result, template)
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating task template: {e}")
            return Response(
                {'error': f'Failed to create task: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class OneTimeTaskCompatibilityView(APIView):
    """
    Compatibility endpoint for /api/one-time-tasks/
    Maps to PeriodicTaskInstance with one-time task filtering
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Return one-time PeriodicTaskInstance data in OneTimeTask format
        """
        try:
            # Get one-time tasks (pending tasks that can be claimed)
            one_time_instances = PeriodicTaskInstance.objects.filter(
                template__task_type='one_time',
                status__in=['scheduled', 'pending']
            ).order_by('-created_at')
            
            adapted_tasks = []
            for instance in one_time_instances:
                task_data = TaskSystemAdapter.periodictask_to_onetimetask(instance)
                adapted_tasks.append(task_data)
            
            return Response(adapted_tasks)
            
        except Exception as e:
            logger.error(f"Error in OneTimeTaskCompatibilityView: {e}")
            return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """
        Create one-time task instance
        Frontend sends: { name, description, deadline }
        """
        try:
            # Handle both DRF Request and Django Request objects
            if hasattr(request, 'data'):
                data = request.data
            else:
                import json
                data = json.loads(request.body.decode('utf-8')) if request.body else {}
            
            # Extract fields from frontend format
            name = data.get('name') or data.get('template_name', 'One-Time Task')
            description = data.get('description', '')
            deadline = data.get('deadline') or data.get('execution_end_date')
            
            # Validate required fields
            if not name:
                return Response(
                    {'error': 'Task name is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Parse deadline
            try:
                if deadline:
                    end_date = parse_date(deadline)
                    if not end_date:
                        raise ValueError("Invalid date format")
                else:
                    end_date = timezone.now().date() + timedelta(days=7)  # Default to 1 week
            except ValueError:
                return Response(
                    {'error': 'Invalid deadline format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            start_date = timezone.now().date()
            
            # Create or get one-time task template
            template, created = TaskTemplate.objects.get_or_create(
                name=name,
                task_type='one_time',
                defaults={
                    'description': description,
                    'category': 'custom',
                    'start_date': start_date,
                    'end_date': end_date,
                    'default_people': 1,
                    'min_people': 1,
                    'max_people': 1,
                    'is_active': True,
                    'created_by': request.user,
                    'priority': 'medium'
                }
            )
            
            # Create task instance
            instance = PeriodicTaskInstance.objects.create(
                template=template,
                template_name=name,
                execution_start_date=start_date,
                execution_end_date=end_date,
                status='scheduled',  # Use 'scheduled' to allow claiming
                scheduled_period=timezone.now().strftime('%Y-%m'),
                original_assignees=[],
                current_assignees=[],
                assignment_metadata={
                    'one_time': True,
                    'created_by': request.user.id,
                    'remind_reoffer': data.get('remind_reoffer', False)
                }
            )
            
            # Send email notifications to all active users
            try:
                from django.contrib.auth.models import User
                recipients = list(User.objects.filter(is_active=True))
                from notifications.email_service import EmailNotificationService
                
                success = EmailNotificationService.send_email_notification(
                    recipients=recipients,
                    subject=f"One-time Task: {template.name}",
                    template_name='one_time_task_created',
                    context={
                        'task': {'name': template.name, 'description': template.description, 'deadline': str(end_date)},
                        'claim_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/one-time-tasks/{instance.id}/claim"
                    }
                )
                
                if not success:
                    logger.warning(f"Failed to send one-time task creation emails for task {instance.id}")
                else:
                    logger.info(f"Successfully sent one-time task creation emails for task {instance.id} to {len(recipients)} recipients")
                    
            except Exception as e:
                logger.error(f"Error sending one-time task creation emails for task {instance.id}: {e}")
            
            result = TaskSystemAdapter.periodictask_to_onetimetask(instance)
            return Response(result, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating one-time task: {e}")
            return Response(
                {'error': f'Failed to create one-time task: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class OneTimeTaskClaimView(APIView):
    """
    Endpoint for claiming one-time tasks
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, task_id):
        """
        Claim a one-time task for the current user
        """
        try:
            instance = PeriodicTaskInstance.objects.get(id=task_id)
            
            # Check if task can be claimed
            if not instance.can_be_claimed(request.user):
                return Response(
                    {'error': 'Task cannot be claimed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Claim the task
            instance.claim_task(request.user)
            # 通知管理员（所有 is_staff 用户）
            try:
                from django.contrib.auth.models import User
                from notifications.email_service import EmailNotificationService
                admin_users = list(User.objects.filter(is_staff=True, is_active=True))
                if admin_users:
                    admin_success = EmailNotificationService.send_email_notification(
                        recipients=admin_users,
                        subject=f"One-time Task Claimed: {instance.template_name}",
                        template_name='one_time_task_claimed',
                        context={
                            'task': {'name': instance.template_name},
                            'creator_name': 'Admin Team',
                            'claimer_name': request.user.get_full_name() or request.user.username,
                            'view_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/one-time-tasks"
                        }
                    )
                    if not admin_success:
                        logger.warning(f"Failed to send admin claimed notifications for task {instance.id}")
                    else:
                        logger.info(f"Sent admin claimed notifications for task {instance.id} to {len(admin_users)} admins")
            except Exception as e:
                logger.warning(f"Error notifying admins for claimed task {instance.id}: {e}")

            result = TaskSystemAdapter.periodictask_to_onetimetask(instance)
            return Response(result)
            
        except PeriodicTaskInstance.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error claiming task {task_id}: {e}")
            return Response(
                {'error': f'Failed to claim task: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class TaskAssignmentCompatibilityView(APIView):
    """
    Handle task assignment for recurring tasks
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, task_id):
        """
        Assign users to a recurring task (TaskTemplate)
        """
        try:
            template = TaskTemplate.objects.get(id=task_id)
            user_ids = request.data.get('user_ids', [])
            
            if not user_ids:
                return Response(
                    {'error': 'No user IDs provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get or create rotation queue
            from .models import TaskRotationQueue, QueueMember
            
            rotation_queue, created = TaskRotationQueue.objects.get_or_create(
                template=template,
                defaults={'algorithm': 'fair_rotation'}
            )
            
            # Clear existing members and add new ones
            rotation_queue.queue_members.all().delete()
            
            for user_id in user_ids:
                try:
                    user = User.objects.get(id=user_id)
                    QueueMember.objects.create(
                        queue=rotation_queue,
                        user=user,
                        is_active=True
                    )
                except User.DoesNotExist:
                    continue
            
            return Response({'message': 'Users assigned successfully'})
            
        except TaskTemplate.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error assigning users to task {task_id}: {e}")
            return Response(
                {'error': f'Failed to assign users: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )