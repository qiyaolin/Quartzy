from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from schedule.models import TaskTemplate, TaskRotationQueue, QueueMember
from datetime import date


class Command(BaseCommand):
    help = 'Initialize periodic task system with default templates and rotation queues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force recreation of existing templates and queues',
        )

    def handle(self, *args, **options):
        force_recreate = options['force']
        
        self.stdout.write(self.style.SUCCESS('Initializing periodic task management system...'))
        
        # Create default admin user if needed
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'first_name': 'System',
                'last_name': 'Administrator',
                'email': 'admin@lab.example.com',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True
            }
        )
        if created:
            admin_user.set_password('admin123')  # Change in production
            admin_user.save()
            self.stdout.write(self.style.SUCCESS('Created admin user'))
        
        # Create system default task templates
        self.create_default_templates(admin_user, force_recreate)
        
        # Initialize rotation queues
        self.initialize_rotation_queues(force_recreate)
        
        self.stdout.write(self.style.SUCCESS('Periodic task management system initialized successfully!'))

    def create_default_templates(self, admin_user, force_recreate):
        """Create default system task templates"""
        
        default_templates = [
            {
                'name': 'Cell Culture Room Monthly Cleaning',
                'description': 'Comprehensive cleaning of cell culture room including work surfaces, floors, and walls',
                'task_type': 'recurring',
                'category': 'system',
                'frequency': 'monthly',
                'interval': 1,
                'start_date': date(2024, 1, 1),
                'min_people': 1,
                'max_people': 2,
                'default_people': 2,
                'estimated_hours': 2.0,
                'window_type': 'fixed',
                'fixed_start_day': 25,
                'fixed_end_day': 31,
                'priority': 'high',
                'is_active': True
            },
            {
                'name': 'Incubator Quarterly Cleaning',
                'description': 'Deep cleaning and disinfection of cell culture incubators',
                'task_type': 'recurring',
                'category': 'system',
                'frequency': 'quarterly',
                'interval': 1,
                'start_date': date(2024, 1, 1),
                'min_people': 1,
                'max_people': 1,
                'default_people': 1,
                'estimated_hours': 3.0,
                'window_type': 'fixed',
                'fixed_start_day': 25,
                'fixed_end_day': 31,
                'priority': 'high',
                'is_active': True
            },
            {
                'name': 'Biosafety Cabinet Monthly Maintenance',
                'description': 'Monthly maintenance and filter check of biosafety cabinets',
                'task_type': 'recurring',
                'category': 'system',
                'frequency': 'monthly',
                'interval': 1,
                'start_date': date(2024, 1, 1),
                'min_people': 1,
                'max_people': 1,
                'default_people': 1,
                'estimated_hours': 1.5,
                'window_type': 'flexible',
                'flexible_position': 'middle',
                'flexible_duration': 7,
                'priority': 'medium',
                'is_active': True
            },
            {
                'name': 'Lab Equipment Weekly Check',
                'description': 'Weekly safety and functionality check of laboratory equipment',
                'task_type': 'recurring',
                'category': 'system',
                'frequency': 'weekly',
                'interval': 1,
                'start_date': date(2024, 1, 1),
                'min_people': 1,
                'max_people': 1,
                'default_people': 1,
                'estimated_hours': 1.0,
                'window_type': 'flexible',
                'flexible_position': 'start',
                'flexible_duration': 3,
                'priority': 'medium',
                'is_active': True
            }
        ]
        
        created_count = 0
        updated_count = 0
        
        for template_data in default_templates:
            template_name = template_data['name']
            
            if force_recreate:
                # Delete existing template
                TaskTemplate.objects.filter(
                    name=template_name, 
                    category='system'
                ).delete()
            
            # Create or get template
            template, created = TaskTemplate.objects.get_or_create(
                name=template_name,
                category='system',
                defaults={
                    **template_data,
                    'created_by': admin_user
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created template: {template_name}')
                )
            else:
                # Update existing template
                for field, value in template_data.items():
                    if field not in ['name', 'category']:
                        setattr(template, field, value)
                template.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated template: {template_name}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Templates: {created_count} created, {updated_count} updated'
            )
        )

    def initialize_rotation_queues(self, force_recreate):
        """Initialize rotation queues for all active templates"""
        
        # Get all active users (excluding system users)
        eligible_users = User.objects.filter(
            is_active=True
        ).exclude(
            username__in=['admin', 'print_server']
        )
        
        if not eligible_users.exists():
            self.stdout.write(
                self.style.WARNING(
                    'No eligible users found. Please create user accounts first.'
                )
            )
            return
        
        # Get all active templates
        templates = TaskTemplate.objects.filter(is_active=True)
        created_queues = 0
        updated_queues = 0
        
        for template in templates:
            if force_recreate:
                # Delete existing queue and members
                TaskRotationQueue.objects.filter(template=template).delete()
            
            # Create or get rotation queue
            queue, created = TaskRotationQueue.objects.get_or_create(
                template=template,
                defaults={
                    'algorithm': 'fair_rotation',
                    'min_gap_months': 1,
                    'consider_workload': True,
                    'random_factor': 0.1
                }
            )
            
            if created:
                created_queues += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created rotation queue for: {template.name}')
                )
            else:
                updated_queues += 1
            
            # Add all eligible users to the queue
            members_added = 0
            for user in eligible_users:
                member, member_created = QueueMember.objects.get_or_create(
                    rotation_queue=queue,
                    user=user,
                    defaults={
                        'is_active': True,
                        'total_assignments': 0,
                        'completion_rate': 100.0,
                        'priority_score': 50.0,
                        'availability_data': {}
                    }
                )
                
                if member_created:
                    members_added += 1
            
            self.stdout.write(
                f'  - Added {members_added} members to queue for {template.name}'
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Rotation queues: {created_queues} created, {updated_queues} updated'
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'Total eligible users in system: {eligible_users.count()}'
            )
        )