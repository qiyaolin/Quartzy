"""
Django management command to create sample schedule data for testing
Usage: python manage.py create_sample_schedules
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth.models import User
from datetime import datetime, timedelta
from schedule.models import Event, Equipment


class Command(BaseCommand):
    help = 'Create sample schedule data for testing calendar views'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-existing',
            action='store_true',
            help='Clear existing events before creating new ones'
        )
        parser.add_argument(
            '--days-ahead',
            type=int,
            default=30,
            help='Number of days ahead to create events for (default: 30)'
        )
    
    def handle(self, *args, **options):
        if options['clear_existing']:
            Event.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared existing events"))
        
        # Get or create a test user
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={
                'email': 'test@example.com',
                'first_name': 'Test',
                'last_name': 'User'
            }
        )
        if created:
            user.set_password('testpass123')
            user.save()
            self.stdout.write(f"Created test user: {user.username}")
        
        # Create sample events
        base_date = timezone.now().date()
        events_created = 0
        
        for i in range(options['days_ahead']):
            current_date = base_date + timedelta(days=i)
            
            # Skip weekends for most meetings
            if current_date.weekday() >= 5:
                continue
            
            # Create different types of events
            events_to_create = []
            
            if i % 7 == 0:  # Weekly team meeting
                events_to_create.append({
                    'title': 'Team Meeting',
                    'description': 'Weekly team sync and status update',
                    'start_hour': 9,
                    'duration_hours': 1,
                    'event_type': 'meeting'
                })
            
            if i % 14 == 3:  # Bi-weekly journal club
                events_to_create.append({
                    'title': 'Journal Club',
                    'description': 'Discussion of recent research papers',
                    'start_hour': 14,
                    'duration_hours': 1.5,
                    'event_type': 'meeting'
                })
            
            if i % 10 == 2:  # Equipment maintenance
                events_to_create.append({
                    'title': 'Equipment Maintenance',
                    'description': 'Scheduled maintenance and calibration',
                    'start_hour': 16,
                    'duration_hours': 2,
                    'event_type': 'task'
                })
            
            if i % 5 == 1:  # Lab booking
                events_to_create.append({
                    'title': 'Lab Experiment',
                    'description': 'Planned experimental work',
                    'start_hour': 10,
                    'duration_hours': 4,
                    'event_type': 'booking'
                })
            
            # Create the events
            for event_data in events_to_create:
                start_time = timezone.make_aware(
                    datetime.combine(
                        current_date, 
                        datetime.min.time().replace(hour=event_data['start_hour'])
                    )
                )
                end_time = start_time + timedelta(hours=event_data['duration_hours'])
                
                Event.objects.create(
                    title=event_data['title'],
                    description=event_data['description'],
                    start_time=start_time,
                    end_time=end_time,
                    event_type=event_data['event_type'],
                    created_by=user
                )
                events_created += 1
        
        # Create some sample equipment if not exists
        equipment_data = [
            {
                'name': 'Microscope A',
                'location': 'Lab Room 101',
                'description': 'High-resolution optical microscope',
                'is_bookable': True,
                'requires_qr_checkin': True
            },
            {
                'name': 'Centrifuge B',
                'location': 'Lab Room 102', 
                'description': 'High-speed centrifuge for sample preparation',
                'is_bookable': True,
                'requires_qr_checkin': False
            },
            {
                'name': 'PCR Machine C',
                'location': 'Lab Room 103',
                'description': 'Thermal cycler for PCR amplification',
                'is_bookable': True,
                'requires_qr_checkin': True
            }
        ]
        
        equipment_created = 0
        for eq_data in equipment_data:
            equipment, created = Equipment.objects.get_or_create(
                name=eq_data['name'],
                defaults=eq_data
            )
            if created:
                equipment_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created {events_created} events and {equipment_created} equipment items"
            )
        )
        self.stdout.write(f"Events span {options['days_ahead']} days starting from today")
        
        # Show event type breakdown
        event_counts = {}
        for event in Event.objects.all():
            event_type = event.get_event_type_display()
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        
        self.stdout.write("Event breakdown:")
        for event_type, count in event_counts.items():
            self.stdout.write(f"  - {event_type}: {count}")