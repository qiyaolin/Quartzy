"""
Debug command to test meeting generation
"""
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from schedule.models import MeetingConfiguration
from schedule.services.meeting_generation import MeetingGenerationService


class Command(BaseCommand):
    help = 'Debug meeting generation process'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days-ahead', 
            type=int, 
            default=90,
            help='Number of days ahead to generate meetings for (default: 90)'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🔍 DEBUG: Meeting Generation Analysis'))
        
        # Check configuration
        config = MeetingConfiguration.objects.first()
        if config:
            self.stdout.write(f"✅ Found MeetingConfiguration:")
            self.stdout.write(f"   - Day of week: {config.day_of_week} ({config.get_day_of_week_display()})")
            self.stdout.write(f"   - Start time: {config.start_time}")
            self.stdout.write(f"   - Active members: {config.active_members.count()}")
            self.stdout.write(f"   - Location: {config.location}")
        else:
            self.stdout.write(self.style.WARNING("⚠️ No MeetingConfiguration found"))
            
            # Create one
            admin_user = User.objects.filter(is_superuser=True).first()
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
                self.stdout.write(f"✅ Created MeetingConfiguration with {active_users.count()} active members")
            else:
                self.stdout.write(self.style.ERROR("❌ No admin user found, cannot create configuration"))
                return

        # Test date range
        today = date.today()
        start_date = today + timedelta(days=1)  # Tomorrow
        end_date = today + timedelta(days=options['days_ahead'])
        
        self.stdout.write(f"\n📅 Testing date range: {start_date} to {end_date}")
        
        # Test meeting generation
        service = MeetingGenerationService()
        
        try:
            result = service.generate_meetings(
                start_date=start_date,
                end_date=end_date,
                meeting_types=['research_update', 'journal_club'],
                auto_assign_presenters=True
            )
            
            self.stdout.write(f"\n🎯 Generation Results:")
            self.stdout.write(f"   - Generated meetings: {result['count']}")
            self.stdout.write(f"   - Date range: {result['start_date']} to {result['end_date']}")
            
            if result['generated_meetings']:
                self.stdout.write(f"\n📋 Generated meetings:")
                for meeting in result['generated_meetings']:
                    presenters = meeting.presenters.all()
                    presenter_names = [f"{p.user.first_name} {p.user.last_name}" for p in presenters]
                    self.stdout.write(f"   - {meeting.date} ({meeting.meeting_type}): {', '.join(presenter_names) if presenter_names else 'No presenters'}")
            else:
                self.stdout.write(self.style.WARNING("⚠️ No meetings were generated"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error during generation: {e}"))
            import traceback
            self.stdout.write(traceback.format_exc())

        self.stdout.write(self.style.SUCCESS('\n✅ Debug completed'))