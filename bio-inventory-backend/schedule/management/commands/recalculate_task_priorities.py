"""
Django management command to recalculate task rotation queue priorities
Usage: python manage.py recalculate_task_priorities --all --verbose
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, date
from schedule.models import TaskRotationQueue, QueueMember
from schedule.services.periodic_task_rotation import FairRotationService


class Command(BaseCommand):
    help = 'Recalculate priority scores for task rotation queues'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--queue-ids',
            type=str,
            help='Comma-separated list of queue IDs (default: all queues)'
        )
        parser.add_argument(
            '--template-ids',
            type=str,
            help='Comma-separated list of template IDs (processes their queues)'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all rotation queues'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed priority calculation information'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show new priorities without saving changes'
        )
        parser.add_argument(
            '--target-date',
            type=str,
            help='Target date for priority calculation (YYYY-MM-DD, default: today)'
        )
    
    def handle(self, *args, **options):
        # Parse target date
        if options['target_date']:
            try:
                target_date = datetime.strptime(options['target_date'], '%Y-%m-%d').date()
            except ValueError:
                self.stdout.write(
                    self.style.ERROR("Invalid date format. Use YYYY-MM-DD format.")
                )
                return
        else:
            target_date = date.today()
        
        # Get queues to process
        queues = self._get_queues_to_process(options)
        
        if not queues.exists():
            self.stdout.write(
                self.style.ERROR("No queues found to process.")
            )
            return
        
        self.stdout.write(f"Recalculating priorities for {queues.count()} queues")
        self.stdout.write(f"Target date: {target_date}")
        
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be saved")
            )
        
        rotation_service = FairRotationService()
        processed_queues = 0
        updated_members = 0
        errors = []
        
        for queue in queues:
            try:
                self.stdout.write(f"\nProcessing queue: {queue.template.name}")
                
                # Get all active members
                members = queue.queue_members.filter(is_active=True)
                
                if not members.exists():
                    self.stdout.write(
                        self.style.WARNING(f"  No active members found in queue")
                    )
                    continue
                
                member_updates = []
                
                for member in members:
                    # Calculate new priority
                    old_priority = member.priority_score
                    new_priority = rotation_service._calculate_member_priority(
                        member, target_date
                    )
                    
                    if options['verbose']:
                        self.stdout.write(
                            f"  - {member.user.username}: {old_priority:.2f} → {new_priority:.2f}"
                        )
                    
                    if not options['dry_run']:
                        member.priority_score = new_priority
                        member_updates.append(member)
                    
                    if abs(old_priority - new_priority) > 0.01:  # Only count significant changes
                        updated_members += 1
                
                # Bulk update members for efficiency
                if not options['dry_run'] and member_updates:
                    QueueMember.objects.bulk_update(
                        member_updates, 
                        ['priority_score'], 
                        batch_size=100
                    )
                    
                    # Update queue timestamp
                    queue.last_updated = timezone.now()
                    queue.save()
                
                processed_queues += 1
                
                if options['verbose']:
                    # Show current priority ranking
                    sorted_members = sorted(
                        members, 
                        key=lambda m: getattr(m, 'priority_score', 0), 
                        reverse=True
                    )
                    self.stdout.write(f"  Priority ranking:")
                    for i, member in enumerate(sorted_members[:5], 1):  # Top 5
                        priority = (
                            getattr(member, 'priority_score', 0) if options['dry_run'] 
                            else rotation_service._calculate_member_priority(member, target_date)
                        )
                        self.stdout.write(f"    {i}. {member.user.username} ({priority:.2f})")
                    
                    if len(sorted_members) > 5:
                        self.stdout.write(f"    ... and {len(sorted_members) - 5} more")
                
            except Exception as e:
                errors.append({
                    'queue': queue,
                    'error': str(e)
                })
                self.stdout.write(
                    self.style.ERROR(f"  Error processing queue: {e}")
                )
        
        # Display results summary
        self.stdout.write(f"\n{'=' * 50}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would process' if options['dry_run'] else 'Processed'} {processed_queues} queues"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if options['dry_run'] else 'Updated'} {updated_members} member priorities"
            )
        )
        
        if errors:
            self.stdout.write(
                self.style.ERROR(f"Encountered {len(errors)} errors:")
            )
            for item in errors:
                self.stdout.write(f"  - {item['queue'].template.name}: {item['error']}")
    
    def _get_queues_to_process(self, options):
        """Get queues based on command options"""
        if options['queue_ids']:
            try:
                queue_ids = [int(id.strip()) for id in options['queue_ids'].split(',')]
                return TaskRotationQueue.objects.filter(id__in=queue_ids)
            except ValueError:
                self.stdout.write(
                    self.style.ERROR("Invalid queue IDs. Use comma-separated integers.")
                )
                return TaskRotationQueue.objects.none()
        
        elif options['template_ids']:
            try:
                template_ids = [int(id.strip()) for id in options['template_ids'].split(',')]
                return TaskRotationQueue.objects.filter(template_id__in=template_ids)
            except ValueError:
                self.stdout.write(
                    self.style.ERROR("Invalid template IDs. Use comma-separated integers.")
                )
                return TaskRotationQueue.objects.none()
        
        elif options['all']:
            return TaskRotationQueue.objects.all()
        
        else:
            self.stdout.write(
                self.style.ERROR(
                    "Please specify --queue-ids, --template-ids, or --all option."
                )
            )
            return TaskRotationQueue.objects.none()