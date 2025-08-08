"""
List all MeetingInstance objects for debugging
"""
from django.core.management.base import BaseCommand
from schedule.models import MeetingInstance, Presenter


class Command(BaseCommand):
    help = 'List all MeetingInstance objects for debugging frontend sync issues'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('📋 MEETING INSTANCES DEBUG'))
        
        meetings = MeetingInstance.objects.all().order_by('-date')
        
        if not meetings.exists():
            self.stdout.write(self.style.WARNING("⚠️ No MeetingInstance objects found"))
            return

        self.stdout.write(f"✅ Found {meetings.count()} MeetingInstance objects:")
        
        for meeting in meetings:
            presenters = meeting.presenters.all()
            presenter_names = [f"{p.user.first_name} {p.user.last_name} ({p.user.username})" for p in presenters]
            
            self.stdout.write(f"\n📅 Meeting ID: {meeting.id}")
            self.stdout.write(f"   - Date: {meeting.date}")
            self.stdout.write(f"   - Type: {meeting.meeting_type}")
            self.stdout.write(f"   - Status: {meeting.status}")
            self.stdout.write(f"   - Presenters: {', '.join(presenter_names) if presenter_names else 'None'}")
            
            if hasattr(meeting, 'event') and meeting.event:
                self.stdout.write(f"   - Event: {meeting.event.title}")
                self.stdout.write(f"   - Start: {meeting.event.start_time}")
                self.stdout.write(f"   - End: {meeting.event.end_time}")
            
        self.stdout.write(self.style.SUCCESS('\n✅ Debug completed'))
        
        # Also check the API endpoint structure
        from django.urls import reverse
        from django.test import RequestFactory
        from django.contrib.auth.models import User
        from rest_framework.authtoken.models import Token
        
        self.stdout.write(f"\n🔍 API ENDPOINT TESTING")
        
        # Get a user with token
        user = User.objects.filter(is_superuser=True).first()
        if user:
            token, created = Token.objects.get_or_create(user=user)
            self.stdout.write(f"✅ Test token available for user: {user.username}")
            self.stdout.write(f"   Token: {token.key[:10]}...")
            self.stdout.write(f"   API endpoint: /api/schedule/meetings/")
        else:
            self.stdout.write(self.style.WARNING("⚠️ No superuser found for API testing"))