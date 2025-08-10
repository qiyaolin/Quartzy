#!/usr/bin/env python3
"""
Create sample task data for testing the comprehensive task integration system
"""
import os
import sys
import django
from datetime import datetime, date, timedelta

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from schedule.models import TaskTemplate, PeriodicTaskInstance, TaskRotationQueue, QueueMember

def create_sample_data():
    """Create comprehensive sample data for task system testing"""
    
    print("Creating sample task data...")
    
    # Get or create admin user
    admin_user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'first_name': 'Admin',
            'last_name': 'User',
            'email': 'admin@example.com',
            'is_staff': True,
            'is_superuser': True
        }
    )
    
    # Get active users (excluding admin and print_server)
    users = User.objects.filter(is_active=True).exclude(
        username__in=['admin', 'print_server']
    )
    
    if not users.exists():
        # Create sample users if none exist
        sample_users = [
            {'username': 'alice', 'first_name': 'Alice', 'last_name': 'Johnson'},
            {'username': 'bob', 'first_name': 'Bob', 'last_name': 'Smith'},
            {'username': 'carol', 'first_name': 'Carol', 'last_name': 'Davis'},
            {'username': 'david', 'first_name': 'David', 'last_name': 'Wilson'},
        ]
        
        for user_data in sample_users:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'email': f"{user_data['username']}@example.com",
                    'is_active': True
                }
            )
            if created:
                print(f"Created user: {user.username}")
    
    users = User.objects.filter(is_active=True).exclude(
        username__in=['admin', 'print_server']
    )
    
    # Create recurring task templates
    recurring_templates = [
        {
            'name': 'Cell Culture Room Cleaning',
            'description': 'Weekly deep cleaning of the cell culture room including surfaces, equipment, and waste disposal',
            'task_type': 'recurring',
            'frequency': 'monthly',
            'interval': 1,
            'category': 'system',
            'default_people': 2,
            'min_people': 1,
            'max_people': 3,
            'estimated_hours': 3.0,
        },
        {
            'name': 'Incubator Maintenance',
            'description': 'Monthly maintenance of CO2 incubators including calibration and cleaning',
            'task_type': 'recurring',
            'frequency': 'monthly',
            'interval': 1,
            'category': 'system',
            'default_people': 1,
            'min_people': 1,
            'max_people': 2,
            'estimated_hours': 2.5,
        },
        {
            'name': 'Chemical Inventory Check',
            'description': 'Quarterly inventory check of all chemicals and reagents',
            'task_type': 'recurring',
            'frequency': 'quarterly',
            'interval': 1,
            'category': 'system',
            'default_people': 2,
            'min_people': 1,
            'max_people': 3,
            'estimated_hours': 4.0,
        },
    ]
    
    print("Creating recurring task templates...")
    templates_created = []
    
    for template_data in recurring_templates:
        template, created = TaskTemplate.objects.get_or_create(
            name=template_data['name'],
            defaults={
                **template_data,
                'start_date': timezone.now().date(),
                'is_active': True,
                'created_by': admin_user
            }
        )
        
        if created:
            print(f"Created template: {template.name}")
            templates_created.append(template)
            
            # Create rotation queue for each template
            rotation_queue = TaskRotationQueue.objects.create(
                template=template,
                algorithm='fair_rotation',
                min_gap_months=1,
                consider_workload=True,
                random_factor=0.2
            )
            
            # Add all users to rotation queue
            for user in users:
                QueueMember.objects.create(
                    rotation_queue=rotation_queue,
                    user=user,
                    is_active=True,
                    total_assignments=0,
                    completion_rate=95.0,
                    priority_score=50.0
                )
            
            print(f"Created rotation queue for {template.name} with {users.count()} members")
        else:
            print(f"Template already exists: {template.name}")
            templates_created.append(template)
    
    # Create one-time task templates and instances
    one_time_tasks = [
        {
            'template_name': 'Equipment Calibration Check',
            'description': 'Urgent calibration check for microscope equipment',
            'execution_days_from_now': 3,
        },
        {
            'template_name': 'Chemical Spill Cleanup',
            'description': 'Clean up minor chemical spill in storage area',
            'execution_days_from_now': 1,
        },
        {
            'template_name': 'Sample Processing',
            'description': 'Process urgent patient samples by end of week',
            'execution_days_from_now': 5,
        },
        {
            'template_name': 'Inventory Audit',
            'description': 'Audit inventory discrepancies found in last review',
            'execution_days_from_now': 7,
        },
    ]
    
    print("Creating one-time task instances...")
    
    for task_data in one_time_tasks:
        # Create one-time template
        template, created = TaskTemplate.objects.get_or_create(
            name=task_data['template_name'],
            task_type='one_time',
            defaults={
                'description': task_data['description'],
                'category': 'custom',
                'default_people': 1,
                'min_people': 1,
                'max_people': 1,
                'is_active': True,
                'created_by': admin_user
            }
        )
        
        # Create pending task instance
        execution_date = timezone.now().date() + timedelta(days=task_data['execution_days_from_now'])
        
        instance, created = PeriodicTaskInstance.objects.get_or_create(
            template=template,
            execution_start_date=timezone.now().date(),
            execution_end_date=execution_date,
            defaults={
                'template_name': task_data['template_name'],
                'status': 'pending',
                'scheduled_period': timezone.now().strftime('%Y-%m-W%U')
            }
        )
        
        if created:
            print(f"Created one-time task: {task_data['template_name']} (due: {execution_date})")
        else:
            print(f"One-time task already exists: {task_data['template_name']}")
    
    # Create some sample periodic task instances for recurring tasks
    print("Creating sample task instances for recurring tasks...")
    
    current_month = timezone.now().date().replace(day=1)
    next_month = (current_month + timedelta(days=32)).replace(day=1)
    
    for template in templates_created:
        if template.task_type == 'recurring':
            # Create instance for current month
            instance, created = PeriodicTaskInstance.objects.get_or_create(
                template=template,
                execution_start_date=current_month,
                execution_end_date=current_month + timedelta(days=30),
                defaults={
                    'template_name': template.name,
                    'status': 'scheduled',
                    'scheduled_period': current_month.strftime('%Y-%m')
                }
            )
            
            if created:
                print(f"Created current month instance: {template.name}")
            
            # Create instance for next month
            instance_next, created = PeriodicTaskInstance.objects.get_or_create(
                template=template,
                execution_start_date=next_month,
                execution_end_date=next_month + timedelta(days=30),
                defaults={
                    'template_name': template.name,
                    'status': 'scheduled',
                    'scheduled_period': next_month.strftime('%Y-%m')
                }
            )
            
            if created:
                print(f"Created next month instance: {template.name}")
    
    print("\nSample data creation completed!")
    print(f"Summary:")
    print(f"   - {TaskTemplate.objects.filter(task_type='recurring').count()} recurring task templates")
    print(f"   - {TaskTemplate.objects.filter(task_type='one_time').count()} one-time task templates")
    print(f"   - {PeriodicTaskInstance.objects.count()} task instances")
    print(f"   - {TaskRotationQueue.objects.count()} rotation queues")
    print(f"   - {QueueMember.objects.count()} queue members")
    print(f"   - {users.count()} active users available for assignment")
    
    print(f"\nTest the endpoints:")
    print(f"   - GET /api/schedule/recurring-tasks/ (should show {TaskTemplate.objects.filter(task_type='recurring').count()} recurring tasks)")
    print(f"   - GET /api/schedule/one-time-tasks/ (should show {TaskTemplate.objects.filter(task_type='one_time').count()} one-time tasks)")

if __name__ == "__main__":
    create_sample_data()