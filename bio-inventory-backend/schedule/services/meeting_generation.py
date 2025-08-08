"""
Meeting Generation Service
Intelligently generates meetings with fair presenter rotation
"""
from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
from django.utils import timezone
from django.contrib.auth.models import User

from ..models import (
    MeetingConfiguration, MeetingInstance, Presenter, Event,
    RotationSystem, QueueEntry
)
from .quebec_holidays import QuebecHolidayService
from .fair_rotation import FairRotationAlgorithm


class MeetingGenerationService:
    """Service for generating meetings with intelligent presenter assignment"""
    
    def __init__(self):
        self.holiday_service = QuebecHolidayService()
        self.rotation_algorithm = FairRotationAlgorithm()
    
    def generate_meetings(
        self,
        start_date: date,
        end_date: date,
        meeting_types: List[str] = None,
        auto_assign_presenters: bool = True
    ) -> Dict[str, object]:
        """
        Generate meetings for a date range with intelligent scheduling.
        Returns a dict containing generated_meetings list, count, start_date, end_date.
        """
        # Defensive coding: ensure meeting_types is always a list
        import logging
        logger = logging.getLogger(__name__)
        original_meeting_types = meeting_types
        original_type = type(meeting_types)
        
        if meeting_types is None:
            meeting_types = ['research_update', 'journal_club']
            logger.debug(f"meeting_types was None, set to default: {meeting_types}")
        elif isinstance(meeting_types, str):
            # If a single string is passed, convert to list
            meeting_types = [meeting_types]
            logger.warning(f"meeting_types was string '{original_meeting_types}', converted to list: {meeting_types}")
        elif hasattr(meeting_types, 'items') and hasattr(meeting_types, 'keys'):
            # If it's a dictionary-like object, extract values
            meeting_types = list(meeting_types.values()) if meeting_types else ['research_update', 'journal_club']
            logger.warning(f"meeting_types was dict-like {original_type}: {original_meeting_types}, extracted values: {meeting_types}")
        elif not isinstance(meeting_types, (list, tuple)):
            # Try to convert other iterables to list
            try:
                meeting_types = list(meeting_types)
                logger.warning(f"meeting_types was {original_type}: {original_meeting_types}, converted to list: {meeting_types}")
            except (TypeError, ValueError):
                # Fallback to default if conversion fails
                meeting_types = ['research_update', 'journal_club']
                logger.error(f"meeting_types was {original_type}: {original_meeting_types}, conversion failed, using default: {meeting_types}")
        else:
            logger.debug(f"meeting_types is already a valid list/tuple: {meeting_types}")
            
        logger.debug(f"Final meeting_types: {meeting_types} (type: {type(meeting_types)})")

        # Ensure configuration exists or auto-create
        config = MeetingConfiguration.objects.first()
        if not config:
            logger.warning("No MeetingConfiguration found, creating default configuration")
            admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
            if admin_user:
                config = MeetingConfiguration.objects.create(
                    day_of_week=1,  # Monday
                    start_time='10:00:00',
                    location='Conference Room',
                    research_update_duration=60,
                    journal_club_duration=60,
                    created_by=admin_user
                )
                active_users = User.objects.filter(is_active=True)
                config.active_members.set(active_users)
                logger.info(f"Created default MeetingConfiguration: day_of_week=Monday, active_members={active_users.count()}")
            else:
                logger.error("No admin user found, cannot create MeetingConfiguration")
                return {'generated_meetings': [], 'count': 0, 'start_date': start_date, 'end_date': end_date}
        else:
            logger.debug(f"Using existing MeetingConfiguration: id={config.id}, day_of_week={config.day_of_week}, active_members={config.active_members.count()}")

        # Get all possible meeting dates (excluding holidays)
        logger.debug(f"Getting meeting dates: {start_date} to {end_date}, weekday={config.day_of_week}")
        meeting_dates = self.holiday_service.get_meeting_dates_in_range(
            start_date, end_date, config.day_of_week
        )
        logger.info(f"Found {len(meeting_dates)} potential meeting dates: {meeting_dates[:5]}{'...' if len(meeting_dates) > 5 else ''}")
        if not meeting_dates:
            logger.warning(f"No meeting dates found in range {start_date} to {end_date} for weekday {config.day_of_week}")
            return {'generated_meetings': [], 'count': 0, 'start_date': start_date, 'end_date': end_date}

        # Generate meeting type sequence (alternating RU and JC)
        meeting_sequence = self._generate_meeting_sequence(meeting_dates, meeting_types)

        generated_meetings = []
        skipped_count = 0
        logger.debug(f"Processing {len(meeting_sequence)} meeting slots")
        
        for meeting_date, meeting_type in meeting_sequence:
            # Check if meeting already exists
            existing = MeetingInstance.objects.filter(date=meeting_date, meeting_type=meeting_type).exists()
            if existing:
                logger.debug(f"Skipping {meeting_date} ({meeting_type}) - already exists")
                skipped_count += 1
                continue
                
            logger.info(f"Creating meeting: {meeting_date} ({meeting_type})")
            meeting = self._create_meeting_instance(meeting_date, meeting_type, config)
            generated_meetings.append(meeting)
            
            if auto_assign_presenters:
                self._assign_presenters(meeting, config)
                logger.debug(f"Assigned presenters to meeting {meeting_date}")

        logger.info(f"Meeting generation complete: {len(generated_meetings)} created, {skipped_count} skipped (already exist)")
        return {
            'generated_meetings': generated_meetings,
            'count': len(generated_meetings),
            'start_date': start_date,
            'end_date': end_date
        }
    
    def _generate_meeting_sequence(
        self, 
        meeting_dates: List[date], 
        meeting_types: List[str]
    ) -> List[Tuple[date, str]]:
        """Generate sequence of meetings with alternating types"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.debug(f"_generate_meeting_sequence: {len(meeting_dates)} dates, types: {meeting_types}")
        
        sequence = []
        
        # Start with Research Update, then alternate
        for i, meeting_date in enumerate(meeting_dates):
            if len(meeting_types) == 1:
                meeting_type = meeting_types[0]
            else:
                # Alternate between types
                type_index = i % len(meeting_types)
                try:
                    meeting_type = meeting_types[type_index]
                except (IndexError, TypeError, KeyError) as e:
                    logger.error(f"ERROR accessing meeting_types[{type_index}]: {e}")
                    logger.error(f"meeting_types: {meeting_types} (type: {type(meeting_types)})")
                    logger.error(f"meeting_types items: {list(meeting_types.items()) if hasattr(meeting_types, 'items') else 'No items method'}")
                    # Fallback to research_update if we can't access the type
                    meeting_type = 'research_update'
                    logger.warning(f"Fallback to meeting_type: {meeting_type}")
            
            sequence.append((meeting_date, meeting_type))
        
        return sequence
    
    def _create_meeting_instance(
        self,
        meeting_date: date,
        meeting_type: str,
        config: MeetingConfiguration
    ) -> MeetingInstance:
        """Create a meeting instance with associated event"""
        
        # Determine duration based on meeting type
        if meeting_type == 'research_update':
            duration_minutes = config.research_update_duration
        elif meeting_type == 'journal_club':
            duration_minutes = config.journal_club_duration
        else:
            duration_minutes = 60  # Default
        
        # Create start and end times
        start_datetime = timezone.make_aware(
            timezone.datetime.combine(meeting_date, config.start_time)
        )
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        
        # Create the event
        event = Event.objects.create(
            title=f"{meeting_type.replace('_', ' ').title()} - {meeting_date}",
            start_time=start_datetime,
            end_time=end_datetime,
            event_type='meeting',
            description=f"Auto-generated {meeting_type.replace('_', ' ')} meeting",
            created_by=config.created_by
        )
        
        # Create the meeting instance
        meeting = MeetingInstance.objects.create(
            date=meeting_date,
            meeting_type=meeting_type,
            status='scheduled',
            event=event
        )
        
        return meeting
    
    def _assign_presenters(self, meeting: MeetingInstance, config: MeetingConfiguration) -> None:
        """Assign presenters using fair rotation algorithm"""
        
        # Get or create rotation system
        rotation_system, created = RotationSystem.objects.get_or_create(
            name="Default Rotation",
            defaults={'is_active': True}
        )
        
        # Ensure all active members are in the rotation queue
        self._ensure_queue_entries(rotation_system, config)
        
        # Determine number of presenters needed
        if meeting.meeting_type == 'research_update':
            presenters_needed = 2  # Usually 2 people for RU
        else:  # journal_club
            presenters_needed = 1  # Usually 1 person for JC
        
        # Get next presenters using fair rotation algorithm
        next_presenters = self.rotation_algorithm.get_next_presenters(
            rotation_system, meeting.date, presenters_needed
        )
        
        # Create presenter assignments
        for i, user in enumerate(next_presenters):
            Presenter.objects.create(
                meeting_instance=meeting,
                user=user,
                order=i + 1,
                status='assigned'
            )
            
            # Update the queue entry
            queue_entry = QueueEntry.objects.get(
                rotation_system=rotation_system,
                user=user
            )
            queue_entry.next_scheduled_date = meeting.date
            queue_entry.save()
    
    def _ensure_queue_entries(
        self, 
        rotation_system: RotationSystem, 
        config: MeetingConfiguration
    ) -> None:
        """Ensure all active members have queue entries"""
        
        existing_users = set(
            QueueEntry.objects.filter(rotation_system=rotation_system)
            .values_list('user', flat=True)
        )
        
        for member in config.active_members.all():
            if member.id not in existing_users:
                QueueEntry.objects.create(
                    rotation_system=rotation_system,
                    user=member,
                    postpone_count=0,
                    priority=100.0  # Initial priority
                )
    
    def regenerate_presenter_assignments(
        self,
        start_date: date,
        end_date: date,
        clear_existing: bool = False
    ) -> Dict[str, int]:
        """Regenerate presenter assignments for existing meetings"""
        
        config = MeetingConfiguration.objects.first()
        if not config:
            raise ValueError("Meeting configuration not found")
        
        # Get meetings in date range
        meetings = MeetingInstance.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
            status='scheduled'
        )
        
        stats = {
            'meetings_processed': 0,
            'presenters_assigned': 0,
            'presenters_cleared': 0
        }
        
        for meeting in meetings:
            if clear_existing:
                # Clear existing assignments
                cleared_count = meeting.presenters.count()
                meeting.presenters.all().delete()
                stats['presenters_cleared'] += cleared_count
            
            # Skip if already has presenters and not clearing
            if meeting.presenters.exists() and not clear_existing:
                continue
            
            # Assign new presenters
            self._assign_presenters(meeting, config)
            stats['meetings_processed'] += 1
            stats['presenters_assigned'] += meeting.presenters.count()
        
        return stats
    
    def preview_meeting_generation(
        self,
        start_date: date,
        end_date: date,
        meeting_types: List[str] = None
    ) -> Dict:
        """Preview what meetings would be generated without creating them"""
        
        if meeting_types is None:
            meeting_types = ['research_update', 'journal_club']
        
        config = MeetingConfiguration.objects.first()
        if not config:
            raise ValueError("Meeting configuration not found")
        
        # Get possible meeting dates
        meeting_dates = self.holiday_service.get_meeting_dates_in_range(
            start_date, end_date, config.day_of_week
        )
        
        # Generate sequence
        meeting_sequence = self._generate_meeting_sequence(meeting_dates, meeting_types)
        
        # Check for conflicts
        existing_meetings = MeetingInstance.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).values_list('date', 'meeting_type')
        
        existing_set = set(existing_meetings)
        
        preview_data = {
            'total_meetings': len(meeting_sequence),
            'date_range': {
                'start': start_date,
                'end': end_date
            },
            'meetings': [],
            'conflicts': [],
            'statistics': {
                'research_updates': 0,
                'journal_clubs': 0,
                'new_meetings': 0,
                'existing_meetings': 0
            }
        }
        
        for meeting_date, meeting_type in meeting_sequence:
            conflict = (meeting_date, meeting_type) in existing_set
            
            meeting_info = {
                'date': meeting_date,
                'type': meeting_type,
                'is_conflict': conflict,
                'is_holiday': self.holiday_service.is_holiday(meeting_date),
                'weekday': meeting_date.strftime('%A')
            }
            
            preview_data['meetings'].append(meeting_info)
            
            if conflict:
                preview_data['conflicts'].append(meeting_info)
                preview_data['statistics']['existing_meetings'] += 1
            else:
                preview_data['statistics']['new_meetings'] += 1
            
            # Count by type
            if meeting_type == 'research_update':
                preview_data['statistics']['research_updates'] += 1
            elif meeting_type == 'journal_club':
                preview_data['statistics']['journal_clubs'] += 1
        
        return preview_data
    
    def get_presenter_workload_balance(self) -> Dict:
        """Analyze presenter workload balance"""
        
        config = MeetingConfiguration.objects.first()
        if not config:
            return {'error': 'Meeting configuration not found'}
        
        today = timezone.now().date()
        current_year = today.year
        
        # Get all presentations this year
        presentations = Presenter.objects.filter(
            meeting_instance__date__year=current_year,
            status__in=['assigned', 'confirmed', 'completed']
        ).select_related('user', 'meeting_instance')
        
        # Calculate workload by user
        user_workload = {}
        total_presentations = 0
        
        for presentation in presentations:
            user_id = presentation.user.id
            if user_id not in user_workload:
                user_workload[user_id] = {
                    'user': {
                        'id': user_id,
                        'username': presentation.user.username,
                        'full_name': presentation.user.get_full_name()
                    },
                    'research_updates': 0,
                    'journal_clubs': 0,
                    'total': 0,
                    'upcoming': 0,
                    'completed': 0
                }
            
            # Count by type
            if presentation.meeting_instance.meeting_type == 'research_update':
                user_workload[user_id]['research_updates'] += 1
            elif presentation.meeting_instance.meeting_type == 'journal_club':
                user_workload[user_id]['journal_clubs'] += 1
            
            user_workload[user_id]['total'] += 1
            total_presentations += 1
            
            # Count by status
            if presentation.meeting_instance.date >= today:
                user_workload[user_id]['upcoming'] += 1
            else:
                user_workload[user_id]['completed'] += 1
        
        # Calculate statistics
        active_presenters = len(user_workload)
        if active_presenters > 0:
            average_load = total_presentations / active_presenters
            workloads = [data['total'] for data in user_workload.values()]
            min_load = min(workloads) if workloads else 0
            max_load = max(workloads) if workloads else 0
            imbalance_ratio = (max_load - min_load) / average_load if average_load > 0 else 0
        else:
            average_load = min_load = max_load = imbalance_ratio = 0
        
        return {
            'year': current_year,
            'total_presentations': total_presentations,
            'active_presenters': active_presenters,
            'average_load': round(average_load, 2),
            'min_load': min_load,
            'max_load': max_load,
            'imbalance_ratio': round(imbalance_ratio, 3),
            'workload_by_user': list(user_workload.values()),
            'balance_status': 'good' if imbalance_ratio < 0.3 else 'needs_attention'
        }