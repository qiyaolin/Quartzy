from typing import List, Dict

from django.utils import timezone

from ..models import MeetingConfiguration, Presenter, MeetingInstance


class MeetingNotificationService:
    """Service for Journal Club and general meeting notifications."""

    def get_journal_club_deadlines(self) -> List[Dict]:
        """Get upcoming Journal Club submission deadlines within next 14 days.

        Returns a list of dicts with keys:
        - presenter
        - meeting_date
        - submission_deadline
        - final_deadline
        - urgency_level
        - days_to_submission
        - days_to_final
        - has_materials
        """
        from datetime import timedelta

        config = MeetingConfiguration.objects.first()
        if not config:
            return []

        today = timezone.now().date()
        end_date = today + timedelta(days=14)

        jc_presentations = (
            Presenter.objects.filter(
                meeting_instance__meeting_type='journal_club',
                meeting_instance__date__gte=today,
                meeting_instance__date__lte=end_date,
                meeting_instance__status__in=['scheduled', 'confirmed'],
            )
            .select_related('meeting_instance', 'user')
            .order_by('meeting_instance__date')
        )

        deadlines: List[Dict] = []
        for presenter in jc_presentations:
            meeting_date = presenter.meeting_instance.date
            submission_deadline = meeting_date - timedelta(days=config.jc_submission_deadline_days)
            final_deadline = meeting_date - timedelta(days=config.jc_final_deadline_days)

            has_materials = bool(presenter.materials_submitted_at)
            days_to_submission = (submission_deadline - today).days
            days_to_final = (final_deadline - today).days

            # Determine urgency level
            if not has_materials:
                if today > final_deadline:
                    urgency = 'overdue'
                elif days_to_final <= 1:
                    urgency = 'critical'
                elif days_to_final <= 3:
                    urgency = 'urgent'
                elif days_to_submission <= 0:
                    urgency = 'approaching_final'
                elif days_to_submission <= 3:
                    urgency = 'approaching'
                else:
                    urgency = 'reminder'
            else:
                urgency = 'submitted'

            deadlines.append(
                {
                    'presenter': presenter,
                    'meeting_date': meeting_date,
                    'submission_deadline': submission_deadline,
                    'final_deadline': final_deadline,
                    'urgency_level': urgency,
                    'days_to_submission': days_to_submission,
                    'days_to_final': days_to_final,
                    'has_materials': has_materials,
                }
            )

        return deadlines

    def get_meeting_reminders(self) -> List[Dict]:
        """Get meetings requiring 24h reminders (meetings occurring tomorrow)."""
        from datetime import timedelta

        tomorrow = timezone.now().date() + timedelta(days=1)
        meetings = (
            MeetingInstance.objects.filter(
                date=tomorrow, status__in=['scheduled', 'confirmed']
            ).prefetch_related('presenters')
        )

        return [
            {
                'meeting': meeting,
                'presenters': list(meeting.presenters.all()),
            }
            for meeting in meetings
        ]

    def get_overdue_submissions(self) -> List[Dict]:
        """Get overdue Journal Club submissions (final deadline passed, not submitted)."""
        from datetime import timedelta

        config = MeetingConfiguration.objects.first()
        if not config:
            return []

        today = timezone.now().date()

        overdue_presentations = (
            Presenter.objects.filter(
                meeting_instance__meeting_type='journal_club',
                meeting_instance__date__gte=today,
                meeting_instance__status__in=['scheduled', 'confirmed'],
                materials_submitted_at__isnull=True,
            )
            .select_related('meeting_instance', 'user')
            .order_by('meeting_instance__date')
        )

        overdue: List[Dict] = []
        for presenter in overdue_presentations:
            meeting_date = presenter.meeting_instance.date
            final_deadline = meeting_date - timedelta(days=config.jc_final_deadline_days)

            if today > final_deadline:
                days_overdue = (today - final_deadline).days
                overdue.append(
                    {
                        'presenter': presenter,
                        'days_overdue': days_overdue,
                        'meeting_date': meeting_date,
                    }
                )

        return overdue


