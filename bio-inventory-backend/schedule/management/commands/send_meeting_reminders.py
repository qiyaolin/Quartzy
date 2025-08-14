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
from notifications.email_service import EmailNotificationService


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
                meeting_date = presenter.meeting_instance.date
                submission_deadline = deadline_info['submission_deadline']
                final_deadline = deadline_info['final_deadline']
                presenter_user = presenter.user
                
                if self.dry_run:
                    self.stdout.write(
                        f"  Would send {reminder_type} reminder to {presenter_user.username} "
                        f"for {meeting_date} JC (urgency: {urgency})"
                    )
                else:
                    # Build context depending on reminder_type
                    if reminder_type == 'submission':
                        subject = f"Journal Club Paper Submission Request - {meeting_date}"
                        template = 'jc_materials_submission_request'
                        context = {
                            'presenter': presenter_user,
                            'meeting': {'date': meeting_date},
                            'deadline': {'date': submission_deadline},
                        }
                        EmailNotificationService.send_email_notification(
                            recipients=[presenter_user],
                            subject=subject,
                            template_name=template,
                            context=context,
                        )
                    elif reminder_type in ['approaching', 'urgent']:
                        # Use JC-specific reminder template, display the most relevant deadline
                        subject = (
                            f"Reminder: JC Paper Due by {submission_deadline}" if reminder_type == 'approaching'
                            else f"Urgent: JC Paper Final Due {final_deadline}"
                        )
                        template = 'jc_materials_submission_reminder'
                        context = {
                            'presenter': presenter_user,
                            'meeting': {'date': meeting_date},
                            'deadline': {'date': (final_deadline if reminder_type == 'urgent' else submission_deadline)},
                        }
                        EmailNotificationService.send_email_notification(
                            recipients=[presenter_user],
                            subject=subject,
                            template_name=template,
                            context=context,
                        )
                    elif reminder_type == 'final':
                        subject = f"URGENT: JC Paper Final Reminder - {meeting_date}"
                        template = 'materials_deadline_reminder'
                        context = {
                            'recipient': presenter_user,
                            'meeting': {'date': meeting_date, 'type': 'Journal Club'},
                            'deadline': {'date': final_deadline},
                        }
                        EmailNotificationService.send_email_notification(
                            recipients=[presenter_user],
                            subject=subject,
                            template_name=template,
                            context=context,
                        )
                    elif reminder_type == 'overdue':
                        # Send to presenter
                        subject = f"OVERDUE: JC Paper - {meeting_date}"
                        template = 'materials_deadline_reminder'
                        context = {
                            'recipient': presenter_user,
                            'meeting': {'date': meeting_date, 'type': 'Journal Club'},
                            'deadline': {'date': final_deadline},
                        }
                        EmailNotificationService.send_email_notification(
                            recipients=[presenter_user],
                            subject=subject,
                            template_name=template,
                            context=context,
                        )
                        # Escalate to admins
                        admin_users = User.objects.filter(is_staff=True, is_active=True)
                        if admin_users.exists():
                            admin_subject = f"OVERDUE (CC): {presenter_user.get_full_name() or presenter_user.username} - JC {meeting_date}"
                            admin_context = {
                                'recipient': None,  # Not used in template for admin copy
                                'meeting': {'date': meeting_date, 'type': 'Journal Club'},
                                'deadline': {'date': final_deadline},
                            }
                            EmailNotificationService.send_email_notification(
                                recipients=list(admin_users),
                                subject=admin_subject,
                                template_name=template,
                                context=admin_context,
                            )
                
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
                meeting_date = presenter.meeting_instance.date
                subject = f"Research Update Reminder - {meeting_date}"
                template = 'presenter_special_reminder'
                context = {
                    'presenter': presenter.user,
                    'meeting': {
                        'date': meeting_date,
                        'type': 'Research Update',
                    },
                }
                EmailNotificationService.send_email_notification(
                    recipients=[presenter.user],
                    subject=subject,
                    template_name=template,
                    context=context,
                )
            
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
                # Determine recipients: meeting configuration's active members else all active users
                config = MeetingConfiguration.objects.first()
                recipients = list(config.active_members.all()) if config else list(User.objects.filter(is_active=True))
                # Build meeting context
                start_time = getattr(getattr(meeting, 'event', None), 'start_time', None)
                time_str = start_time.strftime('%H:%M') if start_time else ''
                meeting_context = {
                    'date': meeting.date,
                    'time': time_str,
                    'location': getattr(getattr(meeting, 'event', None), 'location', ''),
                    'type': meeting.get_meeting_type_display(),
                }
                subject = f"Meeting Reminder: {meeting_context['type']} on {meeting.date}"
                template = 'meeting_reminder'
                context = {
                    'meeting': meeting_context,
                    'reminder_minutes': 24 * 60,
                }
                EmailNotificationService.send_email_notification(
                    recipients=recipients,
                    subject=subject,
                    template_name=template,
                    context=context,
                )
            
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
                meeting_date = presenter.meeting_instance.date
                # Presenter email
                subject = f"OVERDUE: JC Paper - {meeting_date}"
                template = 'materials_deadline_reminder'
                context = {
                    'recipient': presenter.user,
                    'meeting': {'date': meeting_date, 'type': 'Journal Club'},
                    'deadline': {'date': overdue_info.get('meeting_date') - timedelta(days=MeetingConfiguration.objects.first().jc_final_deadline_days) if MeetingConfiguration.objects.first() else None},
                }
                EmailNotificationService.send_email_notification(
                    recipients=[presenter.user],
                    subject=subject,
                    template_name=template,
                    context=context,
                )
                # Admin escalation
                admin_users = User.objects.filter(is_staff=True, is_active=True)
                if admin_users.exists():
                    admin_subject = f"OVERDUE (CC): {presenter.user.get_full_name() or presenter.user.username} - JC {meeting_date}"
                    admin_context = {
                        'recipient': None,
                        'meeting': {'date': meeting_date, 'type': 'Journal Club'},
                        'deadline': {'date': overdue_info.get('meeting_date')},
                    }
                    EmailNotificationService.send_email_notification(
                        recipients=list(admin_users),
                        subject=admin_subject,
                        template_name=template,
                        context=admin_context,
                    )
            
            notifications_sent += 1
        
        return notifications_sent