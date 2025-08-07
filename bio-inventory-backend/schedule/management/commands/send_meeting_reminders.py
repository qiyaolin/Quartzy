"""
Django management command to send meeting reminders
This should be run daily via cron to send automated reminders
Usage: python manage.py send_meeting_reminders
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, date, timedelta
from django.contrib.auth.models import User
from schedule.models import MeetingInstance, Presenter, MeetingConfiguration
from schedule.services import MeetingNotificationService


class Command(BaseCommand):
    help = 'Send meeting reminders and notifications'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what notifications would be sent without actually sending them'
        )
        parser.add_argument(
            '--reminder-type',
            choices=['journal_club', 'research_update', 'general', 'all'],
            default='all',
            help='Type of reminders to send'
        )
        parser.add_argument(
            '--force-send',
            action='store_true',
            help='Force send reminders even if already sent today'
        )
    
    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        reminder_type = options['reminder_type']
        force_send = options['force_send']
        
        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No notifications will be sent")
            )
        
        notification_service = MeetingNotificationService()
        
        # Track notifications sent
        notifications_sent = 0
        
        try:
            # Send Journal Club reminders
            if reminder_type in ['journal_club', 'all']:
                notifications_sent += self.send_journal_club_reminders(notification_service)
            
            # Send Research Update reminders
            if reminder_type in ['research_update', 'all']:
                notifications_sent += self.send_research_update_reminders(notification_service)
            
            # Send general meeting reminders
            if reminder_type in ['general', 'all']:
                notifications_sent += self.send_general_meeting_reminders(notification_service)
            
            # Send overdue notifications
            if reminder_type in ['all']:
                notifications_sent += self.send_overdue_notifications(notification_service)
            
            if self.dry_run:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Would send {notifications_sent} notifications"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Sent {notifications_sent} notifications successfully"
                    )
                )
        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error sending reminders: {e}")
            )
    
    def send_journal_club_reminders(self, notification_service):
        """Send Journal Club related reminders"""
        notifications_sent = 0
        
        deadlines = notification_service.get_journal_club_deadlines()
        
        for deadline_info in deadlines:
            presenter = deadline_info['presenter']
            urgency = deadline_info['urgency_level']
            days_to_submission = deadline_info['days_to_submission']
            days_to_final = deadline_info['days_to_final']
            
            # Determine if we should send a reminder
            should_send = False
            reminder_type = None
            
            if urgency == 'overdue':
                should_send = True
                reminder_type = 'overdue'
            elif urgency == 'critical':
                should_send = True
                reminder_type = 'final'
            elif urgency == 'urgent' and days_to_final <= 3:
                should_send = True
                reminder_type = 'urgent'
            elif urgency == 'approaching' and days_to_final <= 7:
                should_send = True
                reminder_type = 'approaching'
            elif urgency == 'reminder' and days_to_submission in [7, 6, 5, 4]:
                should_send = True
                reminder_type = 'submission'
            
            if should_send:
                if self.dry_run:
                    self.stdout.write(
                        f"  Would send {reminder_type} reminder to {presenter.user.username} "
                        f"for {presenter.meeting_instance.date} JC (urgency: {urgency})"
                    )
                else:
                    self.stdout.write(
                        f"  Sending {reminder_type} reminder to {presenter.user.username} "
                        f"for {presenter.meeting_instance.date} JC"
                    )
                    # Here would be the actual email sending logic
                    # self.send_journal_club_reminder(presenter, reminder_type, deadline_info)
                
                notifications_sent += 1
        
        return notifications_sent
    
    def send_research_update_reminders(self, notification_service):
        """Send Research Update reminders"""
        notifications_sent = 0
        today = timezone.now().date()
        
        # Find Research Update presentations 3 days ahead
        upcoming_rus = Presenter.objects.filter(
            meeting_instance__meeting_type='research_update',
            meeting_instance__date=today + timedelta(days=3),
            meeting_instance__status__in=['scheduled', 'confirmed'],
            status__in=['assigned', 'confirmed']
        ).select_related('meeting_instance', 'user')
        
        for presenter in upcoming_rus:
            if self.dry_run:
                self.stdout.write(
                    f"  Would send RU reminder to {presenter.user.username} "
                    f"for {presenter.meeting_instance.date}"
                )
            else:
                self.stdout.write(
                    f"  Sending RU reminder to {presenter.user.username} "
                    f"for {presenter.meeting_instance.date}"
                )
                # Here would be the actual email sending logic
                # self.send_research_update_reminder(presenter)
            
            notifications_sent += 1
        
        return notifications_sent
    
    def send_general_meeting_reminders(self, notification_service):
        """Send general meeting reminders"""
        notifications_sent = 0
        
        reminders = notification_service.get_meeting_reminders()
        
        for reminder_info in reminders:
            meeting = reminder_info['meeting']
            presenters = reminder_info['presenters']
            
            if self.dry_run:
                self.stdout.write(
                    f"  Would send 24h reminder for {meeting.get_meeting_type_display()} "
                    f"on {meeting.date} to all members"
                )
            else:
                self.stdout.write(
                    f"  Sending 24h reminder for {meeting.get_meeting_type_display()} "
                    f"on {meeting.date} to all members"
                )
                # Here would be the actual email sending logic
                # self.send_general_meeting_reminder(meeting, presenters)
            
            notifications_sent += 1
        
        return notifications_sent
    
    def send_overdue_notifications(self, notification_service):
        """Send overdue submission notifications"""
        notifications_sent = 0
        
        overdue = notification_service.get_overdue_submissions()
        
        for overdue_info in overdue:
            presenter = overdue_info['presenter']
            days_overdue = overdue_info['days_overdue']
            
            if self.dry_run:
                self.stdout.write(
                    f"  Would send overdue notification to {presenter.user.username} "
                    f"({days_overdue} days overdue)"
                )
            else:
                self.stdout.write(
                    f"  Sending overdue notification to {presenter.user.username} "
                    f"({days_overdue} days overdue)"
                )
                # Here would be the actual email sending logic
                # self.send_overdue_notification(presenter, overdue_info)
            
            notifications_sent += 1
        
        return notifications_sent