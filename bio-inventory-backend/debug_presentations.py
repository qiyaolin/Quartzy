#!/usr/bin/env python
"""
Debug script to analyze presentation counts issue.
Checks the status of Presenter objects and MeetingInstance objects.
"""
import os
import django
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from schedule.models import MeetingInstance, Presenter
from django.contrib.auth.models import User

def analyze_presentation_data():
    """Analyze presentation data to understand count discrepancy"""
    
    print("=== Presentation Count Analysis ===\n")
    
    # Check total MeetingInstances
    total_meetings = MeetingInstance.objects.count()
    print(f"Total MeetingInstance objects: {total_meetings}")
    
    # Check MeetingInstances by year
    current_year = timezone.now().year
    this_year_meetings = MeetingInstance.objects.filter(date__year=current_year).count()
    print(f"MeetingInstances for {current_year}: {this_year_meetings}")
    
    print("\n--- Meeting Details ---")
    meetings = MeetingInstance.objects.filter(date__year=current_year).order_by('date')
    for meeting in meetings:
        print(f"Meeting {meeting.id}: {meeting.meeting_type} on {meeting.date} - Status: {meeting.status}")
        
        # Check presenters for this meeting
        presenters = meeting.presenters.all()
        print(f"  Presenters count: {presenters.count()}")
        for presenter in presenters:
            print(f"    - {presenter.user.username} (Status: {presenter.status})")
    
    print("\n=== Presenter Analysis ===")
    
    # Check total Presenters
    total_presenters = Presenter.objects.count()
    print(f"Total Presenter objects: {total_presenters}")
    
    # Check Presenters by status
    print("\nPresenters by status:")
    for status_code, status_name in Presenter.STATUS_CHOICES:
        count = Presenter.objects.filter(status=status_code).count()
        print(f"  {status_name} ({status_code}): {count}")
    
    # Check Presenters for current year
    this_year_presenters = Presenter.objects.filter(meeting_instance__date__year=current_year).count()
    print(f"\nPresenters for {current_year}: {this_year_presenters}")
    
    # Check completed presentations specifically
    completed_this_year = Presenter.objects.filter(
        meeting_instance__date__year=current_year,
        status='completed'
    ).count()
    print(f"Completed presentations for {current_year}: {completed_this_year}")
    
    print("\n=== User-specific Analysis ===")
    
    # Check for each user
    users_with_presentations = User.objects.filter(presentations__isnull=False).distinct()
    print(f"Users with presentation records: {users_with_presentations.count()}")
    
    for user in users_with_presentations:
        user_presentations_total = user.presentations.count()
        user_presentations_this_year = user.presentations.filter(meeting_instance__date__year=current_year).count()
        user_completed_this_year = user.presentations.filter(
            meeting_instance__date__year=current_year,
            status='completed'
        ).count()
        
        print(f"User {user.username}:")
        print(f"  Total presentations: {user_presentations_total}")
        print(f"  This year: {user_presentations_this_year}")
        print(f"  Completed this year: {user_completed_this_year}")
    
    print("\n=== Recommendation ===")
    
    # Check what statuses are actually being used
    actual_statuses = set(Presenter.objects.values_list('status', flat=True))
    print(f"Actual presenter statuses in use: {actual_statuses}")
    
    # Check if we should count other statuses
    non_completed_count = Presenter.objects.filter(
        meeting_instance__date__year=current_year
    ).exclude(status='completed').count()
    
    if non_completed_count > 0:
        print(f"\nSuggestion: There are {non_completed_count} presentations this year that are not 'completed'.")
        print("Consider changing the dashboard logic to count 'confirmed' or other statuses as presentations.")
        
        # Show breakdown by status for this year
        print("\nThis year's presentations by status:")
        for status_code, status_name in Presenter.STATUS_CHOICES:
            count = Presenter.objects.filter(
                meeting_instance__date__year=current_year,
                status=status_code
            ).count()
            if count > 0:
                print(f"  {status_name} ({status_code}): {count}")

if __name__ == '__main__':
    analyze_presentation_data()