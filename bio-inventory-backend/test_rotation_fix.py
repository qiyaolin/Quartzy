#!/usr/bin/env python
"""
Quick test script to verify rotation management fixes
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from schedule.models import MeetingConfiguration, RotationSystem, QueueEntry

def test_rotation_fix():
    """Test the rotation management fix"""
    print("Testing rotation management fix...")
    
    # 1. Test next_presenter_index type safety
    from schedule.models import MeetingPresenterRotation
    
    # Create test users
    test_users = []
    for i in range(3):
        username = f'test_user_{i}'
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': f'{username}@example.com', 'is_active': True}
        )
        test_users.append(user)
    
    # Create rotation with test users
    rotation, created = MeetingPresenterRotation.objects.get_or_create(
        name="Test Rotation",
        defaults={'next_presenter_index': 0}
    )
    rotation.user_list.set(test_users)
    
    # Test normal operation
    presenter = rotation.get_next_presenter()
    print(f"✓ Normal operation: Got presenter {presenter}")
    
    # Test with potential string index (simulate corrupted data)
    rotation.next_presenter_index = "1"  # This could happen due to serialization issues
    rotation.save()
    
    # This should not crash now
    try:
        presenter = rotation.get_next_presenter()
        print(f"✓ String index recovery: Got presenter {presenter}")
    except Exception as e:
        print(f"✗ String index test failed: {e}")
        return False
    
    # Test advance presenter with string index
    rotation.next_presenter_index = "2"
    rotation.save()
    
    try:
        rotation.advance_presenter()
        print(f"✓ Advance presenter with string index: Next index is {rotation.next_presenter_index}")
    except Exception as e:
        print(f"✗ Advance presenter test failed: {e}")
        return False
    
    print("All rotation tests passed!")
    return True

def test_meeting_generation():
    """Test meeting generation doesn't crash"""
    print("\nTesting meeting generation...")
    
    try:
        from schedule.services.meeting_generation import MeetingGenerationService
        from datetime import date, timedelta
        
        service = MeetingGenerationService()
        
        # Test basic generation
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=14)
        
        # This should not crash anymore
        meetings = service.generate_meetings(
            start_date=start_date,
            end_date=end_date,
            meeting_types=['research_update'],
            auto_assign_presenters=True
        )
        
        print(f"✓ Meeting generation successful: Generated {len(meetings)} meetings")
        return True
        
    except Exception as e:
        print(f"✗ Meeting generation test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_rotation_fix() and test_meeting_generation()
    if success:
        print("\n🎉 All tests passed! The fixes are working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please check the implementation.")
        sys.exit(1)