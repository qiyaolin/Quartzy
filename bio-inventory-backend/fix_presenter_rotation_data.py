#!/usr/bin/env python3
"""
Fix MeetingPresenterRotation data type issues
修复MeetingPresenterRotation数据类型问题

This script fixes the 'list indices must be integers or slices, not str' error
by ensuring all next_presenter_index fields contain integer values.
"""

import os
import sys
import django
from django.db import transaction

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from schedule.models import MeetingPresenterRotation
from django.contrib.auth.models import User


def fix_presenter_rotation_data():
    """Fix data type issues in MeetingPresenterRotation model"""
    
    print("🔍 Checking MeetingPresenterRotation data...")
    
    # Get all rotation records
    rotations = MeetingPresenterRotation.objects.all()
    
    if not rotations.exists():
        print("ℹ️  No MeetingPresenterRotation records found.")
        return
    
    fixed_count = 0
    error_count = 0
    
    with transaction.atomic():
        for rotation in rotations:
            try:
                print(f"\n📋 Processing rotation: {rotation.name}")
                print(f"   Current next_presenter_index: {rotation.next_presenter_index} (type: {type(rotation.next_presenter_index)})")
                
                # Get user count
                user_count = rotation.user_list.count()
                print(f"   User count in rotation: {user_count}")
                
                # Fix next_presenter_index if it's not an integer or out of bounds
                original_index = rotation.next_presenter_index
                
                # Ensure it's an integer
                try:
                    index = int(rotation.next_presenter_index)
                except (ValueError, TypeError):
                    print(f"   ⚠️  Invalid index type, resetting to 0")
                    index = 0
                
                # Ensure it's within bounds
                if user_count > 0 and index >= user_count:
                    print(f"   ⚠️  Index {index} >= user_count {user_count}, resetting to 0")
                    index = 0
                elif user_count == 0:
                    print(f"   ⚠️  No users in rotation, setting index to 0")
                    index = 0
                
                # Update if changed
                if rotation.next_presenter_index != index:
                    rotation.next_presenter_index = index
                    rotation.save()
                    print(f"   ✅ Fixed: {original_index} -> {index}")
                    fixed_count += 1
                else:
                    print(f"   ✅ Already correct: {index}")
                
                # Test the get_next_presenter method
                try:
                    next_presenter = rotation.get_next_presenter()
                    if next_presenter:
                        print(f"   👤 Next presenter: {next_presenter.username}")
                    else:
                        print(f"   👤 Next presenter: None (no users in rotation)")
                except Exception as e:
                    print(f"   ❌ Error testing get_next_presenter: {e}")
                    error_count += 1
                
            except Exception as e:
                print(f"   ❌ Error processing rotation {rotation.id}: {e}")
                error_count += 1
    
    print(f"\n📊 Summary:")
    print(f"   Total rotations processed: {rotations.count()}")
    print(f"   Fixed rotations: {fixed_count}")
    print(f"   Errors encountered: {error_count}")
    
    return fixed_count, error_count


def create_test_rotation_if_needed():
    """Create a test rotation if none exists"""
    
    if MeetingPresenterRotation.objects.exists():
        return
    
    print("\n🔧 Creating test rotation...")
    
    # Get some users for testing
    users = User.objects.filter(is_active=True)[:3]
    
    if not users.exists():
        print("   ⚠️  No active users found, cannot create test rotation")
        return
    
    # Create test rotation
    rotation = MeetingPresenterRotation.objects.create(
        name="Test Rotation",
        next_presenter_index=0,
        is_active=True
    )
    
    # Add users to rotation
    rotation.user_list.set(users)
    
    print(f"   ✅ Created test rotation with {users.count()} users")
    
    return rotation


def test_auto_generate_meetings():
    """Test the auto-generate meetings functionality"""
    
    print("\n🧪 Testing auto-generate meetings functionality...")
    
    try:
        from schedule.services.meeting_generation import MeetingGenerationService
        from datetime import date, timedelta
        
        service = MeetingGenerationService()
        
        # Test with a small date range
        start_date = date.today()
        end_date = start_date + timedelta(days=30)
        
        print(f"   Testing date range: {start_date} to {end_date}")
        
        # Test the preview functionality first (safer)
        try:
            preview_result = service.preview_meeting_generation(
                start_date=start_date,
                end_date=end_date,
                meeting_types=['research_update']
            )
            
            print(f"   ✅ Preview test successful! Would generate {preview_result['total_meetings']} meetings")
            return True
            
        except Exception as preview_error:
            print(f"   ⚠️  Preview failed: {preview_error}, trying direct generation...")
            
            # Fallback to direct generation test
            result = service.generate_meetings(
                start_date=start_date,
                end_date=end_date,
                meeting_types=['research_update'],
                auto_assign_presenters=True
            )
            
            print(f"   ✅ Generation test successful! Generated {len(result)} meetings")
            return True
        
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        import traceback
        print(f"   Error details: {traceback.format_exc()}")
        return False


def main():
    """Main execution function"""
    
    print("🚀 Starting MeetingPresenterRotation data fix...")
    print("=" * 60)
    
    try:
        # Create test rotation if needed
        create_test_rotation_if_needed()
        
        # Fix existing data
        fixed_count, error_count = fix_presenter_rotation_data()
        
        # Test the functionality
        test_success = test_auto_generate_meetings()
        
        print("\n" + "=" * 60)
        print("🎉 Fix completed!")
        
        if fixed_count > 0:
            print(f"✅ Fixed {fixed_count} rotation records")
        
        if error_count > 0:
            print(f"⚠️  {error_count} errors encountered")
        
        if test_success:
            print("✅ Auto-generate meetings test passed")
        else:
            print("❌ Auto-generate meetings test failed")
        
        return error_count == 0 and test_success
        
    except Exception as e:
        print(f"\n❌ Critical error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)