"""
Fair Rotation Algorithm
Implements intelligent presenter rotation with fairness scoring
"""
from datetime import date, timedelta
from typing import List, Dict, Optional
from django.contrib.auth.models import User
from django.utils import timezone

from ..models import RotationSystem, QueueEntry, Presenter


class FairRotationAlgorithm:
    """Algorithm for fair presenter rotation"""
    
    def __init__(self):
        self.min_gap_weeks = 4  # Minimum weeks between presentations
        self.fairness_weight = 1.0
    
    def get_next_presenters(
        self,
        rotation_system: RotationSystem,
        meeting_date: date,
        count: int = 1
    ) -> List[User]:
        """
        Get the next presenters based on fair rotation algorithm
        """
        # Get all queue entries for this rotation system
        queue_entries = QueueEntry.objects.filter(
            rotation_system=rotation_system
        ).select_related('user')
        
        if not queue_entries.exists():
            return []
        
        # Calculate current priority scores
        scored_entries = []
        for entry in queue_entries:
            score = self.calculate_priority_score(entry, meeting_date)
            if score > 0:  # Only consider eligible entries
                scored_entries.append((entry, score))
        
        # Sort by priority score (highest first)
        scored_entries.sort(key=lambda x: x[1], reverse=True)
        
        # Select top presenters
        selected_presenters = []
        selected_entries = []
        
        for entry, score in scored_entries:
            if len(selected_presenters) >= count:
                break
            
            # Additional check to avoid consecutive presentations
            if self._can_be_selected_with_others(entry, selected_entries, meeting_date):
                selected_presenters.append(entry.user)
                selected_entries.append(entry)
        
        # Update selected entries
        for entry in selected_entries:
            entry.priority = self.calculate_priority_score(entry, meeting_date)
            entry.save()
        
        return selected_presenters
    
    def calculate_priority_score(
        self,
        entry: QueueEntry,
        target_date: date
    ) -> float:
        """
        Calculate priority score for a queue entry
        Higher score = higher priority
        """
        base_score = 100.0
        
        # Factor 1: Time since last presentation
        if entry.last_presented_date:
            days_since = (target_date - entry.last_presented_date).days
            weeks_since = days_since / 7.0
            
            # Minimum gap enforcement
            if weeks_since < self.min_gap_weeks:
                return -1000.0  # Ineligible
            
            # Award points for longer gaps
            time_bonus = weeks_since * 10.0
            base_score += time_bonus
        else:
            # Never presented before - high priority
            base_score += 200.0
        
        # Factor 2: Postponement penalty
        postpone_penalty = entry.postpone_count * 20.0
        base_score -= postpone_penalty
        
        # Factor 3: Overall fairness adjustment
        fairness_adjustment = self._calculate_fairness_adjustment(entry)
        base_score += fairness_adjustment * self.fairness_weight
        
        # Factor 4: Avoid back-to-back presentations
        if self._has_recent_presentation(entry.user, target_date):
            base_score -= 50.0
        
        # Factor 5: Balance different meeting types
        type_balance_bonus = self._calculate_type_balance_bonus(entry.user, target_date)
        base_score += type_balance_bonus
        
        return max(0.0, base_score)
    
    def _calculate_fairness_adjustment(self, entry: QueueEntry) -> float:
        """Calculate adjustment based on overall fairness"""
        # Get all entries in the same rotation system
        all_entries = QueueEntry.objects.filter(
            rotation_system=entry.rotation_system
        )
        
        if all_entries.count() <= 1:
            return 0.0
        
        # Calculate current year presentation counts
        current_year = timezone.now().year
        user_presentation_counts = {}
        
        for queue_entry in all_entries:
            count = Presenter.objects.filter(
                user=queue_entry.user,
                meeting_instance__date__year=current_year,
                status__in=['confirmed', 'completed']
            ).count()
            user_presentation_counts[queue_entry.user.id] = count
        
        # Calculate average presentations per person
        total_presentations = sum(user_presentation_counts.values())
        average_presentations = total_presentations / len(user_presentation_counts)
        
        # This user's count
        user_count = user_presentation_counts.get(entry.user.id, 0)
        
        # Adjustment: negative if above average, positive if below
        adjustment = (average_presentations - user_count) * 25.0
        
        return adjustment
    
    def _has_recent_presentation(self, user: User, target_date: date) -> bool:
        """Check if user has a presentation very recently"""
        recent_threshold = target_date - timedelta(weeks=2)
        
        recent_presentations = Presenter.objects.filter(
            user=user,
            meeting_instance__date__gte=recent_threshold,
            meeting_instance__date__lt=target_date,
            status__in=['assigned', 'confirmed', 'completed']
        )
        
        return recent_presentations.exists()
    
    def _calculate_type_balance_bonus(self, user: User, target_date: date) -> float:
        """Calculate bonus for balancing different meeting types"""
        # Get user's presentation history this year
        current_year = target_date.year
        presentations = Presenter.objects.filter(
            user=user,
            meeting_instance__date__year=current_year,
            status__in=['confirmed', 'completed']
        ).select_related('meeting_instance')
        
        ru_count = sum(1 for p in presentations if p.meeting_instance.meeting_type == 'research_update')
        jc_count = sum(1 for p in presentations if p.meeting_instance.meeting_type == 'journal_club')
        
        # Award bonus for being behind in either type
        type_difference = abs(ru_count - jc_count)
        if type_difference > 1:
            # Bonus for the underrepresented type
            return 15.0
        
        return 0.0
    
    def _can_be_selected_with_others(
        self,
        candidate_entry: QueueEntry,
        already_selected: List[QueueEntry],
        meeting_date: date
    ) -> bool:
        """Check if candidate can be selected along with already selected presenters"""
        
        # Check for any conflicts with already selected presenters
        for selected_entry in already_selected:
            # Avoid people who presented together recently
            if self._presented_together_recently(candidate_entry.user, selected_entry.user, meeting_date):
                return False
        
        return True
    
    def _presented_together_recently(
        self,
        user1: User,
        user2: User,
        target_date: date
    ) -> bool:
        """Check if two users presented together recently"""
        # Look for meetings in the past 8 weeks where both users presented
        recent_threshold = target_date - timedelta(weeks=8)
        
        # Get meeting instances where user1 presented
        user1_meetings = set(
            Presenter.objects.filter(
                user=user1,
                meeting_instance__date__gte=recent_threshold,
                meeting_instance__date__lt=target_date,
                status__in=['confirmed', 'completed']
            ).values_list('meeting_instance_id', flat=True)
        )
        
        # Get meeting instances where user2 presented
        user2_meetings = set(
            Presenter.objects.filter(
                user=user2,
                meeting_instance__date__gte=recent_threshold,
                meeting_instance__date__lt=target_date,
                status__in=['confirmed', 'completed']
            ).values_list('meeting_instance_id', flat=True)
        )
        
        # Check for intersection
        common_meetings = user1_meetings.intersection(user2_meetings)
        return len(common_meetings) > 0
    
    def recalculate_all_priorities(self, rotation_system: RotationSystem) -> Dict[str, int]:
        """Recalculate priorities for all entries in rotation system"""
        entries = QueueEntry.objects.filter(rotation_system=rotation_system)
        today = timezone.now().date()
        
        updated_count = 0
        for entry in entries:
            old_priority = entry.priority
            new_priority = self.calculate_priority_score(entry, today)
            
            if abs(old_priority - new_priority) > 0.1:  # Only update if significant change
                entry.priority = new_priority
                entry.save()
                updated_count += 1
        
        return {
            'total_entries': entries.count(),
            'updated_entries': updated_count
        }
    
    def suggest_presenter_assignments(
        self,
        rotation_system: RotationSystem,
        meeting_dates: List[date],
        meeting_types: List[str]
    ) -> List[Dict]:
        """
        Suggest presenter assignments for multiple meetings
        Returns a list of suggestions without actually creating assignments
        """
        suggestions = []
        
        # Track assignments to avoid conflicts
        tentative_assignments = {}  # date -> list of user_ids
        
        for i, meeting_date in enumerate(meeting_dates):
            meeting_type = meeting_types[i % len(meeting_types)] if meeting_types else 'research_update'
            
            # Determine number of presenters needed
            if meeting_type == 'research_update':
                presenters_needed = 2
            else:
                presenters_needed = 1
            
            # Get available presenters for this date
            available_presenters = self._get_available_presenters_for_date(
                rotation_system, meeting_date, tentative_assignments
            )
            
            # Select best presenters
            selected_presenters = available_presenters[:presenters_needed]
            
            # Record tentative assignment
            tentative_assignments[meeting_date] = [p.id for p in selected_presenters]
            
            suggestion = {
                'date': meeting_date,
                'meeting_type': meeting_type,
                'presenters_needed': presenters_needed,
                'suggested_presenters': [
                    {
                        'user_id': p.id,
                        'username': p.username,
                        'full_name': p.get_full_name(),
                        'last_presented': self._get_last_presentation_date(p),
                        'presentation_count_this_year': self._get_presentation_count_this_year(p)
                    }
                    for p in selected_presenters
                ],
                'confidence_score': self._calculate_suggestion_confidence(selected_presenters, meeting_date)
            }
            
            suggestions.append(suggestion)
        
        return suggestions
    
    def _get_available_presenters_for_date(
        self,
        rotation_system: RotationSystem,
        meeting_date: date,
        tentative_assignments: Dict[date, List[int]]
    ) -> List[User]:
        """Get available presenters for a specific date considering tentative assignments"""
        
        # Get all queue entries
        queue_entries = QueueEntry.objects.filter(
            rotation_system=rotation_system
        ).select_related('user')
        
        # Calculate scores considering tentative assignments
        scored_entries = []
        for entry in queue_entries:
            # Check if user is already tentatively assigned recently
            if self._is_user_recently_assigned(entry.user.id, meeting_date, tentative_assignments):
                continue
            
            score = self.calculate_priority_score(entry, meeting_date)
            if score > 0:
                scored_entries.append((entry.user, score))
        
        # Sort by score
        scored_entries.sort(key=lambda x: x[1], reverse=True)
        
        return [user for user, score in scored_entries]
    
    def _is_user_recently_assigned(
        self,
        user_id: int,
        meeting_date: date,
        tentative_assignments: Dict[date, List[int]]
    ) -> bool:
        """Check if user is assigned in recent tentative assignments"""
        recent_threshold = meeting_date - timedelta(weeks=4)
        
        for assign_date, assigned_users in tentative_assignments.items():
            if assign_date >= recent_threshold and assign_date < meeting_date:
                if user_id in assigned_users:
                    return True
        
        return False
    
    def _get_last_presentation_date(self, user: User) -> Optional[date]:
        \"\"\"Get user's last presentation date\"\"\"
        last_presentation = Presenter.objects.filter(
            user=user,
            status__in=['confirmed', 'completed']
        ).order_by('-meeting_instance__date').first()
        
        if last_presentation:
            return last_presentation.meeting_instance.date
        return None
    
    def _get_presentation_count_this_year(self, user: User) -> int:
        \"\"\"Get user's presentation count for current year\"\"\"
        current_year = timezone.now().year
        return Presenter.objects.filter(
            user=user,
            meeting_instance__date__year=current_year,
            status__in=['confirmed', 'completed']
        ).count()
    
    def _calculate_suggestion_confidence(
        self,
        selected_presenters: List[User],
        meeting_date: date
    ) -> float:
        \"\"\"Calculate confidence score for the suggestion\"\"\"
        if not selected_presenters:
            return 0.0
        
        total_score = 0.0
        for user in selected_presenters:
            # Factors that increase confidence:
            # 1. Long gap since last presentation
            last_date = self._get_last_presentation_date(user)
            if last_date:
                weeks_since = (meeting_date - last_date).days / 7.0
                gap_score = min(weeks_since / 10.0, 1.0)  # Cap at 1.0
            else:
                gap_score = 1.0  # New presenter
            
            # 2. Balanced workload this year
            presentation_count = self._get_presentation_count_this_year(user)
            # Assume average should be around 3-4 per year
            balance_score = max(0.0, 1.0 - (presentation_count / 6.0))
            
            user_confidence = (gap_score + balance_score) / 2.0
            total_score += user_confidence
        
        return min(1.0, total_score / len(selected_presenters))