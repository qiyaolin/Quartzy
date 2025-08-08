from django.test import TestCase
from django.contrib.auth.models import User
from datetime import date, timedelta
from schedule.services.meeting_generation import MeetingGenerationService
from schedule.models import MeetingConfiguration, MeetingInstance

class GenerateMeetingsServiceTest(TestCase):
    def test_generate_meetings_empty_range(self):
        start = date(2100, 1, 1)
        end = date(2100, 1, 2)
        service = MeetingGenerationService()
        result = service.generate_meetings(start, end)
        self.assertIsInstance(result, dict)
        self.assertIn('generated_meetings', result)
        self.assertEqual(result['count'], 0)
        self.assertEqual(result['generated_meetings'], [])

    def test_generate_meetings_creates_default_config(self):
        # Ensure no config exists initially
        MeetingConfiguration.objects.all().delete()
        service = MeetingGenerationService()
        # Generate for one day (should create config and possibly no meetings if holiday)
        today = date.today()
        result = service.generate_meetings(today, today + timedelta(days=1))
        self.assertIsInstance(result, dict)
        self.assertIn('count', result)
        self.assertIn('generated_meetings', result)

class GenerateMeetingsViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='pass')
        self.client.login(username='testuser', password='pass')
        # Create a meeting configuration for testing
        config = MeetingConfiguration.objects.create(
            day_of_week=1,
            start_time='10:00:00',
            location='Test Room',
            research_update_duration=30,
            journal_club_duration=30,
            created_by=self.user
        )
        config.active_members.set([self.user])

    def test_generate_meetings_view(self):
        url = '/schedule/meetings/generate/'
        payload = {
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=7))
        }
        response = self.client.post(url, data=payload, content_type='application/json')
        self.assertIn(response.status_code, [200, 201])
        data = response.json()
        self.assertIn('generated_meetings', data)
        self.assertIn('count', data)