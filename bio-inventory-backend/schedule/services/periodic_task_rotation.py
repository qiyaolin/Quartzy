"""
Fair Rotation Service for Periodic Task Management
Implements intelligent task assignment with fairness scoring
"""
from datetime import date, timedelta
from typing import List, Dict, Optional
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Avg, Count, Q
import random

from ..models import TaskRotationQueue, QueueMember, PeriodicTaskInstance


class FairRotationService:
    """Service for fair rotation of periodic task assignments"""
    
    def __init__(self):
        self.default_min_gap_months = 2
        self.default_random_factor = 0.1
        self.default_workload_weight = 0.3
    
    def get_next_assignees(
        self,
        queue: TaskRotationQueue,
        target_date: date,
        required_count: int = 1
    ) -> List[User]:
        """
        Get the next assignees for a task based on fair rotation algorithm
        
        Args:
            queue: The rotation queue to select from
            target_date: Target date for the assignment
            required_count: Number of assignees needed
            
        Returns:
            List of User objects to assign to the task
        """
        # Get all active members
        active_members = queue.queue_members.filter(is_active=True)
        
        if not active_members.exists():
            return []
        
        # Calculate priority scores for all members
        scored_members = []
        for member in active_members:
            score = self._calculate_member_priority(member, target_date)
            if score > 0:  # Only consider eligible members
                scored_members.append((member.user, score))
        
        if not scored_members:
            # Fallback: select randomly from active members
            all_users = [member.user for member in active_members]
            return random.sample(all_users, min(required_count, len(all_users)))
        
        # Sort by priority score (highest first)
        scored_members.sort(key=lambda x: x[1], reverse=True)
        
        # Apply random factor if configured
        if queue.random_factor > 0:
            scored_members = self._apply_random_factor(scored_members, queue.random_factor)
        
        # Select top members, avoiding conflicts
        selected_users = []
        selected_members = []
        
        for user, score in scored_members:
            if len(selected_users) >= required_count:
                break
            
            # Check if this user can be selected with already selected users
            if self._can_be_selected_together(user, selected_users, target_date):
                selected_users.append(user)
                # Find the corresponding member for later statistics update
                member = next(m for m in active_members if m.user == user)
                selected_members.append(member)
        
        # If we couldn't fill all positions due to conflicts, fill remaining randomly
        if len(selected_users) < required_count:
            remaining_count = required_count - len(selected_users)
            remaining_users = [user for user, _ in scored_members if user not in selected_users]
            
            if remaining_users:
                additional_users = random.sample(
                    remaining_users, 
                    min(remaining_count, len(remaining_users))
                )
                selected_users.extend(additional_users)
        
        return selected_users
    
    def _calculate_member_priority(self, member: QueueMember, target_date: date) -> float:
        """
        Calculate priority score for a queue member
        Higher score = higher priority for assignment
        """
        base_score = 100.0
        
        # Factor 1: Time since last assignment
        if member.last_assigned_period:
            # Parse period (YYYY-MM) to compare with target date
            try:
                last_year, last_month = map(int, member.last_assigned_period.split('-'))
                last_period_date = date(last_year, last_month, 1)
                
                # Calculate months gap
                months_gap = (target_date.year - last_period_date.year) * 12 + (target_date.month - last_period_date.month)
                
                # Minimum gap enforcement
                if months_gap < member.queue.min_gap_months:
                    return -1000.0  # Ineligible
                
                # Award points for longer gaps
                base_score += months_gap * 20
            except (ValueError, AttributeError):
                # Handle invalid period format
                pass
        else:
            # Never assigned before - high priority
            base_score += 200.0
        
        # Factor 2: Workload balance
        if member.queue.consider_workload:
            workload_adjustment = self._calculate_workload_adjustment(member, target_date)
            base_score += workload_adjustment
        
        # Factor 3: Completion rate bonus
        if member.completion_rate > 0:
            completion_bonus = (member.completion_rate - 0.8) * 50  # Bonus for >80% completion rate
            base_score += completion_bonus
        
        # Factor 4: Speed bonus (faster completion gets slight priority)
        if member.average_completion_time > 0:
            # Get average completion time for all members in queue
            queue_avg = member.queue.queue_members.filter(
                average_completion_time__gt=0
            ).aggregate(avg_time=Avg('average_completion_time'))['avg_time'] or 0
            
            if queue_avg > 0:
                # Bonus for being faster than average
                speed_factor = max(-20, min(20, (queue_avg - member.average_completion_time) / 60))  # Convert to hours
                base_score += speed_factor
        
        # Factor 5: Fairness adjustment based on total assignments
        fairness_adjustment = self._calculate_fairness_adjustment(member)
        base_score += fairness_adjustment
        
        # Factor 6: Availability data (if provided)
        availability_adjustment = self._calculate_availability_adjustment(member, target_date)
        base_score += availability_adjustment
        
        return max(0.0, base_score)
    
    def _calculate_workload_adjustment(self, member: QueueMember, target_date: date) -> float:
        """Calculate adjustment based on current workload"""
        # Count current active assignments for this user
        current_active = PeriodicTaskInstance.objects.filter(
            Q(current_assignees__contains=[member.user.id]) |
            Q(original_assignees__contains=[member.user.id]),
            status__in=['scheduled', 'in_progress'],
            execution_end_date__gte=target_date
        ).count()
        
        # Get average active assignments across all users
        all_members = member.queue.queue_members.filter(is_active=True)
        total_active = 0
        
        for other_member in all_members:
            other_active = PeriodicTaskInstance.objects.filter(
                Q(current_assignees__contains=[other_member.user.id]) |
                Q(original_assignees__contains=[other_member.user.id]),
                status__in=['scheduled', 'in_progress'],
                execution_end_date__gte=target_date
            ).count()
            total_active += other_active
        
        if all_members.count() > 0:
            avg_active = total_active / all_members.count()
            # Penalty for having more than average, bonus for having less
            workload_adjustment = (avg_active - current_active) * 30
            return workload_adjustment
        
        return 0.0
    
    def _calculate_fairness_adjustment(self, member: QueueMember) -> float:
        """Calculate adjustment based on overall fairness in assignment distribution"""
        # Get all members in the same queue
        all_members = member.queue.queue_members.filter(is_active=True)
        
        if all_members.count() <= 1:
            return 0.0
        
        # Calculate average assignments per person
        total_assignments = sum(m.total_assignments for m in all_members)
        avg_assignments = total_assignments / all_members.count()
        
        # Adjustment: positive if below average, negative if above
        fairness_adjustment = (avg_assignments - member.total_assignments) * 25
        
        return fairness_adjustment
    
    def _calculate_availability_adjustment(self, member: QueueMember, target_date: date) -> float:
        """Calculate adjustment based on availability data"""
        if not member.availability_data:
            return 0.0
        
        # Check if member has marked themselves unavailable for this period
        period_key = target_date.strftime('%Y-%m')
        
        # Check various availability indicators
        adjustments = 0.0
        
        # Monthly availability
        if 'monthly_unavailable' in member.availability_data:
            if period_key in member.availability_data['monthly_unavailable']:
                return -500.0  # Strong penalty for marked unavailable
        
        # Preference scoring
        if 'monthly_preference' in member.availability_data:
            preference = member.availability_data['monthly_preference'].get(period_key, 'neutral')
            if preference == 'preferred':
                adjustments += 50.0
            elif preference == 'avoid':
                adjustments -= 100.0
        
        # Work schedule considerations
        if 'work_schedule' in member.availability_data:
            # This could include sabbaticals, travel, etc.
            schedule = member.availability_data['work_schedule']
            # Implementation depends on specific schedule format
        
        return adjustments
    
    def _apply_random_factor(self, scored_members: List[tuple], random_factor: float) -> List[tuple]:
        """Apply random factor to scores to prevent completely predictable assignments"""
        if random_factor <= 0:
            return scored_members
        
        # Apply random adjustment to each score
        randomized_members = []
        for user, score in scored_members:
            # Random factor affects score by up to ±(random_factor * 100) points
            random_adjustment = (random.random() - 0.5) * 2 * random_factor * 100
            adjusted_score = score + random_adjustment
            randomized_members.append((user, adjusted_score))
        
        # Re-sort by adjusted scores
        randomized_members.sort(key=lambda x: x[1], reverse=True)
        return randomized_members
    
    def _can_be_selected_together(
        self, 
        candidate: User, 
        already_selected: List[User], 
        target_date: date
    ) -> bool:
        """Check if candidate can be selected along with already selected users"""
        
        # For now, allow any combination
        # In the future, this could check for:
        # - Department conflicts
        # - Skill set requirements
        # - Previous collaboration patterns
        
        return True
    
    def _recalculate_queue_priorities(self, queue: TaskRotationQueue) -> Dict[str, int]:
        """Recalculate priority scores for all members in a queue"""
        members = queue.queue_members.filter(is_active=True)
        today = date.today()
        
        updated_count = 0
        for member in members:
            old_priority = member.priority_score
            new_priority = self._calculate_member_priority(member, today)
            
            if abs(old_priority - new_priority) > 0.1:  # Only update if significant change
                member.priority_score = new_priority
                member.save(update_fields=['priority_score'])
                updated_count += 1
        
        # Update queue timestamp
        queue.last_updated = timezone.now()
        queue.save(update_fields=['last_updated'])
        
        return {
            'total_members': members.count(),
            'updated_members': updated_count
        }
    
    def get_assignment_preview(
        self,
        queue: TaskRotationQueue,
        periods: List[str],
        required_count: int = 1
    ) -> List[Dict]:
        """
        Get a preview of assignments for multiple periods without creating tasks
        
        Args:
            queue: The rotation queue to use
            periods: List of periods in YYYY-MM format
            required_count: Number of assignees needed per period
            
        Returns:
            List of dictionaries with assignment previews
        """
        previews = []
        
        # Track tentative assignments to avoid conflicts
        tentative_assignments = {}  # period -> list of user_ids
        
        for period in periods:
            try:
                # Parse period to date
                year, month = map(int, period.split('-'))
                target_date = date(year, month, 1)
            except ValueError:
                continue
            
            # Get available assignees considering previous tentative assignments
            available_assignees = self._get_available_assignees_for_period(
                queue, target_date, tentative_assignments
            )
            
            # Select assignees
            selected_assignees = available_assignees[:required_count]
            
            # Record tentative assignment
            tentative_assignments[period] = [user.id for user in selected_assignees]
            
            # Create preview
            preview = {
                'period': period,
                'target_date': target_date,
                'assignees_needed': required_count,
                'suggested_assignees': [
                    {
                        'user_id': user.id,
                        'username': user.username,
                        'full_name': user.get_full_name() or user.username,
                        'total_assignments': self._get_user_total_assignments(user, queue),
                        'last_assigned_period': self._get_user_last_assigned_period(user, queue),
                        'completion_rate': self._get_user_completion_rate(user, queue)
                    }
                    for user in selected_assignees
                ],
                'confidence_score': self._calculate_assignment_confidence(selected_assignees, queue, target_date)
            }
            
            previews.append(preview)
        
        return previews
    
    def _get_available_assignees_for_period(
        self,
        queue: TaskRotationQueue,
        target_date: date,
        tentative_assignments: Dict[str, List[int]]
    ) -> List[User]:
        """Get available assignees for a period considering tentative assignments"""
        
        active_members = queue.queue_members.filter(is_active=True)
        
        # Calculate scores considering tentative assignments
        scored_members = []
        for member in active_members:
            # Check if user is recently tentatively assigned
            if self._is_user_recently_tentatively_assigned(
                member.user.id, target_date, tentative_assignments
            ):
                continue
            
            score = self._calculate_member_priority(member, target_date)
            if score > 0:
                scored_members.append((member.user, score))
        
        # Sort by score
        scored_members.sort(key=lambda x: x[1], reverse=True)
        
        return [user for user, score in scored_members]
    
    def _is_user_recently_tentatively_assigned(
        self,
        user_id: int,
        target_date: date,
        tentative_assignments: Dict[str, List[int]]
    ) -> bool:
        """Check if user is assigned in recent tentative assignments"""
        # Check assignments in the past few months
        check_months = 3
        
        for period_str, assigned_users in tentative_assignments.items():
            try:
                year, month = map(int, period_str.split('-'))
                assign_date = date(year, month, 1)
                
                # Calculate month difference
                months_diff = (target_date.year - assign_date.year) * 12 + (target_date.month - assign_date.month)
                
                if 0 < months_diff <= check_months:
                    if user_id in assigned_users:
                        return True
            except ValueError:
                continue
        
        return False
    
    def _get_user_total_assignments(self, user: User, queue: TaskRotationQueue) -> int:
        """Get user's total assignments for this queue"""
        member = queue.queue_members.filter(user=user).first()
        return member.total_assignments if member else 0
    
    def _get_user_last_assigned_period(self, user: User, queue: TaskRotationQueue) -> Optional[str]:
        """Get user's last assigned period for this queue"""
        member = queue.queue_members.filter(user=user).first()
        return member.last_assigned_period if member else None
    
    def _get_user_completion_rate(self, user: User, queue: TaskRotationQueue) -> float:
        """Get user's completion rate for this queue"""
        member = queue.queue_members.filter(user=user).first()
        return member.completion_rate if member else 0.0
    
    def _calculate_assignment_confidence(
        self,
        selected_assignees: List[User],
        queue: TaskRotationQueue,
        target_date: date
    ) -> float:
        """Calculate confidence score for the assignment suggestion"""
        if not selected_assignees:
            return 0.0
        
        total_confidence = 0.0
        
        for user in selected_assignees:
            member = queue.queue_members.filter(user=user).first()
            if not member:
                continue
            
            user_confidence = 0.0
            
            # Factor 1: Time since last assignment (30% weight)
            if member.last_assigned_period:
                try:
                    last_year, last_month = map(int, member.last_assigned_period.split('-'))
                    last_date = date(last_year, last_month, 1)
                    months_since = (target_date.year - last_date.year) * 12 + (target_date.month - last_date.month)
                    gap_confidence = min(months_since / 12.0, 1.0)  # Normalized to max 1 year gap
                except (ValueError, AttributeError):
                    gap_confidence = 1.0  # Never assigned
            else:
                gap_confidence = 1.0  # Never assigned
            
            user_confidence += gap_confidence * 0.3
            
            # Factor 2: Completion rate (40% weight)
            completion_confidence = member.completion_rate
            user_confidence += completion_confidence * 0.4
            
            # Factor 3: Fairness in total assignments (30% weight)
            all_members = queue.queue_members.filter(is_active=True)
            if all_members.count() > 1:
                avg_assignments = sum(m.total_assignments for m in all_members) / all_members.count()
                if avg_assignments > 0:
                    # Higher confidence for users with fewer assignments
                    fairness_confidence = max(0.0, 1.0 - (member.total_assignments / (avg_assignments * 2)))
                else:
                    fairness_confidence = 1.0
            else:
                fairness_confidence = 1.0
            
            user_confidence += fairness_confidence * 0.3
            
            total_confidence += user_confidence
        
        return min(1.0, total_confidence / len(selected_assignees))