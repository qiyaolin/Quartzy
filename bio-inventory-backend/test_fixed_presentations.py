#!/usr/bin/env python
"""
Test the fixed presentation count logic
"""
import os
import django
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from schedule.models import MeetingInstance, Presenter
from django.contrib.auth.models import User
from schedule.views import UnifiedDashboardViewSet

def test_fixed_presentations():
    """Test the fixed presentation count"""
    
    print("=== Testing Fixed Presentation Count ===\n")
    
    # Test with a sample user
    users = User.objects.filter(presentations__isnull=False).distinct()
    if not users.exists():
        print("No users with presentations found")
        return
    
    test_user = users.first()
    print(f"Testing with user: {test_user.username}\n")
    
    # Create mock request object
    class MockRequest:
        def __init__(self, user):
            self.user = user
    
    request = MockRequest(test_user)
    
    # Test the dashboard viewset
    dashboard = UnifiedDashboardViewSet()
    stats = dashboard._get_user_stats(test_user)
    
    print("User Statistics:")
    print(f"  Total presentations: {stats['presentations_total']}")
    print(f"  This year presentations: {stats['presentations_this_year']}")
    print(f"  Tasks completed: {stats['tasks_completed_this_year']}")
    print(f"  Equipment hours: {stats['equipment_hours_this_month']}")
    print(f"  Active bookings: {stats['active_bookings']}")
    print(f"  Pending swap requests: {stats['pending_swap_requests']}")
    
    print(f"\n=== Verification ===")
    
    # Manual count for verification
    total_presentations = Presenter.objects.filter(
        user=test_user
    ).exclude(
        status__in=['swapped', 'postponed']
    ).count()
    
    current_year = timezone.now().year
    this_year_presentations = Presenter.objects.filter(
        user=test_user,
        meeting_instance__date__year=current_year
    ).exclude(
        status__in=['swapped', 'postponed']
    ).count()
    
    print(f"Manual count - Total presentations: {total_presentations}")
    print(f"Manual count - This year presentations: {this_year_presentations}")
    
    if stats['presentations_total'] == total_presentations:
        print("SUCCESS: Total presentations count is CORRECT")
    else:
        print("ERROR: Total presentations count is INCORRECT")
    
    if stats['presentations_this_year'] == this_year_presentations:
        print("SUCCESS: This year presentations count is CORRECT")  
    else:
        print("ERROR: This year presentations count is INCORRECT")
    
    # Show presenter details
    print(f"\n=== Presenter Details for {test_user.username} ===")
    presenters = Presenter.objects.filter(user=test_user).order_by('meeting_instance__date')
    for presenter in presenters:
        meeting = presenter.meeting_instance
        print(f"  {meeting.date} - {meeting.meeting_type} - Status: {presenter.status}")

if __name__ == '__main__':
    test_fixed_presentations()