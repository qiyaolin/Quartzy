from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Event, Equipment, Booking, GroupMeeting, MeetingPresenterRotation, RecurringTask, TaskInstance


class EventModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
    
    def test_event_creation(self):
        """测试事件创建"""
        event = Event.objects.create(
            title='Test Event',
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
            event_type='meeting',
            description='Test description',
            created_by=self.user
        )
        self.assertEqual(event.title, 'Test Event')
        self.assertEqual(event.event_type, 'meeting')
        self.assertEqual(event.created_by, self.user)


class EquipmentModelTest(TestCase):
    def test_equipment_creation(self):
        """测试设备创建"""
        equipment = Equipment.objects.create(
            name='Test Microscope',
            description='Test description',
            is_bookable=True,
            location='Lab A'
        )
        self.assertEqual(equipment.name, 'Test Microscope')
        self.assertTrue(equipment.is_bookable)


class BookingModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.equipment = Equipment.objects.create(
            name='Test Equipment',
            is_bookable=True
        )
        self.event = Event.objects.create(
            title='Test Booking',
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
            event_type='booking',
            created_by=self.user
        )
    
    def test_booking_creation(self):
        """测试预约创建"""
        booking = Booking.objects.create(
            event=self.event,
            user=self.user,
            equipment=self.equipment,
            status='pending'
        )
        self.assertEqual(booking.user, self.user)
        self.assertEqual(booking.equipment, self.equipment)
        self.assertEqual(booking.status, 'pending')


class MeetingPresenterRotationTest(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', password='pass')
        self.user2 = User.objects.create_user(username='user2', password='pass')
        self.user3 = User.objects.create_user(username='user3', password='pass')
        
        self.rotation = MeetingPresenterRotation.objects.create(
            name='Test Rotation',
            next_presenter_index=0
        )
        self.rotation.user_list.add(self.user1, self.user2, self.user3)
    
    def test_get_next_presenter(self):
        """测试获取下一个报告人"""
        next_presenter = self.rotation.get_next_presenter()
        self.assertEqual(next_presenter, self.user1)
    
    def test_advance_presenter(self):
        """测试轮换报告人"""
        initial_presenter = self.rotation.get_next_presenter()
        self.assertEqual(initial_presenter, self.user1)
        
        self.rotation.advance_presenter()
        next_presenter = self.rotation.get_next_presenter()
        self.assertEqual(next_presenter, self.user2)
        
        # 测试循环
        self.rotation.advance_presenter()  # 到 user3
        self.rotation.advance_presenter()  # 回到 user1
        next_presenter = self.rotation.get_next_presenter()
        self.assertEqual(next_presenter, self.user1)


class TaskInstanceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.event = Event.objects.create(
            title='Test Task',
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
            event_type='task',
            created_by=self.user
        )
        self.task_instance = TaskInstance.objects.create(
            event=self.event,
            status='pending'
        )
        self.task_instance.assigned_to.add(self.user)
    
    def test_mark_completed(self):
        """测试标记任务完成"""
        self.assertEqual(self.task_instance.status, 'pending')
        self.assertIsNone(self.task_instance.completed_at)
        
        self.task_instance.mark_completed('Task completed successfully')
        
        self.assertEqual(self.task_instance.status, 'completed')
        self.assertIsNotNone(self.task_instance.completed_at)
        self.assertEqual(self.task_instance.completion_notes, 'Task completed successfully')