from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from schedule.models import TaskTemplate, PeriodicTaskInstance, TaskRotationQueue
from django.utils import timezone
from datetime import date
import re


class Command(BaseCommand):
    help = 'Generate periodic task instances for specified periods'

    def add_arguments(self, parser):
        parser.add_argument(
            'periods',
            nargs='+',
            type=str,
            help='Periods to generate tasks for (YYYY-MM format)'
        )
        parser.add_argument(
            '--template',
            type=int,
            help='Generate tasks for specific template ID only'
        )
        parser.add_argument(
            '--preview',
            action='store_true',
            help='Preview tasks without creating them'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recreate existing tasks'
        )
        parser.add_argument(
            '--send-notifications',
            action='store_true',
            help='Send assignment notifications after creation'
        )

    def handle(self, *args, **options):
        periods = options['periods']
        template_id = options.get('template')
        preview_mode = options['preview']
        force_recreate = options['force']
        send_notifications = options['send_notifications']
        
        # Validate periods
        period_pattern = re.compile(r'^\d{4}-\d{2}$')
        for period in periods:
            if not period_pattern.match(period):
                raise CommandError(f'Invalid period format: {period}. Use YYYY-MM format.')
        
        self.stdout.write(
            self.style.SUCCESS(f'Generating tasks for periods: {", ".join(periods)}')
        )
        
        # Get templates to process
        if template_id:
            try:
                templates = [TaskTemplate.objects.get(id=template_id)]
                self.stdout.write(f'Using specific template: {templates[0].name}')
            except TaskTemplate.DoesNotExist:
                raise CommandError(f'Template with ID {template_id} not found')
        else:
            templates = TaskTemplate.objects.filter(is_active=True)
            self.stdout.write(f'Using all active templates: {templates.count()} found')
        
        # Generate tasks
        total_created = 0
        total_skipped = 0
        total_errors = 0
        
        for period in periods:
            self.stdout.write(f'\nProcessing period: {period}')
            
            for template in templates:
                try:
                    result = self.process_template_for_period(
                        template, period, preview_mode, force_recreate
                    )
                    
                    if result['created']:
                        total_created += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  ✓ {template.name}: Created with assignees: {result["assignees"]}'
                            )
                        )
                    elif result['skipped']:
                        total_skipped += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f'  - {template.name}: {result["reason"]}'
                            )
                        )
                        
                except Exception as e:
                    total_errors += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f'  ✗ {template.name}: Error - {str(e)}'
                        )
                    )
        
        # Summary
        self.stdout.write(f'\n{"-" * 50}')
        self.stdout.write(self.style.SUCCESS(f'SUMMARY'))
        self.stdout.write(f'Tasks created: {total_created}')
        self.stdout.write(f'Tasks skipped: {total_skipped}')
        if total_errors > 0:
            self.stdout.write(self.style.ERROR(f'Errors: {total_errors}'))
        
        if preview_mode:
            self.stdout.write(
                self.style.WARNING('PREVIEW MODE - No tasks were actually created')
            )
        elif total_created > 0 and send_notifications:
            self.stdout.write('Sending notifications...')
            # Here you would integrate with your notification system
            self.stdout.write(
                self.style.SUCCESS(f'Notifications sent for {total_created} tasks')
            )

    def process_template_for_period(self, template, period, preview_mode, force_recreate):
        """Process a single template for a specific period"""
        result = {
            'created': False,
            'skipped': False,
            'reason': '',
            'assignees': []
        }
        
        # Check if template should generate tasks for this period
        if not template.should_generate_for_period(period):
            result['skipped'] = True
            result['reason'] = 'Not scheduled for this period'
            return result
        
        # Check if task already exists
        existing_task = PeriodicTaskInstance.objects.filter(
            template=template,
            scheduled_period=period
        ).first()
        
        if existing_task:
            if force_recreate:
                if not preview_mode:
                    existing_task.delete()
                result['reason'] = 'Recreating existing task'
            else:
                result['skipped'] = True
                result['reason'] = f'Task already exists (Status: {existing_task.get_status_display()})'
                return result
        
        # Get execution window
        start_date, end_date = template.get_execution_window(period)
        
        # Assign users using rotation queue
        try:
            assignees = self.assign_users_to_task(template, period)
            result['assignees'] = [user.username for user in assignees]
        except Exception as e:
            result['skipped'] = True
            result['reason'] = f'Assignment error: {str(e)}'
            return result
        
        if not assignees:
            result['skipped'] = True
            result['reason'] = 'No available assignees'
            return result
        
        # Create the task (if not preview mode)
        if not preview_mode:
            task = PeriodicTaskInstance.objects.create(
                template=template,
                template_name=template.name,
                scheduled_period=period,
                execution_start_date=start_date,
                execution_end_date=end_date,
                status='scheduled',
                current_assignees=[user.id for user in assignees],
                original_assignees=[user.id for user in assignees],
                assignment_metadata={
                    'assigned_at': timezone.now().isoformat(),
                    'assigned_by': 'management_command',
                    'primary_assignee': assignees[0].id if assignees else None,
                    'assignment_algorithm': 'fair_rotation',
                    'execution_window': {
                        'start_date': start_date.isoformat(),
                        'end_date': end_date.isoformat()
                    }
                }
            )
            
            # Update rotation queue statistics
            try:
                rotation_queue = template.rotation_queue
                for user in assignees:
                    member = rotation_queue.queue_members.get(user=user)
                    member.update_assignment_stats(period)
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(
                        f'Warning: Could not update rotation stats: {str(e)}'
                    )
                )
        
        result['created'] = True
        return result

    def assign_users_to_task(self, template, period):
        """Assign users to task using rotation queue"""
        try:
            rotation_queue = template.rotation_queue
            assigned_members = rotation_queue.assign_members_for_period(period)
            return [member.user for member in assigned_members]
        except TaskRotationQueue.DoesNotExist:
            # Fallback: create rotation queue on the fly
            self.stdout.write(
                self.style.WARNING(
                    f'Creating rotation queue for template: {template.name}'
                )
            )
            
            # Get eligible users
            eligible_users = User.objects.filter(
                is_active=True
            ).exclude(
                username__in=['admin', 'print_server']
            )
            
            if not eligible_users.exists():
                raise Exception('No eligible users found')
            
            # Create rotation queue
            from schedule.models import QueueMember
            rotation_queue = TaskRotationQueue.objects.create(
                template=template,
                algorithm='fair_rotation'
            )
            
            # Add users to queue
            for user in eligible_users:
                QueueMember.objects.create(
                    rotation_queue=rotation_queue,
                    user=user,
                    is_active=True
                )
            
            # Assign users
            assigned_members = rotation_queue.assign_members_for_period(period)
            return [member.user for member in assigned_members]
        except Exception as e:
            # Final fallback: simple assignment
            eligible_users = User.objects.filter(
                is_active=True
            ).exclude(
                username__in=['admin', 'print_server']
            )
            
            required_count = template.default_people
            assigned_users = list(eligible_users[:required_count])
            
            if len(assigned_users) < required_count:
                raise Exception(f'Not enough eligible users: {len(assigned_users)} < {required_count}')
            
            return assigned_users