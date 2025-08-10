"""
Notification Service for Periodic Task Management System
Integrates with the existing notifications app to provide task-specific alerts
"""

from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
import logging
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from django.db.models import Q

from notifications.services import NotificationService
from notifications.email_service import EmailNotificationService
from ..models import (
    PeriodicTaskInstance, TaskSwapRequest, TaskTemplate,
    QueueMember, TaskRotationQueue
)

logger = logging.getLogger(__name__)


class TaskNotificationService:
    """Extended notification service for periodic task management"""
    
    @classmethod
    def notify_task_assignment(
        cls,
        task_instance: PeriodicTaskInstance,
        assignees: List[User],
        is_new_assignment: bool = True
    ) -> List:
        """
        Notify users about task assignments
        
        Args:
            task_instance: The task instance being assigned
            assignees: List of assigned users
            is_new_assignment: Whether this is a new assignment or update
            
        Returns:
            List of created notification instances
        """
        action = "assigned" if is_new_assignment else "updated"
        
        # Create individual notifications for each assignee
        notifications = []
        
        for user in assignees:
            # Determine if user is primary assignee
            is_primary = task_instance.get_primary_assignee() == user
            role = "primary assignee" if is_primary else "assistant"
            
            title = f"Task {action.title()}: {task_instance.template_name}"
            
            message = (
                f"You have been {action} as {role} for the task '{task_instance.template_name}' "
                f"scheduled for {task_instance.scheduled_period}. "
                f"Execution window: {task_instance.execution_start_date} to {task_instance.execution_end_date}."
            )
            
            # Add estimated hours if available
            if task_instance.template.estimated_hours:
                message += f" Estimated time: {task_instance.template.estimated_hours} hours."
            
            notification = NotificationService.create_notification(
                recipient=user,
                title=title,
                message=message,
                notification_type='info' if is_new_assignment else 'warning',
                priority='medium',
                related_object=task_instance,
                action_url=f'/schedule/my-tasks/?task_id={task_instance.id}',
                metadata={
                    'task_id': task_instance.id,
                    'task_period': task_instance.scheduled_period,
                    'role': role,
                    'action': action
                },
                expires_in_hours=720  # 30 days
            )
            
            notifications.append(notification)
        
        # Send email notifications if user preferences allow
        try:
            # Send email (simplified policy for now): always email assignees
            email_context = {
                'task': task_instance,
                'recipient': user,
                'role': role,
                'action_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/my-tasks?task_id={task_instance.id}",
            }
            EmailNotificationService.send_email_notification(
                recipients=[user],
                subject=f"Task {action.title()}: {task_instance.template_name}",
                template_name='task_assignment',
                context=email_context
            )
        except Exception as e:
            logger.warning(f"Failed to send email notification to {user.username}: {str(e)}")
        
        logger.info(
            f"Created {len(notifications)} task assignment notifications "
            f"for task {task_instance.id}"
        )
        
        return notifications
    
    @classmethod
    def notify_task_deadline_approaching(
        cls,
        overdue_tasks: List[PeriodicTaskInstance] = None,
        upcoming_tasks: List[PeriodicTaskInstance] = None,
        days_ahead: int = 7
    ) -> Dict:
        """
        Send notifications for approaching deadlines and overdue tasks
        
        Args:
            overdue_tasks: List of overdue tasks (optional, will query if not provided)
            upcoming_tasks: List of upcoming tasks (optional, will query if not provided) 
            days_ahead: How many days ahead to look for upcoming tasks
            
        Returns:
            Dictionary with counts of notifications sent
        """
        result = {'overdue_sent': 0, 'upcoming_sent': 0}
        
        # Get overdue tasks if not provided
        if overdue_tasks is None:
            overdue_tasks = PeriodicTaskInstance.objects.filter(
                status__in=['scheduled', 'pending', 'in_progress'],
                execution_end_date__lt=date.today()
            )
        
        # Get upcoming tasks if not provided
        if upcoming_tasks is None:
            upcoming_date = date.today() + timedelta(days=days_ahead)
            upcoming_tasks = PeriodicTaskInstance.objects.filter(
                status__in=['scheduled', 'pending'],
                execution_end_date__lte=upcoming_date,
                execution_end_date__gte=date.today()
            )
        
        # Send overdue notifications (CC admins as per policy)
        for task in overdue_tasks:
            assignees = task.get_assignees()
            if assignees:
                days_overdue = (date.today() - task.execution_end_date).days
                
                for user in assignees:
                    title = f"Task Overdue: {task.template_name}"
                    message = (
                        f"Your assigned task '{task.template_name}' for period {task.scheduled_period} "
                        f"was due on {task.execution_end_date} ({days_overdue} days ago). "
                        f"Please complete it as soon as possible or request assistance."
                    )
                    
                    NotificationService.create_notification(
                        recipient=user,
                        title=title,
                        message=message,
                        notification_type='error',
                        priority='high' if days_overdue < 7 else 'urgent',
                        related_object=task,
                        action_url=f'/schedule/my-tasks/?task_id={task.id}',
                        metadata={
                            'task_id': task.id,
                            'days_overdue': days_overdue,
                            'notification_type': 'task_overdue'
                        },
                        expires_in_hours=168  # 7 days
                    )
                    
                    result['overdue_sent'] += 1

                # CC admins and send overdue email copies
                try:
                    admin_users = User.objects.filter(is_staff=True, is_active=True)
                    admin_title = f"Overdue Task (CC): {task.template_name}"
                    admin_message = (
                        f"Task '{task.template_name}' for period {task.scheduled_period} is overdue "
                        f"(due {task.execution_end_date}, {days_overdue} days ago). Assignees: "
                        f"{', '.join([u.get_full_name() or u.username for u in assignees])}."
                    )
                    for admin in admin_users:
                        NotificationService.create_notification(
                            recipient=admin,
                            title=admin_title,
                            message=admin_message,
                            notification_type='warning',
                            priority='medium',
                            related_object=task,
                            action_url=f'/schedule/admin-task-dashboard/?task_id={task.id}',
                            metadata={'cc': 'admin', 'task_id': task.id}
                        )
                        # Email CC
                        try:
                            EmailNotificationService.send_email_notification(
                                recipients=[admin],
                                subject=f"OVERDUE: {task.template_name}",
                                template_name='task_overdue',
                                context={
                                    'task': task,
                                    'recipient': admin,
                                    'cc_admin': True,
                                    'action_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/admin-task-dashboard?task_id={task.id}"
                                }
                            )
                        except Exception:
                            pass
                except Exception as e:
                    logger.warning(f"Failed to CC admins for overdue task {task.id}: {e}")
        
        # Send upcoming deadline notifications (business rule: only weekdays 11am ET enforced by caller)
        for task in upcoming_tasks:
            assignees = task.get_assignees()
            if assignees:
                days_remaining = (task.execution_end_date - date.today()).days
                
                for user in assignees:
                    title = f"Task Due Soon: {task.template_name}"
                    message = (
                        f"Your assigned task '{task.template_name}' for period {task.scheduled_period} "
                        f"is due on {task.execution_end_date} ({days_remaining} days remaining). "
                        f"Please plan to complete it on time."
                    )
                    
                    # Add reminder about estimated time
                    if task.template.estimated_hours:
                        message += f" Estimated completion time: {task.template.estimated_hours} hours."
                    
                    NotificationService.create_notification(
                        recipient=user,
                        title=title,
                        message=message,
                        notification_type='warning',
                        priority='medium',
                        related_object=task,
                        action_url=f'/schedule/my-tasks/?task_id={task.id}',
                        metadata={
                            'task_id': task.id,
                            'days_remaining': days_remaining,
                            'notification_type': 'task_upcoming'
                        },
                        expires_in_hours=72  # 3 days
                    )
                    
                    result['upcoming_sent'] += 1

                # Email reminder at 11am ET is enforced by scheduler; send email now
                try:
                    from notifications.email_service import EmailNotificationService
                    for user in assignees:
                        EmailNotificationService.send_email_notification(
                            recipients=[user],
                            subject=f"Task Reminder: {task.template_name}",
                            template_name='task_reminder',
                            context={
                                'task': task,
                                'recipient': user,
                                'days_remaining': days_remaining,
                                'action_url': f"{EmailNotificationService.get_base_context()['base_url']}/schedule/my-tasks?task_id={task.id}"
                            }
                        )
                except Exception as e:
                    logger.warning(f"Failed to send reminder emails for task {task.id}: {e}")
        
        logger.info(
            f"Sent deadline notifications: {result['overdue_sent']} overdue, "
            f"{result['upcoming_sent']} upcoming"
        )
        
        return result
    
    @classmethod
    def notify_swap_request_created(
        cls,
        swap_request: TaskSwapRequest
    ) -> List:
        """
        Notify relevant users about a new swap request
        
        Args:
            swap_request: The swap request that was created
            
        Returns:
            List of created notifications
        """
        notifications = []
        task = swap_request.task_instance
        
        # Notify target user (if specific swap request)
        if swap_request.request_type == 'swap' and swap_request.to_user:
            title = f"Task Swap Request: {task.template_name}"
            message = (
                f"{swap_request.from_user.get_full_name() or swap_request.from_user.username} "
                f"has requested to swap the task '{task.template_name}' "
                f"(period: {task.scheduled_period}) with you."
            )
            
            if swap_request.reason:
                message += f" Reason: {swap_request.reason}"
            
            notification = NotificationService.create_notification(
                recipient=swap_request.to_user,
                title=title,
                message=message,
                notification_type='info',
                priority='medium',
                related_object=swap_request,
                action_url=f'/schedule/task-swaps/?request_id={swap_request.id}',
                metadata={
                    'swap_request_id': swap_request.id,
                    'task_id': task.id,
                    'request_type': swap_request.request_type,
                    'action_required': True
                },
                expires_in_hours=168  # 7 days
            )
            notifications.append(notification)
        
        # Notify admins for approval (if required)
        if (hasattr(task.template, 'rotation_queue') and 
            task.template.rotation_queue and 
            hasattr(task.template.rotation_queue, 'require_admin_approval')):
            
            admin_users = User.objects.filter(
                is_staff=True, 
                is_active=True
            ).exclude(id=swap_request.from_user.id)
            
            for admin in admin_users:
                title = f"Swap Request Approval Needed: {task.template_name}"
                message = (
                    f"A {swap_request.request_type} request has been created by "
                    f"{swap_request.from_user.get_full_name() or swap_request.from_user.username} "
                    f"for task '{task.template_name}' (period: {task.scheduled_period}). "
                    f"Admin approval is required."
                )
                
                notification = NotificationService.create_notification(
                    recipient=admin,
                    title=title,
                    message=message,
                    notification_type='warning',
                    priority='medium',
                    related_object=swap_request,
                    action_url=f'/schedule/admin-task-dashboard/?request_id={swap_request.id}',
                    metadata={
                        'swap_request_id': swap_request.id,
                        'task_id': task.id,
                        'requires_admin_approval': True
                    },
                    expires_in_hours=168  # 7 days
                )
                notifications.append(notification)
        
        # Notify all eligible members if public pool request
        if swap_request.is_public_pool:
            # Get rotation queue members who can take this task
            try:
                rotation_queue = task.template.rotation_queue
                eligible_members = rotation_queue.queue_members.filter(
                    is_active=True
                ).exclude(user=swap_request.from_user)
                
                for member in eligible_members:
                    title = f"Task Available for Claiming: {task.template_name}"
                    message = (
                        f"A task '{task.template_name}' for period {task.scheduled_period} "
                        f"is available for claiming. First come, first served!"
                    )
                    
                    if swap_request.reason:
                        message += f" Reason for swap: {swap_request.reason}"
                    
                    notification = NotificationService.create_notification(
                        recipient=member.user,
                        title=title,
                        message=message,
                        notification_type='info',
                        priority='low',
                        related_object=swap_request,
                        action_url=f'/schedule/task-swaps/?pool_request_id={swap_request.id}',
                        metadata={
                            'swap_request_id': swap_request.id,
                            'task_id': task.id,
                            'public_pool': True
                        },
                        expires_in_hours=72  # 3 days
                    )
                    notifications.append(notification)
            
            except Exception as e:
                logger.warning(f"Could not notify pool members: {str(e)}")
        
        logger.info(f"Created {len(notifications)} swap request notifications")
        
        return notifications
    
    @classmethod
    def notify_swap_request_approved(
        cls,
        swap_request: TaskSwapRequest,
        approving_user: User
    ) -> List:
        """
        Notify users when a swap request is approved
        
        Args:
            swap_request: The approved swap request
            approving_user: User who approved the request
            
        Returns:
            List of created notifications
        """
        notifications = []
        task = swap_request.task_instance
        
        # Notify the requester
        title = f"Swap Request Approved: {task.template_name}"
        message = (
            f"Your {swap_request.request_type} request for task '{task.template_name}' "
            f"(period: {task.scheduled_period}) has been approved"
        )
        
        if approving_user != swap_request.from_user:
            message += f" by {approving_user.get_full_name() or approving_user.username}"
        
        message += "."
        
        notification = NotificationService.create_notification(
            recipient=swap_request.from_user,
            title=title,
            message=message,
            notification_type='success',
            priority='medium',
            related_object=swap_request,
            action_url=f'/schedule/my-tasks/',
            metadata={
                'swap_request_id': swap_request.id,
                'task_id': task.id,
                'approved_by': approving_user.id,
                'status': 'approved'
            },
            expires_in_hours=72  # 3 days
        )
        notifications.append(notification)
        
        # Notify the new assignee (if different from requester)
        if (swap_request.to_user and 
            swap_request.to_user != swap_request.from_user):
            
            title = f"Task Assignment Confirmed: {task.template_name}"
            message = (
                f"You have been assigned to the task '{task.template_name}' "
                f"(period: {task.scheduled_period}) through an approved swap request."
            )
            
            notification = NotificationService.create_notification(
                recipient=swap_request.to_user,
                title=title,
                message=message,
                notification_type='info',
                priority='medium',
                related_object=task,
                action_url=f'/schedule/my-tasks/?task_id={task.id}',
                metadata={
                    'task_id': task.id,
                    'swap_request_id': swap_request.id,
                    'new_assignment': True
                },
                expires_in_hours=168  # 7 days
            )
            notifications.append(notification)
        
        logger.info(f"Created {len(notifications)} swap approval notifications")
        
        return notifications
    
    @classmethod
    def notify_task_completion(
        cls,
        task_instance: PeriodicTaskInstance,
        completed_by: User,
        completion_notes: str = None
    ) -> List:
        """
        Notify relevant users about task completion
        
        Args:
            task_instance: The completed task
            completed_by: User who completed the task
            completion_notes: Optional completion notes
            
        Returns:
            List of created notifications
        """
        notifications = []
        
        # Notify other assignees (if any)
        all_assignees = task_instance.get_assignees()
        other_assignees = [user for user in all_assignees if user != completed_by]
        
        for user in other_assignees:
            title = f"Task Completed: {task_instance.template_name}"
            message = (
                f"The task '{task_instance.template_name}' for period "
                f"{task_instance.scheduled_period} has been completed by "
                f"{completed_by.get_full_name() or completed_by.username}."
            )
            
            if completion_notes:
                message += f" Notes: {completion_notes}"
            
            notification = NotificationService.create_notification(
                recipient=user,
                title=title,
                message=message,
                notification_type='success',
                priority='low',
                related_object=task_instance,
                action_url=f'/schedule/my-tasks/?task_id={task_instance.id}',
                metadata={
                    'task_id': task_instance.id,
                    'completed_by': completed_by.id,
                    'completion_notes': completion_notes or ''
                },
                expires_in_hours=168  # 7 days
            )
            notifications.append(notification)
        
        # Notify admins for high-priority tasks
        if task_instance.template.priority == 'high':
            admin_users = User.objects.filter(is_staff=True, is_active=True)
            
            for admin in admin_users:
                title = f"High Priority Task Completed: {task_instance.template_name}"
                message = (
                    f"High priority task '{task_instance.template_name}' "
                    f"has been completed by {completed_by.get_full_name() or completed_by.username}."
                )
                
                notification = NotificationService.create_notification(
                    recipient=admin,
                    title=title,
                    message=message,
                    notification_type='info',
                    priority='low',
                    related_object=task_instance,
                    action_url=f'/schedule/admin-task-dashboard/?task_id={task_instance.id}',
                    metadata={
                        'task_id': task_instance.id,
                        'completed_by': completed_by.id,
                        'priority': 'high'
                    },
                    expires_in_hours=72  # 3 days
                )
                notifications.append(notification)
        
        logger.info(f"Created {len(notifications)} task completion notifications")
        
        return notifications
    
    @classmethod
    def notify_system_maintenance(
        cls,
        maintenance_type: str,
        message: str,
        scheduled_time: Optional[datetime] = None,
        recipients: Optional[List[User]] = None
    ) -> List:
        """
        Send system maintenance notifications
        
        Args:
            maintenance_type: Type of maintenance (update, downtime, etc.)
            message: Detailed message about the maintenance
            scheduled_time: When the maintenance is scheduled
            recipients: List of users to notify (defaults to all active users)
            
        Returns:
            List of created notifications
        """
        if recipients is None:
            recipients = User.objects.filter(is_active=True)
        
        title = f"System Maintenance: {maintenance_type.replace('_', ' ').title()}"
        
        if scheduled_time:
            message = f"Scheduled for {scheduled_time.strftime('%Y-%m-%d %H:%M')}. {message}"
        
        notifications = NotificationService.create_bulk_notification(
            recipients=recipients,
            title=title,
            message=message,
            notification_type='warning',
            priority='medium',
            metadata={
                'maintenance_type': maintenance_type,
                'scheduled_time': scheduled_time.isoformat() if scheduled_time else None
            },
            expires_in_hours=168  # 7 days
        )
        
        logger.info(f"Created {len(notifications)} system maintenance notifications")
        
        return notifications
    
    @classmethod
    def create_digest_summary(
        cls,
        user: User,
        period_days: int = 7
    ) -> Dict:
        """
        Create a summary for email digests
        
        Args:
            user: User to create summary for
            period_days: Number of days to look back
            
        Returns:
            Dictionary with summary information
        """
        since_date = timezone.now() - timedelta(days=period_days)
        
        # Get user's active tasks
        active_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user.id],
            status__in=['scheduled', 'pending', 'in_progress']
        )
        
        # Get completed tasks in period
        completed_tasks = PeriodicTaskInstance.objects.filter(
            current_assignees__contains=[user.id],
            status='completed',
            completed_at__gte=since_date
        )
        
        # Get overdue tasks
        overdue_tasks = active_tasks.filter(
            execution_end_date__lt=date.today()
        )
        
        # Get upcoming tasks (next 7 days)
        upcoming_date = date.today() + timedelta(days=7)
        upcoming_tasks = active_tasks.filter(
            execution_end_date__lte=upcoming_date,
            execution_end_date__gte=date.today()
        )
        
        # Get pending swap requests
        pending_swaps = TaskSwapRequest.objects.filter(
            Q(from_user=user) | Q(to_user=user),
            status='pending'
        )
        
        return {
            'period_days': period_days,
            'active_tasks': list(active_tasks.values(
                'id', 'template_name', 'scheduled_period', 
                'execution_start_date', 'execution_end_date', 'status'
            )),
            'completed_tasks': list(completed_tasks.values(
                'id', 'template_name', 'scheduled_period', 'completed_at'
            )),
            'overdue_tasks': list(overdue_tasks.values(
                'id', 'template_name', 'scheduled_period', 'execution_end_date'
            )),
            'upcoming_tasks': list(upcoming_tasks.values(
                'id', 'template_name', 'scheduled_period', 'execution_end_date'
            )),
            'pending_swaps': list(pending_swaps.values(
                'id', 'request_type', 'from_user__username', 'to_user__username',
                'task_instance__template_name', 'created_at'
            )),
            'stats': {
                'total_active': active_tasks.count(),
                'total_completed': completed_tasks.count(),
                'total_overdue': overdue_tasks.count(),
                'total_upcoming': upcoming_tasks.count(),
                'total_pending_swaps': pending_swaps.count()
            }
        }