"""
Task Assignment Service for Periodic Task Management System
Implements fair rotation algorithm and intelligent task assignment
"""

from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
import random
import logging
from django.db.models import Q, Avg, Count
from django.contrib.auth.models import User
from django.utils import timezone

from ..models import (
    TaskTemplate, PeriodicTaskInstance, TaskRotationQueue, 
    QueueMember, TaskSwapRequest
)

logger = logging.getLogger(__name__)


class TaskAssignmentError(Exception):
    """Custom exception for task assignment errors"""
    pass


class FairRotationAlgorithm:
    """
    Fair rotation algorithm for equitable task distribution
    Ensures balanced workload distribution across team members
    """
    
    def __init__(self, rotation_queue: TaskRotationQueue):
        self.rotation_queue = rotation_queue
        self.template = rotation_queue.template
    
    def assign_members_for_period(self, period_str: str) -> List[QueueMember]:
        """
        Main assignment method using fair rotation algorithm
        
        Args:
            period_str: Period in YYYY-MM format
            
        Returns:
            List of selected QueueMember objects
        """
        required_count = self.template.default_people
        available_members = self._get_available_members(period_str)
        
        if len(available_members) < required_count:
            raise TaskAssignmentError(
                f"Insufficient available members: {len(available_members)} < {required_count}"
            )
        
        # Calculate priority scores for all available members
        scored_members = self._calculate_priority_scores(available_members, period_str)
        
        # Sort by priority score (highest first)
        scored_members.sort(key=lambda x: x[1], reverse=True)
        
        # Select top members
        selected_members = [member for member, score in scored_members[:required_count]]
        
        # Update assignment statistics
        self._update_assignment_statistics(selected_members, period_str)
        
        logger.info(
            f"Assigned {len(selected_members)} members for period {period_str}: "
            f"{[m.user.username for m in selected_members]}"
        )
        
        return selected_members
    
    def _get_available_members(self, period_str: str) -> List[QueueMember]:
        """Get all available members for the given period"""
        members = self.rotation_queue.queue_members.filter(is_active=True)
        available_members = []
        
        for member in members:
            # Skip system accounts
            if member.user.username in ['admin', 'print_server']:
                continue
                
            # Check availability for this period
            if self._is_member_available(member, period_str):
                available_members.append(member)
        
        return available_members
    
    def _is_member_available(self, member: QueueMember, period_str: str) -> bool:
        """Check if member is available for the given period"""
        availability_data = member.availability_data or {}
        exclude_periods = availability_data.get('exclude_periods', [])
        
        return period_str not in exclude_periods
    
    def _calculate_priority_scores(
        self, 
        members: List[QueueMember], 
        target_period: str
    ) -> List[Tuple[QueueMember, float]]:
        """
        Calculate priority scores for all members using fairness algorithm
        
        Factors considered:
        1. Time since last assignment (20 points per month)
        2. Assignment count balance (30 points per assignment difference)
        3. Completion rate (up to 10 points)
        4. Random factor (up to 10 points)
        """
        target_date = datetime.strptime(target_period, '%Y-%m').date()
        scored_members = []
        
        # Get average assignment count for normalization
        avg_assignments = self._get_average_assignments()
        
        for member in members:
            score = self._calculate_member_score(member, target_date, avg_assignments)
            scored_members.append((member, score))
        
        return scored_members
    
    def _calculate_member_score(
        self, 
        member: QueueMember, 
        target_date: date, 
        avg_assignments: float
    ) -> float:
        """Calculate individual member priority score"""
        base_score = 100.0
        
        # Factor 1: Time since last assignment
        if member.last_assigned_period:
            months_gap = self._calculate_months_gap(
                member.last_assigned_period, 
                target_date.strftime('%Y-%m')
            )
            base_score += months_gap * 20
        else:
            base_score += 200  # Never assigned bonus
        
        # Factor 2: Assignment count balance
        assignment_difference = avg_assignments - member.total_assignments
        base_score += assignment_difference * 30
        
        # Factor 3: Completion rate bonus
        base_score += (member.completion_rate / 100) * 10
        
        # Factor 4: Random factor to prevent identical rankings
        base_score += random.random() * self.rotation_queue.random_factor * 20
        
        return max(0, base_score)
    
    def _calculate_months_gap(self, period1: str, period2: str) -> int:
        """Calculate the number of months between two periods"""
        year1, month1 = map(int, period1.split('-'))
        year2, month2 = map(int, period2.split('-'))
        
        return (year2 - year1) * 12 + (month2 - month1)
    
    def _get_average_assignments(self) -> float:
        """Get average assignment count across all active queue members"""
        active_members = self.rotation_queue.queue_members.filter(is_active=True)
        if not active_members.exists():
            return 0.0
        
        avg_data = active_members.aggregate(avg_assignments=Avg('total_assignments'))
        return avg_data['avg_assignments'] or 0.0
    
    def _update_assignment_statistics(
        self, 
        selected_members: List[QueueMember], 
        period_str: str
    ):
        """Update assignment statistics for selected members"""
        current_time = timezone.now()
        
        for member in selected_members:
            member.total_assignments += 1
            member.last_assigned_date = current_time
            member.last_assigned_period = period_str
            member.save()
        
        # Update rotation queue timestamp
        self.rotation_queue.last_updated = current_time
        self.rotation_queue.save()


class TaskGenerationService:
    """Service for generating task instances from templates"""
    
    @classmethod
    def generate_tasks_for_period(
        cls, 
        period_str: str, 
        template_ids: Optional[List[int]] = None
    ) -> List[PeriodicTaskInstance]:
        """
        Generate task instances for a specific period
        
        Args:
            period_str: Period in YYYY-MM format
            template_ids: Optional list of template IDs to generate (all active if None)
            
        Returns:
            List of created PeriodicTaskInstance objects
        """
        if template_ids:
            templates = TaskTemplate.objects.filter(
                id__in=template_ids, 
                is_active=True
            )
        else:
            templates = TaskTemplate.objects.filter(is_active=True)
        
        generated_tasks = []
        
        for template in templates:
            if template.should_generate_for_period(period_str):
                try:
                    task_instance = cls._create_task_instance(template, period_str)
                    generated_tasks.append(task_instance)
                    
                    logger.info(
                        f"Generated task instance: {task_instance.template_name} "
                        f"for period {period_str}"
                    )
                    
                except Exception as e:
                    logger.error(
                        f"Failed to generate task for template {template.name} "
                        f"in period {period_str}: {str(e)}"
                    )
                    continue
        
        return generated_tasks
    
    @classmethod
    def batch_generate_tasks(
        cls, 
        period_list: List[str], 
        template_ids: Optional[List[int]] = None
    ) -> Dict[str, List[PeriodicTaskInstance]]:
        """
        Generate tasks for multiple periods at once
        
        Args:
            period_list: List of periods in YYYY-MM format
            template_ids: Optional list of template IDs
            
        Returns:
            Dictionary mapping periods to generated task lists
        """
        results = {}
        
        for period_str in period_list:
            try:
                tasks = cls.generate_tasks_for_period(period_str, template_ids)
                results[period_str] = tasks
            except Exception as e:
                logger.error(f"Failed to generate tasks for period {period_str}: {str(e)}")
                results[period_str] = []
        
        return results
    
    @classmethod
    def preview_task_generation(
        cls, 
        period_list: List[str], 
        template_ids: Optional[List[int]] = None
    ) -> List[Dict]:
        """
        Preview what tasks would be generated without creating them
        
        Returns:
            List of task preview dictionaries
        """
        if template_ids:
            templates = TaskTemplate.objects.filter(
                id__in=template_ids, 
                is_active=True
            )
        else:
            templates = TaskTemplate.objects.filter(is_active=True)
        
        preview_data = []
        
        for period_str in period_list:
            for template in templates:
                if template.should_generate_for_period(period_str):
                    # Get execution window
                    start_date, end_date = template.get_execution_window(period_str)
                    
                    # Preview assignees
                    try:
                        rotation_queue = template.rotation_queue
                        algorithm = FairRotationAlgorithm(rotation_queue)
                        assignees = algorithm.assign_members_for_period(period_str)
                        assignee_names = [m.user.get_full_name() or m.user.username 
                                        for m in assignees]
                        
                        # Rollback the assignment statistics since this is just preview
                        for member in assignees:
                            member.total_assignments -= 1
                            member.last_assigned_date = None
                            member.last_assigned_period = None
                            member.save()
                        
                    except (TaskRotationQueue.DoesNotExist, TaskAssignmentError):
                        assignee_names = ['No rotation queue configured']
                    
                    preview_data.append({
                        'template_id': template.id,
                        'template_name': template.name,
                        'period': period_str,
                        'execution_start_date': start_date,
                        'execution_end_date': end_date,
                        'assignees': assignee_names,
                        'estimated_hours': template.estimated_hours,
                        'priority': template.priority,
                    })
        
        return preview_data
    
    @classmethod
    def _create_task_instance(
        cls, 
        template: TaskTemplate, 
        period_str: str
    ) -> PeriodicTaskInstance:
        """Create a single task instance from template"""
        
        # Get execution window
        start_date, end_date = template.get_execution_window(period_str)
        
        # Create task instance
        task_instance = PeriodicTaskInstance.objects.create(
            template=template,
            template_name=template.name,
            scheduled_period=period_str,
            execution_start_date=start_date,
            execution_end_date=end_date,
            status='scheduled'
        )
        
        # Assign users using rotation algorithm
        try:
            rotation_queue = template.rotation_queue
            algorithm = FairRotationAlgorithm(rotation_queue)
            assigned_members = algorithm.assign_members_for_period(period_str)
            
            # Store assignee information
            assignee_ids = [member.user.id for member in assigned_members]
            task_instance.original_assignees = assignee_ids
            task_instance.current_assignees = assignee_ids.copy()
            
            # Set assignment metadata
            assignment_metadata = {
                'assigned_at': timezone.now().isoformat(),
                'assignment_method': 'fair_rotation',
            }
            
            if assigned_members:
                assignment_metadata['primary_assignee'] = assigned_members[0].user.id
                assignment_metadata['assignee_roles'] = {
                    str(assigned_members[0].user.id): 'primary'
                }
                
                for member in assigned_members[1:]:
                    assignment_metadata['assignee_roles'][str(member.user.id)] = 'assistant'
            
            task_instance.assignment_metadata = assignment_metadata
            task_instance.save()
            
        except TaskRotationQueue.DoesNotExist:
            logger.warning(
                f"No rotation queue found for template {template.name}. "
                f"Task created without assignments."
            )
        
        # Send assignment notifications
        try:
            from .notification_service import TaskNotificationService
            if assigned_members:
                assignee_users = [member.user for member in assigned_members]
                TaskNotificationService.notify_task_assignment(
                    task_instance=task_instance,
                    assignees=assignee_users,
                    is_new_assignment=True
                )
        except Exception as e:
            logger.warning(f"Failed to send assignment notifications: {str(e)}")
        
        return task_instance


class TaskSwapService:
    """Service for handling task swap requests"""
    
    @classmethod
    def create_swap_request(
        cls,
        task_instance: PeriodicTaskInstance,
        from_user: User,
        to_user: Optional[User] = None,
        request_type: str = 'swap',
        reason: str = '',
        is_public_pool: bool = False
    ) -> TaskSwapRequest:
        """
        Create a new task swap request
        
        Args:
            task_instance: Task to be swapped
            from_user: User requesting the swap
            to_user: Target user (optional for public pool requests)
            request_type: 'swap' or 'transfer'
            reason: Reason for the request
            is_public_pool: Whether to publish to public pool
            
        Returns:
            Created TaskSwapRequest object
        """
        # Validate that from_user is assigned to the task
        if from_user.id not in task_instance.current_assignees:
            raise TaskAssignmentError("User is not assigned to this task")
        
        # Create swap request
        swap_request = TaskSwapRequest.objects.create(
            task_instance=task_instance,
            request_type=request_type,
            from_user=from_user,
            to_user=to_user,
            reason=reason,
            is_public_pool=is_public_pool
        )
        
        if is_public_pool:
            swap_request.pool_published_at = timezone.now()
            swap_request.save()
        
        # Send notifications
        try:
            from .notification_service import TaskNotificationService
            TaskNotificationService.notify_swap_request_created(swap_request)
        except Exception as e:
            logger.warning(f"Failed to send swap request notifications: {str(e)}")
        
        logger.info(f"Created swap request: {swap_request}")
        
        return swap_request
    
    @classmethod
    def approve_swap_request(
        cls,
        swap_request: TaskSwapRequest,
        approving_user: User,
        is_admin: bool = False
    ) -> bool:
        """
        Approve a swap request
        
        Args:
            swap_request: The swap request to approve
            approving_user: User approving the request
            is_admin: Whether the approving user is admin
            
        Returns:
            True if swap was executed, False if more approvals needed
        """
        if is_admin:
            swap_request.admin_approved = True
            swap_request.admin_approved_at = timezone.now()
            swap_request.admin_approved_by = approving_user
        elif (swap_request.request_type == 'swap' and 
              swap_request.to_user == approving_user):
            swap_request.target_user_approved = True
            swap_request.target_user_approved_at = timezone.now()
        else:
            raise TaskAssignmentError("User not authorized to approve this request")
        
        # Check if all required approvals are in place
        if swap_request.can_approve():
            cls._execute_swap(swap_request)
            swap_request.status = 'approved'
            
            # Send approval notifications
            try:
                from .notification_service import TaskNotificationService
                TaskNotificationService.notify_swap_request_approved(
                    swap_request=swap_request,
                    approving_user=approving_user
                )
            except Exception as e:
                logger.warning(f"Failed to send swap approval notifications: {str(e)}")
            
            logger.info(f"Executed swap request: {swap_request}")
        
        swap_request.save()
        return swap_request.status == 'approved'
    
    @classmethod
    def claim_from_pool(
        cls,
        swap_request: TaskSwapRequest,
        claiming_user: User
    ) -> TaskSwapRequest:
        """
        Claim a swap request from the public pool
        
        Args:
            swap_request: The public pool swap request
            claiming_user: User claiming the request
            
        Returns:
            Updated swap request
        """
        if not swap_request.is_public_pool:
            raise TaskAssignmentError("Request is not in public pool")
        
        if swap_request.status != 'pending':
            raise TaskAssignmentError("Request is not available for claiming")
        
        swap_request.to_user = claiming_user
        swap_request.is_public_pool = False
        
        # For swap requests, auto-approve target user
        if swap_request.request_type == 'swap':
            swap_request.target_user_approved = True
            swap_request.target_user_approved_at = timezone.now()
        
        # Check if can be auto-approved (if admin approval not required)
        if swap_request.can_approve():
            cls._execute_swap(swap_request)
            swap_request.status = 'approved'
        
        swap_request.save()
        return swap_request
    
    @classmethod
    def _execute_swap(cls, swap_request: TaskSwapRequest):
        """Execute the approved swap/transfer"""
        task = swap_request.task_instance
        current_assignees = list(task.current_assignees)
        
        # Remove from_user
        if swap_request.from_user.id in current_assignees:
            current_assignees.remove(swap_request.from_user.id)
        
        # Add to_user (if not already assigned)
        if (swap_request.to_user and 
            swap_request.to_user.id not in current_assignees):
            current_assignees.append(swap_request.to_user.id)
        
        task.current_assignees = current_assignees
        
        # Update assignment metadata
        metadata = task.assignment_metadata or {}
        if 'swap_history' not in metadata:
            metadata['swap_history'] = []
        
        swap_record = {
            'type': swap_request.request_type,
            'from_user': swap_request.from_user.id,
            'to_user': swap_request.to_user.id if swap_request.to_user else None,
            'executed_at': timezone.now().isoformat(),
            'request_id': swap_request.id
        }
        metadata['swap_history'].append(swap_record)
        
        task.assignment_metadata = metadata
        task.save()


class TaskStatisticsService:
    """Service for calculating task-related statistics"""
    
    @classmethod
    def get_user_statistics(cls, user: User) -> Dict:
        """Get comprehensive statistics for a user"""
        # Get all tasks assigned to user
        user_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user.id]
        )
        
        # Get completed tasks
        completed_tasks = user_tasks.filter(status='completed')
        
        # Calculate statistics
        total_tasks = user_tasks.count()
        completed_count = completed_tasks.count()
        completion_rate = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
        
        # Get current tasks
        current_tasks = user_tasks.filter(
            status__in=['scheduled', 'pending', 'in_progress']
        )
        
        # Get overdue tasks
        overdue_tasks = user_tasks.filter(
            status__in=['scheduled', 'pending', 'in_progress'],
            execution_end_date__lt=date.today()
        )
        
        # Get monthly breakdown
        monthly_stats = cls._get_monthly_task_breakdown(user_tasks)
        
        return {
            'total_tasks': total_tasks,
            'completed_tasks': completed_count,
            'completion_rate': round(completion_rate, 1),
            'current_tasks': current_tasks.count(),
            'overdue_tasks': overdue_tasks.count(),
            'monthly_breakdown': monthly_stats,
            'average_completion_time': cls._get_average_completion_time(completed_tasks),
        }
    
    @classmethod
    def get_system_statistics(cls) -> Dict:
        """Get system-wide task statistics"""
        # Get all tasks
        all_tasks = PeriodicTaskInstance.objects.all()
        
        # Status breakdown
        status_stats = all_tasks.values('status').annotate(
            count=Count('id')
        ).order_by('status')
        
        # Template popularity
        template_stats = all_tasks.values(
            'template__name'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Monthly trend
        monthly_trend = cls._get_monthly_system_trend()
        
        return {
            'total_tasks': all_tasks.count(),
            'status_breakdown': list(status_stats),
            'template_popularity': list(template_stats),
            'monthly_trend': monthly_trend,
            'active_templates': TaskTemplate.objects.filter(is_active=True).count(),
            'total_swaps': TaskSwapRequest.objects.count(),
        }
    
    @classmethod
    def _get_monthly_task_breakdown(cls, queryset) -> List[Dict]:
        """Get monthly task breakdown for a queryset"""
        from django.db.models import Extract
        
        monthly_data = queryset.values(
            year=Extract('execution_start_date', 'year'),
            month=Extract('execution_start_date', 'month')
        ).annotate(
            count=Count('id')
        ).order_by('year', 'month')
        
        return [
            {
                'period': f"{item['year']}-{item['month']:02d}",
                'count': item['count']
            }
            for item in monthly_data
        ]
    
    @classmethod
    def _get_average_completion_time(cls, completed_tasks) -> Optional[float]:
        """Calculate average completion time in hours"""
        tasks_with_duration = completed_tasks.exclude(
            completion_duration__isnull=True
        )
        
        if not tasks_with_duration.exists():
            return None
        
        avg_minutes = tasks_with_duration.aggregate(
            avg_duration=Avg('completion_duration')
        )['avg_duration']
        
        return round(avg_minutes / 60, 1) if avg_minutes else None
    
    @classmethod
    def _get_monthly_system_trend(cls) -> List[Dict]:
        """Get monthly trend of task creation and completion"""
        from django.db.models import Extract
        
        # Tasks created by month
        created_trend = PeriodicTaskInstance.objects.values(
            year=Extract('created_at', 'year'),
            month=Extract('created_at', 'month')
        ).annotate(
            created_count=Count('id')
        ).order_by('year', 'month')
        
        # Tasks completed by month
        completed_trend = PeriodicTaskInstance.objects.filter(
            status='completed'
        ).values(
            year=Extract('completed_at', 'year'),
            month=Extract('completed_at', 'month')
        ).annotate(
            completed_count=Count('id')
        ).order_by('year', 'month')
        
        # Combine trends
        trend_data = {}
        for item in created_trend:
            period = f"{item['year']}-{item['month']:02d}"
            trend_data[period] = {'created': item['created_count'], 'completed': 0}
        
        for item in completed_trend:
            period = f"{item['year']}-{item['month']:02d}"
            if period in trend_data:
                trend_data[period]['completed'] = item['completed_count']
        
        return [
            {
                'period': period,
                'created': data['created'],
                'completed': data['completed']
            }
            for period, data in sorted(trend_data.items())
        ]