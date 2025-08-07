"""
Django management command to generate group meetings
Usage: python manage.py generate_group_meetings --start-date 2024-03-01 --end-date 2024-06-01
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, date
from schedule.services import MeetingGenerationService
from schedule.models import MeetingConfiguration


class Command(BaseCommand):
    help = 'Generate group meetings for a specified date range'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--start-date',
            type=str,
            required=True,
            help='Start date in YYYY-MM-DD format'
        )
        parser.add_argument(
            '--end-date',
            type=str,
            required=True,
            help='End date in YYYY-MM-DD format'
        )
        parser.add_argument(
            '--meeting-types',
            nargs='+',
            default=['research_update', 'journal_club'],
            help='Meeting types to generate (default: research_update journal_club)'
        )
        parser.add_argument(
            '--auto-assign',
            action='store_true',
            default=True,
            help='Automatically assign presenters (default: True)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be generated without actually creating meetings'
        )
    
    def handle(self, *args, **options):
        try:
            # Parse dates
            start_date = datetime.strptime(options['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(options['end_date'], '%Y-%m-%d').date()
        except ValueError as e:
            self.stdout.write(
                self.style.ERROR(f"Invalid date format: {e}")
            )
            return
        
        # Validate date range
        if start_date >= end_date:
            self.stdout.write(
                self.style.ERROR("End date must be after start date")
            )
            return
        
        # Check if meeting configuration exists
        config = MeetingConfiguration.objects.first()
        if not config:
            self.stdout.write(
                self.style.ERROR(
                    "No meeting configuration found. "
                    "Please create a meeting configuration first using the admin interface."
                )
            )
            return
        
        self.stdout.write(
            f"Generating meetings from {start_date} to {end_date}"
        )
        self.stdout.write(f"Meeting types: {', '.join(options['meeting_types'])}")
        self.stdout.write(f"Auto-assign presenters: {options['auto_assign']}")
        
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No meetings will be created")
            )
        
        try:
            # Generate meetings
            generation_service = MeetingGenerationService()
            result = generation_service.generate_meetings(
                start_date=start_date,
                end_date=end_date,
                meeting_types=options['meeting_types'],
                auto_assign_presenters=options['auto_assign']
            )
            
            if options['dry_run']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Would generate {result['count']} meetings"
                    )
                )
                
                for meeting_info in result['generated_meetings']:
                    meeting = meeting_info['meeting_instance']
                    presenters = meeting_info['presenters']
                    presenter_names = [p.user.username for p in presenters]
                    
                    self.stdout.write(
                        f"  - {meeting.date}: {meeting.get_meeting_type_display()}"
                        f" (Presenters: {', '.join(presenter_names) if presenter_names else 'None'})"
                    )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully generated {result['count']} meetings"
                    )
                )
                
                # Show summary
                meeting_types_count = {}
                for meeting_info in result['generated_meetings']:
                    meeting_type = meeting_info['type']
                    meeting_types_count[meeting_type] = meeting_types_count.get(meeting_type, 0) + 1
                
                self.stdout.write("Summary:")
                for meeting_type, count in meeting_types_count.items():
                    self.stdout.write(f"  - {meeting_type.replace('_', ' ').title()}: {count}")
        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error generating meetings: {e}")
            )