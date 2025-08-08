"""
Django management command to fix MeetingPresenterRotation data type issues
修复MeetingPresenterRotation数据类型问题的Django管理命令

Usage: python manage.py fix_presenter_rotation
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User
from schedule.models import MeetingPresenterRotation


class Command(BaseCommand):
    help = 'Fix MeetingPresenterRotation data type issues that cause "list indices must be integers" error'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )
        parser.add_argument(
            '--create-test',
            action='store_true',
            help='Create a test rotation if none exists',
        )
    
    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Starting MeetingPresenterRotation data fix...')
        )
        
        dry_run = options['dry_run']
        create_test = options['create_test']
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('🔍 DRY RUN MODE - No changes will be made')
            )
        
        try:
            # Create test rotation if requested
            if create_test:
                self.create_test_rotation(dry_run)
            
            # Fix existing data
            fixed_count, error_count = self.fix_rotation_data(dry_run)
            
            # Test functionality
            if not dry_run:
                self.test_functionality()
            
            # Summary
            self.stdout.write('\n' + '=' * 60)
            self.stdout.write(
                self.style.SUCCESS('🎉 Fix completed!')
            )
            
            if fixed_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Fixed {fixed_count} rotation records')
                )
            
            if error_count > 0:
                self.stdout.write(
                    self.style.WARNING(f'⚠️  {error_count} errors encountered')
                )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Critical error: {e}')
            )
            raise
    
    def create_test_rotation(self, dry_run=False):
        """Create a test rotation if none exists"""
        
        if MeetingPresenterRotation.objects.exists():
            self.stdout.write('ℹ️  Rotations already exist, skipping test creation')
            return
        
        self.stdout.write('🔧 Creating test rotation...')
        
        # Get some users for testing
        users = User.objects.filter(is_active=True)[:3]
        
        if not users.exists():
            self.stdout.write(
                self.style.WARNING('⚠️  No active users found, cannot create test rotation')
            )
            return
        
        if dry_run:
            self.stdout.write(
                f'   Would create test rotation with {users.count()} users'
            )
            return
        
        # Create test rotation
        rotation = MeetingPresenterRotation.objects.create(
            name="Default Lab Rotation",
            next_presenter_index=0,
            is_active=True
        )
        
        # Add users to rotation
        rotation.user_list.set(users)
        
        self.stdout.write(
            self.style.SUCCESS(f'   ✅ Created test rotation with {users.count()} users')
        )
        
        return rotation
    
    def fix_rotation_data(self, dry_run=False):
        """Fix data type issues in MeetingPresenterRotation model"""
        
        self.stdout.write('🔍 Checking MeetingPresenterRotation data...')
        
        # Get all rotation records
        rotations = MeetingPresenterRotation.objects.all()
        
        if not rotations.exists():
            self.stdout.write('ℹ️  No MeetingPresenterRotation records found.')
            return 0, 0
        
        fixed_count = 0
        error_count = 0
        
        with transaction.atomic():
            for rotation in rotations:
                try:
                    self.stdout.write(f'\n📋 Processing rotation: {rotation.name}')
                    self.stdout.write(
                        f'   Current next_presenter_index: {rotation.next_presenter_index} '
                        f'(type: {type(rotation.next_presenter_index).__name__})'
                    )
                    
                    # Get user count
                    user_count = rotation.user_list.count()
                    self.stdout.write(f'   User count in rotation: {user_count}')
                    
                    # Fix next_presenter_index if it's not an integer or out of bounds
                    original_index = rotation.next_presenter_index
                    
                    # Ensure it's an integer
                    try:
                        index = int(rotation.next_presenter_index)
                    except (ValueError, TypeError):
                        self.stdout.write('   ⚠️  Invalid index type, resetting to 0')
                        index = 0
                    
                    # Ensure it's within bounds
                    if user_count > 0 and index >= user_count:
                        self.stdout.write(
                            f'   ⚠️  Index {index} >= user_count {user_count}, resetting to 0'
                        )
                        index = 0
                    elif user_count == 0:
                        self.stdout.write('   ⚠️  No users in rotation, setting index to 0')
                        index = 0
                    
                    # Update if changed
                    if rotation.next_presenter_index != index:
                        if dry_run:
                            self.stdout.write(f'   Would fix: {original_index} -> {index}')
                        else:
                            rotation.next_presenter_index = index
                            rotation.save()
                            self.stdout.write(
                                self.style.SUCCESS(f'   ✅ Fixed: {original_index} -> {index}')
                            )
                        fixed_count += 1
                    else:
                        self.stdout.write(
                            self.style.SUCCESS(f'   ✅ Already correct: {index}')
                        )
                    
                    # Test the get_next_presenter method
                    if not dry_run:
                        try:
                            next_presenter = rotation.get_next_presenter()
                            if next_presenter:
                                self.stdout.write(f'   👤 Next presenter: {next_presenter.username}')
                            else:
                                self.stdout.write('   👤 Next presenter: None (no users in rotation)')
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(f'   ❌ Error testing get_next_presenter: {e}')
                            )
                            error_count += 1
                
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'   ❌ Error processing rotation {rotation.id}: {e}')
                    )
                    error_count += 1
        
        self.stdout.write(f'\n📊 Summary:')
        self.stdout.write(f'   Total rotations processed: {rotations.count()}')
        self.stdout.write(f'   Fixed rotations: {fixed_count}')
        self.stdout.write(f'   Errors encountered: {error_count}')
        
        return fixed_count, error_count
    
    def test_functionality(self):
        """Test the auto-generate meetings functionality"""
        
        self.stdout.write('\n🧪 Testing auto-generate meetings functionality...')
        
        try:
            from schedule.services.meeting_generation import MeetingGenerationService
            from datetime import date, timedelta
            
            service = MeetingGenerationService()
            
            # Test with a small date range
            start_date = date.today()
            end_date = start_date + timedelta(days=30)
            
            self.stdout.write(f'   Testing date range: {start_date} to {end_date}')
            
            # Test the generation (preview mode)
            result = service.preview_meeting_generation(
                start_date=start_date,
                end_date=end_date,
                meeting_types=['research_update']
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'   ✅ Test successful! Would generate {result["total_meetings"]} meetings'
                )
            )
            
            return True
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'   ❌ Test failed: {e}')
            )
            import traceback
            self.stdout.write(traceback.format_exc())
            return False