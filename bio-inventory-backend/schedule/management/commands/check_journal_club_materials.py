"""
Django management command to check Journal Club material submissions
This should be run daily via cron to monitor submission status
Usage: python manage.py check_journal_club_materials
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, date, timedelta
from django.contrib.auth.models import User
from schedule.models import MeetingInstance, Presenter, MeetingConfiguration


class Command(BaseCommand):
    help = 'Check Journal Club material submission status and send alerts'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--days-ahead',
            type=int,
            default=14,
            help='Check presentations up to N days ahead (default: 14)'
        )
        parser.add_argument(
            '--send-notifications',
            action='store_true',
            help='Send notification emails (default: False)'
        )
        parser.add_argument(
            '--show-all',
            action='store_true',
            help='Show all presentations, not just those with issues'
        )
    
    def handle(self, *args, **options):
        days_ahead = options['days_ahead']
        send_notifications = options['send_notifications']
        show_all = options['show_all']
        
        today = timezone.now().date()
        end_date = today + timedelta(days=days_ahead)
        
        config = MeetingConfiguration.objects.first()
        if not config:
            self.stdout.write(
                self.style.ERROR("No meeting configuration found")
            )
            return
        
        self.stdout.write(
            f"Checking Journal Club material submissions from {today} to {end_date}"
        )
        
        # Get all Journal Club presentations in the time range
        jc_presentations = Presenter.objects.filter(
            meeting_instance__meeting_type='journal_club',
            meeting_instance__date__gte=today,
            meeting_instance__date__lte=end_date,
            meeting_instance__status__in=['scheduled', 'confirmed']
        ).select_related('meeting_instance', 'user').order_by('meeting_instance__date')
        
        if not jc_presentations.exists():
            self.stdout.write("No Journal Club presentations found in the specified date range")
            return
        
        # Analyze each presentation
        total_presentations = 0
        missing_materials = 0
        approaching_deadline = 0
        overdue_submissions = 0
        
        for presenter in jc_presentations:
            total_presentations += 1
            meeting_date = presenter.meeting_instance.date
            submission_deadline = meeting_date - timedelta(days=config.jc_submission_deadline_days)
            final_deadline = meeting_date - timedelta(days=config.jc_final_deadline_days)
            
            # Calculate status
            has_materials = bool(presenter.materials_submitted_at)
            days_to_submission = (submission_deadline - today).days
            days_to_final = (final_deadline - today).days
            days_to_meeting = (meeting_date - today).days
            
            # Determine status
            status = 'ok'
            urgency = 'normal'
            
            if not has_materials:
                missing_materials += 1
                
                if today > final_deadline:
                    status = 'overdue'
                    urgency = 'critical'
                    overdue_submissions += 1
                elif days_to_final <= 1:
                    status = 'critical'
                    urgency = 'high'
                elif days_to_final <= 3:
                    status = 'urgent'
                    urgency = 'high'
                elif days_to_submission <= 0:
                    status = 'approaching_final'
                    urgency = 'medium'
                    approaching_deadline += 1
                elif days_to_submission <= 3:
                    status = 'approaching'
                    urgency = 'medium'
                    approaching_deadline += 1
                else:
                    status = 'pending'
                    urgency = 'low'
            else:
                status = 'submitted'
                urgency = 'none'
            
            # Display information
            if show_all or status != 'submitted':
                status_style = self.get_status_style(status)
                
                self.stdout.write(
                    status_style(
                        f"{presenter.user.username:15} | "
                        f"{meeting_date} | "
                        f"{status:15} | "
                        f"Days to meeting: {days_to_meeting:2} | "
                        f"Submission deadline: {submission_deadline} | "
                        f"Final deadline: {final_deadline}"
                    )
                )
                
                if has_materials:
                    self.stdout.write(
                        f"                  Materials submitted: {presenter.materials_submitted_at}"
                    )
                    if presenter.paper_title:
                        self.stdout.write(f"                  Paper: {presenter.paper_title}")
                
                # Check for notifications to send
                if send_notifications and not has_materials:
                    if status in ['overdue', 'critical', 'urgent', 'approaching_final', 'approaching']:
                        self.stdout.write(
                            self.style.WARNING(
                                f"                  -> Would send {urgency} priority notification"
                            )
                        )
                        # Here you would implement the actual notification sending
                        # self.send_notification(presenter, status, urgency)
        
        # Summary
        self.stdout.write("\n" + "="*80)
        self.stdout.write("SUMMARY:")
        self.stdout.write(f"Total Journal Club presentations: {total_presentations}")
        self.stdout.write(f"Missing materials: {missing_materials}")
        self.stdout.write(f"Approaching deadline: {approaching_deadline}")
        self.stdout.write(f"Overdue submissions: {overdue_submissions}")
        
        if overdue_submissions > 0:
            self.stdout.write(
                self.style.ERROR(f"⚠️  {overdue_submissions} overdue submissions require immediate attention")
            )
        
        if approaching_deadline > 0:
            self.stdout.write(
                self.style.WARNING(f"📅 {approaching_deadline} presentations approaching deadline")
            )
        
        if missing_materials == 0:
            self.stdout.write(
                self.style.SUCCESS("✅ All upcoming presentations have materials submitted")
            )
    
    def get_status_style(self, status):
        """Get the appropriate style for status display"""
        if status == 'overdue':
            return self.style.ERROR
        elif status in ['critical', 'urgent']:
            return self.style.WARNING
        elif status in ['approaching_final', 'approaching']:
            return self.style.NOTICE
        elif status == 'submitted':
            return self.style.SUCCESS
        else:
            return lambda x: x  # No style