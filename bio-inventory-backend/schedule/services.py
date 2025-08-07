"""
Comprehensive Schedule Management Services

This module provides both meeting management and periodic task management services:

Meeting Management:
- Fair rotation algorithm for presenter assignment  
- Meeting generation and scheduling
- Swap request handling
- Holiday-aware scheduling for Quebec

Periodic Task Management:
- Fair rotation algorithm for task assignment
- Task generation and assignment
- Swap request handling
- Notification services
"""

import random
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from django.db import transaction
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q, Avg
import calendar

from .models import (
    # Meeting models
    MeetingConfiguration, MeetingInstance, Presenter, RotationSystem,
    QueueEntry, SwapRequest as MeetingSwapRequest, Event,
    # Task models
    TaskTemplate, PeriodicTaskInstance, TaskRotationQueue, QueueMember,
    TaskSwapRequest, NotificationRecord, StatusChangeRecord
)


# ===============================================
# Meeting Management Services (Existing)
# ===============================================

class QuebecHolidayService:
    """Quebec holiday service for accurate meeting scheduling"""
    
    def __init__(self):
        self.fixed_holidays = {
            (1, 1): "New Year's Day",
            (6, 24): "Quebec National Holiday",
            (7, 1): "Canada Day",
            (12, 25): "Christmas Day",
        }
    
    def get_easter_date(self, year: int) -> date:
        """Calculate Easter Sunday for given year using algorithm"""
        # Using the Anonymous Gregorian algorithm
        a = year % 19
        b = year // 100
        c = year % 100
        d = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1
        return date(year, month, day)
    
    def get_movable_holidays(self, year: int) -> Dict[date, str]:
        """Get movable holidays for the year"""
        easter = self.get_easter_date(year)
        good_friday = easter - timedelta(days=2)
        easter_monday = easter + timedelta(days=1)
        
        # Victoria Day - Monday before May 25
        may_24 = date(year, 5, 24)
        victoria_day = may_24 - timedelta(days=may_24.weekday())
        
        # Labour Day - First Monday in September
        sept_1 = date(year, 9, 1)
        labour_day = sept_1 + timedelta(days=(7 - sept_1.weekday()) % 7)
        
        # Thanksgiving - Second Monday in October
        oct_1 = date(year, 10, 1)
        first_monday_oct = oct_1 + timedelta(days=(7 - oct_1.weekday()) % 7)
        thanksgiving = first_monday_oct + timedelta(days=7)
        
        return {
            good_friday: "Good Friday",
            easter_monday: "Easter Monday",
            victoria_day: "Victoria Day",
            labour_day: "Labour Day",
            thanksgiving: "Thanksgiving"
        }
    
    def is_holiday(self, check_date: date) -> bool:
        """Check if given date is a Quebec holiday"""
        # Check fixed holidays
        if (check_date.month, check_date.day) in self.fixed_holidays:
            return True
        
        # Check movable holidays
        movable_holidays = self.get_movable_holidays(check_date.year)
        return check_date in movable_holidays
    
    def get_next_meeting_date(self, preferred_date: date) -> date:
        """Get next valid meeting date, skipping holidays"""
        current_date = preferred_date
        while self.is_holiday(current_date):
            current_date += timedelta(days=7)  # Skip to next week
        return current_date
    
    def get_holiday_name(self, check_date: date) -> Optional[str]:
        """Get holiday name if date is a holiday"""
        if (check_date.month, check_date.day) in self.fixed_holidays:
            return self.fixed_holidays[(check_date.month, check_date.day)]
        
        movable_holidays = self.get_movable_holidays(check_date.year)
        return movable_holidays.get(check_date)


class MeetingFairRotationAlgorithm:
    """Fair rotation algorithm for meeting presenter assignment"""
    
    def __init__(self, rotation_system: RotationSystem):
        self.rotation_system = rotation_system
    
    def calculate_presenter_priority(self, queue_entry: QueueEntry, target_date: date) -> float:
        """Calculate priority score for a queue entry"""
        base_score = 100.0
        
        # Factor 1: Time since last presentation
        if queue_entry.last_presented_date:
            days_since = (target_date - queue_entry.last_presented_date).days
            weeks_since = days_since / 7.0
            base_score += weeks_since * 10
        else:
            # Never presented before gets high priority
            base_score += 200
        
        # Factor 2: Postpone penalty
        base_score -= queue_entry.postpone_count * 20
        
        # Factor 3: Minimum gap enforcement
        if queue_entry.last_presented_date:
            weeks_since = (target_date - queue_entry.last_presented_date).days / 7.0
            if weeks_since < self.rotation_system.min_gap_between_presentations:
                base_score = -1000  # Make ineligible
        
        # Factor 4: Fairness weight application
        base_score *= self.rotation_system.fairness_weight
        
        return max(0, base_score)
    
    def get_next_presenters(
        self, 
        meeting_date: date, 
        required_count: int = 1
    ) -> List[QueueEntry]:
        """Calculate next presenters using fair rotation algorithm"""
        queue_entries = QueueEntry.objects.filter(
            rotation_system=self.rotation_system
        ).select_related('user')
        
        # Calculate priority scores
        scored_entries = []
        for entry in queue_entries:
            score = self.calculate_presenter_priority(entry, meeting_date)
            if score > 0:  # Only eligible entries
                scored_entries.append((entry, score))
        
        # Sort by priority (highest first) and select
        scored_entries.sort(key=lambda x: x[1], reverse=True)
        
        selected_entries = []
        for entry, score in scored_entries[:required_count]:
            # Update the entry's priority score
            entry.priority = score
            entry.save()
            selected_entries.append(entry)
        
        return selected_entries
    
    def update_after_presentation(self, presenter_user: User, presentation_date: date):
        """Update rotation system after a presentation is completed"""
        try:
            queue_entry = QueueEntry.objects.get(
                rotation_system=self.rotation_system,
                user=presenter_user
            )
            queue_entry.last_presented_date = presentation_date
            queue_entry.postpone_count = 0  # Reset postpone count after successful presentation
            queue_entry.save()
            
            # Recalculate all priorities
            self.recalculate_all_priorities()
            
        except QueueEntry.DoesNotExist:
            # If queue entry doesn't exist, create one
            QueueEntry.objects.create(
                rotation_system=self.rotation_system,
                user=presenter_user,
                last_presented_date=presentation_date,
                postpone_count=0
            )
    
    def handle_postponement(self, presenter_user: User):
        """Handle when a presenter postpones their presentation"""
        try:
            queue_entry = QueueEntry.objects.get(
                rotation_system=self.rotation_system,
                user=presenter_user
            )
            queue_entry.postpone_count += 1
            queue_entry.save()
            
            # Recalculate priorities after postponement
            self.recalculate_all_priorities()
            
        except QueueEntry.DoesNotExist:
            pass
    
    def recalculate_all_priorities(self):
        """Recalculate priorities for all queue entries"""
        queue_entries = QueueEntry.objects.filter(
            rotation_system=self.rotation_system
        )
        
        for entry in queue_entries:
            # Use today as reference date for priority calculation
            today = timezone.now().date()
            entry.priority = self.calculate_presenter_priority(entry, today)
            entry.save()


class MeetingGenerationService:
    """Service for generating meeting instances"""
    
    def __init__(self):
        self.holiday_service = QuebecHolidayService()
    
    def generate_meetings(
        self, 
        start_date: date, 
        end_date: date,
        meeting_types: List[str] = None,
        auto_assign_presenters: bool = True
    ) -> Dict[str, any]:
        """Generate meetings for date range"""
        if meeting_types is None:
            meeting_types = ['research_update', 'journal_club']
        
        config = MeetingConfiguration.objects.first()
        if not config:
            raise ValueError("No meeting configuration found. Please set up meeting configuration first.")
        
        generated_meetings = []
        current_date = start_date
        meeting_type_cycle = 0
        
        while current_date <= end_date:
            # Find next meeting date (correct day of week)
            target_weekday = config.day_of_week
            days_ahead = target_weekday - current_date.weekday()
            if days_ahead <= 0:  # Target day already passed this week
                days_ahead += 7
            
            meeting_date = current_date + timedelta(days=days_ahead)
            
            if meeting_date > end_date:
                break
            
            # Skip if holiday
            valid_meeting_date = self.holiday_service.get_next_meeting_date(meeting_date)
            if valid_meeting_date > end_date:
                current_date = meeting_date + timedelta(days=1)
                continue
            
            # Determine meeting type (alternating)
            meeting_type = meeting_types[meeting_type_cycle % len(meeting_types)]
            meeting_type_cycle += 1
            
            # Check if meeting already exists
            existing_meeting = MeetingInstance.objects.filter(
                date=valid_meeting_date,
                meeting_type=meeting_type
            ).first()
            
            if not existing_meeting:
                # Create event
                duration = (
                    config.research_update_duration 
                    if meeting_type == 'research_update' 
                    else config.journal_club_duration
                )
                
                start_datetime = timezone.datetime.combine(
                    valid_meeting_date, 
                    config.start_time
                )
                end_datetime = start_datetime + timedelta(minutes=duration)
                
                event = Event.objects.create(
                    title=f"{meeting_type.replace('_', ' ').title()}",
                    start_time=timezone.make_aware(start_datetime),
                    end_time=timezone.make_aware(end_datetime),
                    event_type='meeting',
                    description=f"Weekly {meeting_type.replace('_', ' ')} meeting",
                    created_by_id=1  # System generated
                )
                
                # Create meeting instance
                meeting_instance = MeetingInstance.objects.create(
                    date=valid_meeting_date,
                    meeting_type=meeting_type,
                    status='scheduled',
                    event=event
                )
                
                # Auto-assign presenters if requested
                presenters = []
                if auto_assign_presenters:
                    presenters = self._assign_presenters(meeting_instance)
                
                generated_meetings.append({
                    'meeting_instance': meeting_instance,
                    'presenters': presenters,
                    'date': valid_meeting_date,
                    'type': meeting_type
                })
            
            # Move to next week
            current_date = meeting_date + timedelta(days=1)
        
        return {
            'generated_meetings': generated_meetings,
            'count': len(generated_meetings),
            'start_date': start_date,
            'end_date': end_date
        }
    
    def _assign_presenters(self, meeting_instance: MeetingInstance) -> List[Presenter]:
        """Assign presenters to a meeting instance"""
        presenters = []
        
        # Get active rotation system
        rotation_system = RotationSystem.objects.filter(is_active=True).first()
        if not rotation_system:
            return presenters
        
        # Determine number of presenters needed
        presenter_count = 1
        if meeting_instance.meeting_type == 'research_update':
            presenter_count = min(
                rotation_system.max_consecutive_presenters,
                QueueEntry.objects.filter(rotation_system=rotation_system).count()
            )
        
        # Get next presenters using fair rotation algorithm
        algorithm = MeetingFairRotationAlgorithm(rotation_system)
        selected_entries = algorithm.get_next_presenters(
            meeting_instance.date, 
            presenter_count
        )
        
        # Create presenter records
        for i, queue_entry in enumerate(selected_entries):
            presenter = Presenter.objects.create(
                meeting_instance=meeting_instance,
                user=queue_entry.user,
                order=i + 1,
                status='assigned'
            )
            presenters.append(presenter)
            
            # Update queue entry
            queue_entry.next_scheduled_date = meeting_instance.date
            queue_entry.save()
        
        return presenters


class MeetingSwapRequestService:
    """Service for managing meeting swap and postpone requests"""
    
    def create_swap_request(
        self, 
        requester: User,
        original_presentation: Presenter,
        target_presentation: Presenter,
        reason: str
    ) -> MeetingSwapRequest:
        """Create a swap request between two presentations"""
        swap_request = MeetingSwapRequest.objects.create(
            request_type='swap',
            requester=requester,
            original_presentation=original_presentation,
            target_presentation=target_presentation,
            reason=reason
        )
        
        return swap_request
    
    def create_postpone_request(
        self,
        requester: User,
        original_presentation: Presenter,
        reason: str,
        cascade_effect: str = 'skip'
    ) -> MeetingSwapRequest:
        """Create a postpone request"""
        swap_request = MeetingSwapRequest.objects.create(
            request_type='postpone',
            requester=requester,
            original_presentation=original_presentation,
            reason=reason,
            cascade_effect=cascade_effect
        )
        
        return swap_request


# ===============================================
# Periodic Task Management Services (New)
# ===============================================

class TaskFairRotationAlgorithm:
    """Implements fair rotation algorithm for periodic task assignment"""
    
    def __init__(self, queue: TaskRotationQueue):
        self.queue = queue
    
    def assign_users_for_period(
        self, 
        period_str: str, 
        required_count: Optional[int] = None
    ) -> List[User]:
        """
        Assign users for a given period using fair rotation algorithm
        
        Args:
            period_str: Period in YYYY-MM format
            required_count: Number of users to assign (uses template default if None)
            
        Returns:
            List of assigned User objects
            
        Raises:
            ValueError: If not enough available users
        """
        if not required_count:
            required_count = self.queue.template.default_people
        
        available_members = self._get_available_members(period_str)
        
        if len(available_members) < required_count:
            raise ValueError(
                f"Insufficient available members for {self.queue.template.name}: "
                f"{len(available_members)} available, {required_count} required"
            )
        
        # Calculate priority scores for each member
        scored_members = []
        for member in available_members:
            score = self._calculate_priority_score(member, period_str)
            scored_members.append((member, score))
        
        # Sort by score (higher is better priority)
        scored_members.sort(key=lambda x: x[1], reverse=True)
        
        # Select top members
        selected_members = [member for member, _ in scored_members[:required_count]]
        
        # Update assignment statistics
        with transaction.atomic():
            for member in selected_members:
                member.update_assignment_stats(period_str)
        
        return [member.user for member in selected_members]
    
    def _get_available_members(self, period_str: str) -> List[QueueMember]:
        """Get members available for the given period"""
        return [
            member for member in self.queue.get_queue_members()
            if self._is_member_available(member, period_str)
        ]
    
    def _is_member_available(self, member: QueueMember, period_str: str) -> bool:
        """Check if a queue member is available for the given period"""
        # Check if member is active
        if not member.is_active:
            return False
        
        # Exclude admin and print_server users
        if member.user.username in ['admin', 'print_server']:
            return False
        
        # Check availability exclusions
        if not member.is_available_for_period(period_str):
            return False
        
        return True
    
    def _calculate_priority_score(self, member: QueueMember, target_period: str) -> float:
        """
        Calculate priority score for a member based on multiple factors
        
        Higher score = higher priority for assignment
        """
        base_score = 100.0
        
        # Factor 1: Time since last assignment (20 points per month)
        if member.last_assigned_period:
            months_gap = self._calculate_months_gap(
                member.last_assigned_period, target_period
            )
            base_score += months_gap * 20
        else:
            # Never assigned - high bonus
            base_score += 200
        
        # Factor 2: Assignment balance (30 points per assignment difference)
        avg_assignments = self.queue.queue_members.filter(
            is_active=True
        ).aggregate(avg_count=Avg('total_assignments'))['avg_count'] or 0
        
        assignment_difference = avg_assignments - member.total_assignments
        base_score += assignment_difference * 30
        
        # Factor 3: Completion rate (max 10 points for 100% completion)
        base_score += member.completion_rate * 0.1
        
        # Factor 4: Random factor to avoid identical ordering
        base_score += random.random() * self.queue.random_factor * 20
        
        return max(0, base_score)
    
    def _calculate_months_gap(self, period1: str, period2: str) -> int:
        """Calculate months between two period strings (YYYY-MM format)"""
        try:
            year1, month1 = map(int, period1.split('-'))
            year2, month2 = map(int, period2.split('-'))
            return (year2 - year1) * 12 + (month2 - month1)
        except (ValueError, AttributeError):
            return 0


class TaskGenerationService:
    """Service for generating periodic task instances"""
    
    @classmethod
    def generate_tasks_for_periods(
        cls, 
        template: TaskTemplate, 
        periods: List[str]
    ) -> List[PeriodicTaskInstance]:
        """Generate task instances for multiple periods"""
        generated_tasks = []
        
        with transaction.atomic():
            for period in periods:
                if template.should_generate_for_period(period):
                    task = cls._create_task_instance(template, period)
                    generated_tasks.append(task)
        
        return generated_tasks
    
    @classmethod
    def batch_generate_tasks(
        cls, 
        periods: List[str], 
        template_ids: Optional[List[int]] = None
    ) -> Dict[str, List[PeriodicTaskInstance]]:
        """Batch generate tasks for multiple templates and periods"""
        
        # Get templates to process
        templates = TaskTemplate.objects.filter(is_active=True)
        if template_ids:
            templates = templates.filter(id__in=template_ids)
        
        results = {}
        
        with transaction.atomic():
            for template in templates:
                tasks = []
                for period in periods:
                    if template.should_generate_for_period(period):
                        task = cls._create_task_instance(template, period)
                        tasks.append(task)
                
                if tasks:
                    results[f"{template.name} ({template.id})"] = tasks
        
        return results
    
    @classmethod
    def _create_task_instance(
        cls, 
        template: TaskTemplate, 
        period: str
    ) -> PeriodicTaskInstance:
        """Create a single task instance from template"""
        
        # Check if task already exists for this period
        existing = PeriodicTaskInstance.objects.filter(
            template=template,
            scheduled_period=period
        ).first()
        
        if existing:
            return existing
        
        # Calculate execution window
        start_date, end_date = template.get_execution_window(period)
        
        # Create task instance
        task_instance = PeriodicTaskInstance.objects.create(
            template=template,
            template_name=template.name,
            scheduled_period=period,
            execution_start_date=start_date,
            execution_end_date=end_date,
            status='scheduled'
        )
        
        # Assign users using rotation algorithm
        try:
            rotation_queue = template.rotation_queue
            algorithm = TaskFairRotationAlgorithm(rotation_queue)
            assigned_users = algorithm.assign_users_for_period(period)
            
            # Store assignment data
            task_instance.current_assignees = [user.id for user in assigned_users]
            task_instance.original_assignees = task_instance.current_assignees.copy()
            
            # Set assignment metadata
            assignment_metadata = {
                'assigned_at': timezone.now().isoformat(),
                'assignment_method': 'fair_rotation',
                'primary_assignee': assigned_users[0].id if assigned_users else None,
                'roles': {
                    str(user.id): 'primary' if i == 0 else 'assistant'
                    for i, user in enumerate(assigned_users)
                }
            }
            task_instance.assignment_metadata = assignment_metadata
            task_instance.save()
            
        except Exception as e:
            # Log error but don't fail task creation
            print(f"Warning: Could not auto-assign users for task {task_instance}: {e}")
        
        return task_instance


class TaskSwapService:
    """Service for handling periodic task swap requests"""
    
    @classmethod
    def create_direct_swap_request(
        cls,
        from_user: User,
        to_user: User,
        task_instance: PeriodicTaskInstance,
        reason: str
    ) -> TaskSwapRequest:
        """Create a direct swap request between two users"""
        
        # Validate users are eligible
        if from_user.id not in task_instance.current_assignees:
            raise ValueError("From user is not assigned to this task")
        
        # Check if to_user is available for the task period
        if not cls._is_user_available_for_period(to_user, task_instance.scheduled_period):
            raise ValueError("Target user is not available for this period")
        
        swap_request = TaskSwapRequest.objects.create(
            task_instance=task_instance,
            request_type='swap',
            from_user=from_user,
            to_user=to_user,
            reason=reason
        )
        
        return swap_request
    
    @classmethod
    def create_pool_request(
        cls,
        from_user: User,
        task_instance: PeriodicTaskInstance,
        reason: str
    ) -> TaskSwapRequest:
        """Create a request published to the swap pool"""
        
        if from_user.id not in task_instance.current_assignees:
            raise ValueError("User is not assigned to this task")
        
        swap_request = TaskSwapRequest.objects.create(
            task_instance=task_instance,
            request_type='transfer',
            from_user=from_user,
            reason=reason,
            is_public_pool=True,
            pool_published_at=timezone.now()
        )
        
        return swap_request
    
    @classmethod
    def approve_swap_request(
        cls,
        request: TaskSwapRequest,
        approver: User,
        approval_type: str = 'admin'
    ) -> bool:
        """Approve a swap request"""
        
        with transaction.atomic():
            if approval_type == 'target_user':
                request.approve_by_target_user()
            elif approval_type == 'admin':
                request.approve_by_admin(approver)
            else:
                raise ValueError("Invalid approval type")
            
            # If request is fully approved, execute the swap
            if request.status == 'approved':
                cls._execute_swap(request)
                return True
        
        return False
    
    @classmethod
    def claim_from_pool(
        cls,
        request: TaskSwapRequest,
        claiming_user: User
    ) -> TaskSwapRequest:
        """Claim a request from the public swap pool"""
        
        if not request.is_public_pool:
            raise ValueError("Request is not in public pool")
        
        if not cls._is_user_available_for_period(
            claiming_user, 
            request.task_instance.scheduled_period
        ):
            raise ValueError("Claiming user is not available for this period")
        
        request.claim_from_pool(claiming_user)
        return request
    
    @classmethod
    def _execute_swap(cls, request: TaskSwapRequest):
        """Execute an approved swap request"""
        task = request.task_instance
        
        with transaction.atomic():
            # Update assignees
            current_assignees = list(task.current_assignees)
            
            if request.from_user.id in current_assignees:
                current_assignees.remove(request.from_user.id)
            
            if request.to_user and request.to_user.id not in current_assignees:
                current_assignees.append(request.to_user.id)
            
            task.current_assignees = current_assignees
            
            # Update metadata
            metadata = task.assignment_metadata or {}
            swap_record = {
                'type': request.request_type,
                'from_user_id': request.from_user.id,
                'to_user_id': request.to_user.id if request.to_user else None,
                'executed_at': timezone.now().isoformat(),
                'request_id': request.id
            }
            
            if 'swap_history' not in metadata:
                metadata['swap_history'] = []
            metadata['swap_history'].append(swap_record)
            
            task.assignment_metadata = metadata
            task.save()
    
    @classmethod
    def _is_user_available_for_period(cls, user: User, period: str) -> bool:
        """Check if user is available for the given period"""
        # This could be enhanced with availability tracking
        # For now, just check they're not admin or print_server
        return user.username not in ['admin', 'print_server']


class TaskCompletionService:
    """Service for handling periodic task completion"""
    
    @classmethod
    def mark_task_completed(
        cls,
        task_instance: PeriodicTaskInstance,
        completed_by: User,
        completion_notes: Optional[str] = None,
        completion_duration: Optional[int] = None,
        completion_photos: Optional[List[str]] = None,
        completion_rating: Optional[int] = None
    ) -> PeriodicTaskInstance:
        """Mark a task as completed"""
        
        if not task_instance.can_be_completed_by(completed_by):
            raise ValueError("User is not authorized to complete this task")
        
        with transaction.atomic():
            old_status = task_instance.status
            
            # Update task completion
            task_instance.mark_completed(
                user=completed_by,
                completion_notes=completion_notes,
                completion_duration=completion_duration,
                completion_photos=completion_photos or [],
                completion_rating=completion_rating
            )
            
            # Record status change
            task_instance.add_status_change(
                from_status=old_status,
                to_status='completed',
                changed_by=completed_by,
                reason="Task marked as completed"
            )
            
            # Update queue member statistics
            cls._update_completion_statistics(task_instance, completed_by)
        
        return task_instance
    
    @classmethod
    def _update_completion_statistics(
        cls,
        task_instance: PeriodicTaskInstance,
        completed_by: User
    ):
        """Update completion statistics for queue members"""
        try:
            rotation_queue = task_instance.template.rotation_queue
            queue_member = rotation_queue.queue_members.filter(user=completed_by).first()
            
            if queue_member:
                completion_time_hours = None
                if task_instance.completion_duration:
                    completion_time_hours = task_instance.completion_duration / 60.0
                
                queue_member.update_completion_stats(completion_time_hours)
        
        except Exception as e:
            # Log but don't fail the completion
            print(f"Warning: Could not update completion stats: {e}")


class TaskNotificationService:
    """Service for handling task notifications"""
    
    @classmethod
    def send_assignment_notifications(cls, task_instance: PeriodicTaskInstance):
        """Send notifications for new task assignments"""
        assignees = task_instance.get_assignees()
        
        if not assignees:
            return
        
        # Create notification record
        notification = NotificationRecord.objects.create(
            task_instance=task_instance,
            notification_type='assignment',
            channel='email',
            sent_to_users=[user.id for user in assignees],
            content_summary=f"Task assignment notification for {task_instance.template_name}"
        )
        
        # Send actual notifications (would integrate with email service)
        # This would be handled by email templates you create manually
        notification.email_sent = True
        notification.save()
    
    @classmethod
    def send_reminder_notifications(cls, days_before: int = 1):
        """Send reminder notifications for upcoming tasks"""
        reminder_date = date.today() + timedelta(days=days_before)
        
        upcoming_tasks = PeriodicTaskInstance.objects.filter(
            status__in=['scheduled', 'pending'],
            execution_start_date=reminder_date
        )
        
        for task in upcoming_tasks:
            cls._send_reminder_notification(task)
    
    @classmethod
    def send_overdue_notifications(cls):
        """Send notifications for overdue tasks"""
        overdue_tasks = PeriodicTaskInstance.objects.filter(
            status__in=['scheduled', 'pending', 'in_progress'],
            execution_end_date__lt=date.today()
        )
        
        for task in overdue_tasks:
            if task.status != 'overdue':
                task.status = 'overdue'
                task.save()
            
            cls._send_overdue_notification(task)
    
    @classmethod
    def _send_reminder_notification(cls, task_instance: PeriodicTaskInstance):
        """Send reminder notification for a specific task"""
        NotificationRecord.objects.create(
            task_instance=task_instance,
            notification_type='reminder',
            channel='email',
            sent_to_users=task_instance.current_assignees,
            content_summary=f"Reminder for {task_instance.template_name}"
        )
    
    @classmethod
    def _send_overdue_notification(cls, task_instance: PeriodicTaskInstance):
        """Send overdue notification for a specific task"""
        NotificationRecord.objects.create(
            task_instance=task_instance,
            notification_type='overdue',
            channel='email',
            sent_to_users=task_instance.current_assignees,
            content_summary=f"Overdue notice for {task_instance.template_name}"
        )


class TaskRotationManagementService:
    """Service for managing task rotation queues"""
    
    @classmethod
    def initialize_rotation_queue(
        cls, 
        template: TaskTemplate, 
        users: List[User]
    ) -> TaskRotationQueue:
        """Initialize rotation queue for a task template"""
        
        # Create or get rotation queue
        rotation_queue, created = TaskRotationQueue.objects.get_or_create(
            template=template,
            defaults={
                'algorithm': 'fair_rotation',
                'min_gap_months': 1,
                'consider_workload': True,
                'random_factor': 0.1
            }
        )
        
        # Add queue members
        for user in users:
            if user.username not in ['admin', 'print_server']:
                QueueMember.objects.get_or_create(
                    rotation_queue=rotation_queue,
                    user=user,
                    defaults={
                        'is_active': True,
                        'availability_data': {}
                    }
                )
        
        return rotation_queue
    
    @classmethod
    def add_user_to_queue(
        cls,
        rotation_queue: TaskRotationQueue,
        user: User
    ) -> QueueMember:
        """Add a user to a rotation queue"""
        
        member, created = QueueMember.objects.get_or_create(
            rotation_queue=rotation_queue,
            user=user,
            defaults={
                'is_active': True,
                'availability_data': {}
            }
        )
        
        if not created and not member.is_active:
            member.is_active = True
            member.save()
        
        return member
    
    @classmethod
    def remove_user_from_queue(
        cls,
        rotation_queue: TaskRotationQueue,
        user: User
    ) -> bool:
        """Remove a user from a rotation queue"""
        
        try:
            member = rotation_queue.queue_members.get(user=user)
            member.is_active = False
            member.save()
            return True
        except QueueMember.DoesNotExist:
            return False
    
    @classmethod
    def set_user_availability(
        cls,
        user: User,
        template: TaskTemplate,
        unavailable_periods: List[str]
    ):
        """Set user availability for specific periods"""
        
        try:
            queue_member = template.rotation_queue.queue_members.get(user=user)
            queue_member.set_unavailable_periods(unavailable_periods)
        except (QueueMember.DoesNotExist, AttributeError):
            # User not in queue or queue doesn't exist
            pass


# ===============================================
# System Initialization Functions
# ===============================================

def initialize_system_task_templates():
    """Initialize system default task templates"""
    
    system_templates = [
        {
            'name': 'Cell Culture Room Monthly Cleaning',
            'description': 'Comprehensive cleaning of cell culture room including benches, floors, and walls',
            'frequency': 'monthly',
            'interval': 1,
            'default_people': 2,
            'estimated_hours': 2.0,
            'fixed_start_day': 25,
            'fixed_end_day': 31,
            'priority': 'high'
        },
        {
            'name': 'Cell Culture Incubator Quarterly Cleaning',
            'description': 'Deep cleaning and disinfection of cell culture incubators',
            'frequency': 'quarterly',
            'interval': 1,
            'default_people': 1,
            'estimated_hours': 3.0,
            'fixed_start_day': 25,
            'fixed_end_day': 31,
            'priority': 'high'
        },
        {
            'name': 'Biosafety Cabinet Monthly Maintenance',
            'description': 'Monthly maintenance and cleaning of biosafety cabinets',
            'frequency': 'monthly',
            'interval': 1,
            'default_people': 1,
            'estimated_hours': 1.5,
            'fixed_start_day': 20,
            'fixed_end_day': 25,
            'priority': 'medium'
        }
    ]
    
    # Get or create admin user for system templates
    admin_user = User.objects.filter(username='admin').first()
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True).first()
    
    if not admin_user:
        print("Warning: No admin user found for creating system templates")
        return
    
    created_templates = []
    
    for template_data in system_templates:
        # Create template if it doesn't exist
        template, created = TaskTemplate.objects.get_or_create(
            name=template_data['name'],
            category='system',
            defaults={
                'description': template_data['description'],
                'task_type': 'recurring',
                'frequency': template_data['frequency'],
                'interval': template_data['interval'],
                'start_date': date.today().replace(day=1),
                'min_people': 1,
                'max_people': template_data['default_people'] + 1,
                'default_people': template_data['default_people'],
                'estimated_hours': template_data['estimated_hours'],
                'window_type': 'fixed',
                'fixed_start_day': template_data['fixed_start_day'],
                'fixed_end_day': template_data['fixed_end_day'],
                'priority': template_data['priority'],
                'is_active': True,
                'created_by': admin_user
            }
        )
        
        if created:
            created_templates.append(template)
            print(f"Created system template: {template.name}")
            
            # Initialize rotation queue with all non-admin users
            users = User.objects.exclude(username__in=['admin', 'print_server'])
            TaskRotationManagementService.initialize_rotation_queue(template, users)
    
    return created_templates


# ===============================================
# Email Template Requirements Documentation
# ===============================================

PERIODIC_TASK_EMAIL_TEMPLATES = {
    'task_assignment_notification': {
        'subject': 'New Task Assignment: {task_name}',
        'recipients': ['assignees'],
        'variables': [
            'assignee_name', 'task_name', 'scheduled_period', 
            'execution_window_start', 'execution_window_end',
            'partner_names', 'estimated_hours', 'task_description'
        ],
        'trigger': 'When task is assigned to users'
    },
    'task_reminder_notification': {
        'subject': 'Task Reminder: {task_name} starts tomorrow',
        'recipients': ['assignees'],
        'variables': [
            'assignee_name', 'task_name', 'execution_window_start',
            'partner_names', 'days_remaining'
        ],
        'trigger': 'T-1 day before execution window starts'
    },
    'task_overdue_notification': {
        'subject': 'OVERDUE: Task {task_name}',
        'recipients': ['assignees', 'admin'],
        'variables': [
            'assignee_name', 'task_name', 'execution_window_end',
            'days_overdue', 'partner_names'
        ],
        'trigger': 'When task passes execution window end date'
    },
    'task_swap_request_notification': {
        'subject': 'Task Swap Request from {requester_name}',
        'recipients': ['target_user'],
        'variables': [
            'requester_name', 'target_user_name', 'task_name',
            'scheduled_period', 'reason', 'approval_url'
        ],
        'trigger': 'When direct swap request is created'
    },
    'task_pool_request_notification': {
        'subject': 'New Task Available in Swap Pool',
        'recipients': ['all_eligible_users'],
        'variables': [
            'requester_name', 'task_name', 'scheduled_period',
            'reason', 'claim_url'
        ],
        'trigger': 'When task is published to swap pool'
    },
    'task_swap_approved_notification': {
        'subject': 'Task Swap Approved',
        'recipients': ['both_users', 'admin'],
        'variables': [
            'requester_name', 'target_user_name', 'task_name',
            'scheduled_period'
        ],
        'trigger': 'When swap request is approved'
    },
    'task_completion_notification': {
        'subject': 'Task Completed: {task_name}',
        'recipients': ['admin'],
        'variables': [
            'completed_by_name', 'task_name', 'scheduled_period',
            'completion_date', 'completion_notes', 'completion_rating'
        ],
        'trigger': 'When task is marked as completed'
    },
    'batch_task_generation_notification': {
        'subject': 'New Tasks Generated for {period_range}',
        'recipients': ['admin'],
        'variables': [
            'period_range', 'total_tasks_generated', 
            'task_summaries', 'generation_date'
        ],
        'trigger': 'After batch task generation'
    }
}

MEETING_EMAIL_TEMPLATES = {
    'journal_club_submission_reminder': {
        'subject': 'Journal Club Paper Submission - {days} Days Remaining',
        'recipients': ['presenter'],
        'variables': [
            'presenter_name', 'meeting_date', 'days_remaining', 
            'submission_deadline', 'meeting_type'
        ],
        'trigger': 'T-7, T-6, T-5, T-4 days before meeting'
    },
    'journal_club_final_reminder': {
        'subject': 'URGENT: Journal Club Paper - Final Reminder',
        'recipients': ['presenter', 'admin'],
        'variables': [
            'presenter_name', 'meeting_date', 'days_remaining',
            'final_deadline'
        ],
        'trigger': 'T-3 days before meeting if not submitted'
    },
    'journal_club_paper_distribution': {
        'subject': 'Journal Club Paper for {meeting_date}',
        'recipients': ['all_members'],
        'variables': [
            'presenter_name', 'meeting_date', 'paper_title',
            'paper_url', 'meeting_location'
        ],
        'trigger': 'T-2 days before meeting when paper submitted',
        'attachments': ['paper_file']
    },
    'research_update_reminder': {
        'subject': 'Research Update - 3 Day Reminder',
        'recipients': ['presenters'],
        'variables': [
            'presenter_names', 'meeting_date', 'meeting_location', 'topics'
        ],
        'trigger': 'T-3 days before Research Update meeting'
    },
    'meeting_reminder_24h': {
        'subject': '{meeting_type} Tomorrow - {meeting_date}',
        'recipients': ['all_members'],
        'variables': [
            'meeting_type', 'meeting_date', 'meeting_time', 
            'meeting_location', 'presenter_names', 'agenda'
        ],
        'trigger': 'T-1 day before any meeting'
    },
    'presenter_assignment': {
        'subject': 'You have been assigned to present at {meeting_type}',
        'recipients': ['presenter'],
        'variables': [
            'presenter_name', 'meeting_date', 'meeting_type',
            'meeting_location', 'preparation_guidelines'
        ],
        'trigger': 'When presenter is assigned to a meeting'
    },
    'swap_request_notification': {
        'subject': 'Presentation Swap Request from {requester_name}',
        'recipients': ['target_user'],
        'variables': [
            'requester_name', 'original_date', 'target_date',
            'reason', 'meeting_type', 'approval_url'
        ],
        'trigger': 'When meeting swap request is created'
    },
    'postpone_request_notification': {
        'subject': 'Presentation Postponement Request from {requester_name}',
        'recipients': ['admin'],
        'variables': [
            'requester_name', 'original_date', 'meeting_type',
            'reason', 'cascade_effect', 'approval_url'
        ],
        'trigger': 'When meeting postpone request is created'
    }
}