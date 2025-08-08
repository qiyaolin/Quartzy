#!/usr/bin/env python
"""
Check the actual dates of MeetingInstance objects
"""
import os
import django
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from schedule.models import MeetingInstance, Presenter

def check_meeting_dates():
    """Check the actual dates of meetings"""
    
    print("=== Meeting Date Analysis ===\n")
    
    meetings = MeetingInstance.objects.all().order_by('date')
    current_year = timezone.now().year
    
    print(f"Current year: {current_year}")
    print(f"Total meetings: {meetings.count()}\n")
    
    for meeting in meetings:
        presenters = meeting.presenters.all()
        print(f"Meeting {meeting.id}: {meeting.meeting_type}")
        print(f"  Date: {meeting.date} (Year: {meeting.date.year})")
        print(f"  Status: {meeting.status}")
        print(f"  Presenters: {presenters.count()}")
        for presenter in presenters:
            print(f"    - {presenter.user.username} (Status: {presenter.status})")
        print()

if __name__ == '__main__':
    check_meeting_dates()