"""
Django management command to manage task rotation queue members
Usage: python manage.py manage_queue_members --add-user john --queue-id 1
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from schedule.models import TaskTemplate, TaskRotationQueue, QueueMember
from schedule.services.fair_rotation import FairRotationService


class Command(BaseCommand):
    help = 'Manage task rotation queue memberships'
    
    def add_arguments(self, parser):
        # Queue selection
        parser.add_argument(
            '--queue-id',
            type=int,
            help='Specific queue ID to manage'
        )
        parser.add_argument(
            '--template-id',
            type=int,
            help='Template ID to manage its queue'
        )
        parser.add_argument(
            '--template-name',
            type=str,
            help='Template name to manage its queue'
        )
        
        # User management
        parser.add_argument(
            '--add-user',
            type=str,
            help='Username to add to queue(s)'
        )
        parser.add_argument(
            '--remove-user',
            type=str,
            help='Username to remove from queue(s)'
        )
        parser.add_argument(
            '--activate-user',
            type=str,
            help='Username to activate in queue(s)'
        )
        parser.add_argument(
            '--deactivate-user',
            type=str,
            help='Username to deactivate in queue(s)'
        )
        
        # Bulk operations
        parser.add_argument(
            '--sync-all-users',
            action='store_true',
            help='Add all active users to all queues'
        )
        parser.add_argument(
            '--list-members',
            action='store_true',
            help='List current queue members'
        )
        parser.add_argument(
            '--reset-statistics',
            action='store_true',
            help='Reset all member statistics'
        )
        
        # Options
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed information'
        )
    
    def handle(self, *args, **options):
        # Get queues to manage
        queues = self._get_queues(options)
        
        if not queues:
            self.stdout.write(
                self.style.ERROR("No queues found. Please specify queue criteria.")
            )
            return
        
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )
        
        # Execute requested operations
        if options['add_user']:
            self._add_user_to_queues(options['add_user'], queues, options)
        elif options['remove_user']:
            self._remove_user_from_queues(options['remove_user'], queues, options)
        elif options['activate_user']:
            self._activate_user_in_queues(options['activate_user'], queues, options)
        elif options['deactivate_user']:
            self._deactivate_user_in_queues(options['deactivate_user'], queues, options)
        elif options['sync_all_users']:
            self._sync_all_users_to_queues(queues, options)
        elif options['list_members']:
            self._list_queue_members(queues, options)
        elif options['reset_statistics']:
            self._reset_member_statistics(queues, options)
        else:
            self.stdout.write(
                self.style.ERROR(
                    "Please specify an operation: --add-user, --remove-user, "
                    "--activate-user, --deactivate-user, --sync-all-users, "
                    "--list-members, or --reset-statistics"
                )
            )
    
    def _get_queues(self, options):
        """Get queues based on command options"""
        queues = []
        
        if options['queue_id']:
            try:
                queue = TaskRotationQueue.objects.get(id=options['queue_id'])
                queues.append(queue)
            except TaskRotationQueue.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"Queue with ID {options['queue_id']} not found.")
                )
        
        elif options['template_id']:
            try:
                template = TaskTemplate.objects.get(id=options['template_id'])
                queue, created = TaskRotationQueue.objects.get_or_create(
                    template=template,
                    defaults={
                        'algorithm': 'fair_rotation',
                        'min_gap_months': 2,
                        'consider_workload': True,
                        'random_factor': 0.1
                    }
                )
                queues.append(queue)
                if created:
                    self.stdout.write(f"Created new queue for template: {template.name}")
            except TaskTemplate.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"Template with ID {options['template_id']} not found.")
                )
        
        elif options['template_name']:
            try:
                template = TaskTemplate.objects.get(name=options['template_name'])
                queue, created = TaskRotationQueue.objects.get_or_create(
                    template=template,
                    defaults={
                        'algorithm': 'fair_rotation',
                        'min_gap_months': 2,
                        'consider_workload': True,
                        'random_factor': 0.1
                    }
                )
                queues.append(queue)
                if created:
                    self.stdout.write(f"Created new queue for template: {template.name}")
            except TaskTemplate.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"Template with name '{options['template_name']}' not found.")
                )
        
        else:
            # No specific queue specified - use all queues for some operations
            if options['sync_all_users'] or options['list_members'] or options['reset_statistics']:
                queues = list(TaskRotationQueue.objects.all())
        
        return queues
    
    def _add_user_to_queues(self, username, queues, options):
        """Add user to specified queues"""
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"User '{username}' not found.")
            )
            return
        
        added_count = 0
        
        for queue in queues:
            existing_member = queue.queue_members.filter(user=user).first()
            
            if existing_member:
                if existing_member.is_active:
                    self.stdout.write(
                        self.style.WARNING(
                            f"User {username} is already active in queue: {queue.template.name}"
                        )
                    )
                else:
                    if not options['dry_run']:
                        existing_member.is_active = True
                        existing_member.save()
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"{'Would reactivate' if options['dry_run'] else 'Reactivated'} "
                            f"user {username} in queue: {queue.template.name}"
                        )
                    )
                    added_count += 1
            else:
                if not options['dry_run']:
                    QueueMember.objects.create(
                        queue=queue,
                        user=user,
                        is_active=True,
                        total_assignments=0,
                        completion_rate=0.0,
                        average_completion_time=0.0,
                        priority_score=100.0,  # Default starting priority
                        availability_data={}
                    )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{'Would add' if options['dry_run'] else 'Added'} "
                        f"user {username} to queue: {queue.template.name}"
                    )
                )
                added_count += 1
        
        if added_count > 0 and not options['dry_run']:
            # Recalculate priorities after adding members
            rotation_service = FairRotationService()
            for queue in queues:
                rotation_service._recalculate_queue_priorities(queue)
        
        self.stdout.write(f"Total operations: {added_count}")
    
    def _remove_user_from_queues(self, username, queues, options):
        """Remove user from specified queues"""
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"User '{username}' not found.")
            )
            return
        
        removed_count = 0
        
        for queue in queues:
            member = queue.queue_members.filter(user=user).first()
            
            if member:
                if not options['dry_run']:
                    member.delete()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{'Would remove' if options['dry_run'] else 'Removed'} "
                        f"user {username} from queue: {queue.template.name}"
                    )
                )
                removed_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"User {username} is not in queue: {queue.template.name}"
                    )
                )
        
        self.stdout.write(f"Total operations: {removed_count}")
    
    def _activate_user_in_queues(self, username, queues, options):
        """Activate user in specified queues"""
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"User '{username}' not found.")
            )
            return
        
        activated_count = 0
        
        for queue in queues:
            member = queue.queue_members.filter(user=user).first()
            
            if member:
                if member.is_active:
                    self.stdout.write(
                        self.style.WARNING(
                            f"User {username} is already active in queue: {queue.template.name}"
                        )
                    )
                else:
                    if not options['dry_run']:
                        member.is_active = True
                        member.save()
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"{'Would activate' if options['dry_run'] else 'Activated'} "
                            f"user {username} in queue: {queue.template.name}"
                        )
                    )
                    activated_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"User {username} is not in queue: {queue.template.name}"
                    )
                )
        
        self.stdout.write(f"Total operations: {activated_count}")
    
    def _deactivate_user_in_queues(self, username, queues, options):
        """Deactivate user in specified queues"""
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"User '{username}' not found.")
            )
            return
        
        deactivated_count = 0
        
        for queue in queues:
            member = queue.queue_members.filter(user=user).first()
            
            if member:
                if not member.is_active:
                    self.stdout.write(
                        self.style.WARNING(
                            f"User {username} is already inactive in queue: {queue.template.name}"
                        )
                    )
                else:
                    if not options['dry_run']:
                        member.is_active = False
                        member.save()
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"{'Would deactivate' if options['dry_run'] else 'Deactivated'} "
                            f"user {username} in queue: {queue.template.name}"
                        )
                    )
                    deactivated_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"User {username} is not in queue: {queue.template.name}"
                    )
                )
        
        self.stdout.write(f"Total operations: {deactivated_count}")
    
    def _sync_all_users_to_queues(self, queues, options):
        """Add all active users to all queues"""
        all_users = User.objects.filter(is_active=True)
        total_added = 0
        
        for queue in queues:
            self.stdout.write(f"\nSyncing queue: {queue.template.name}")
            
            for user in all_users:
                existing_member = queue.queue_members.filter(user=user).first()
                
                if not existing_member:
                    if not options['dry_run']:
                        QueueMember.objects.create(
                            queue=queue,
                            user=user,
                            is_active=True,
                            total_assignments=0,
                            completion_rate=0.0,
                            average_completion_time=0.0,
                            priority_score=100.0,
                            availability_data={}
                        )
                    
                    if options['verbose']:
                        self.stdout.write(f"  Added: {user.username}")
                    total_added += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would add' if options['dry_run'] else 'Added'} {total_added} user memberships"
            )
        )
    
    def _list_queue_members(self, queues, options):
        """List current queue members"""
        for queue in queues:
            self.stdout.write(f"\nQueue: {queue.template.name}")
            
            members = queue.queue_members.all().order_by('-is_active', '-priority_score')
            
            if not members.exists():
                self.stdout.write("  No members found")
                continue
            
            active_count = members.filter(is_active=True).count()
            inactive_count = members.filter(is_active=False).count()
            
            self.stdout.write(f"  Active members: {active_count}")
            self.stdout.write(f"  Inactive members: {inactive_count}")
            
            if options['verbose']:
                for member in members:
                    status = "✓" if member.is_active else "✗"
                    assignments = member.total_assignments
                    completion_rate = member.completion_rate * 100
                    priority = member.priority_score
                    
                    self.stdout.write(
                        f"    {status} {member.user.username} "
                        f"(assignments: {assignments}, "
                        f"completion: {completion_rate:.1f}%, "
                        f"priority: {priority:.1f})"
                    )
    
    def _reset_member_statistics(self, queues, options):
        """Reset all member statistics"""
        total_reset = 0
        
        for queue in queues:
            members = queue.queue_members.all()
            count = members.count()
            
            if count > 0:
                if not options['dry_run']:
                    members.update(
                        total_assignments=0,
                        last_assigned_date=None,
                        last_assigned_period=None,
                        completion_rate=0.0,
                        average_completion_time=0.0,
                        priority_score=100.0,
                        availability_data={}
                    )
                
                self.stdout.write(
                    f"{'Would reset' if options['dry_run'] else 'Reset'} "
                    f"{count} members in queue: {queue.template.name}"
                )
                total_reset += count
        
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would reset' if options['dry_run'] else 'Reset'} "
                f"{total_reset} member statistics"
            )
        )