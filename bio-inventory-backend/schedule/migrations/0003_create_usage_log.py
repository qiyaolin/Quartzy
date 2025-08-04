# Generated migration for equipment usage logging

from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('schedule', '0002_add_qr_checkin_support'),
    ]

    operations = [
        # Create EquipmentUsageLog model
        migrations.CreateModel(
            name='EquipmentUsageLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('check_in_time', models.DateTimeField(help_text='When user checked in')),
                ('check_out_time', models.DateTimeField(blank=True, help_text='When user checked out', null=True)),
                ('usage_duration', models.DurationField(blank=True, help_text='Total usage duration', null=True)),
                ('qr_scan_method', models.CharField(
                    choices=[('mobile_camera', 'Mobile Camera'), ('desktop_webcam', 'Desktop Webcam'), ('manual_entry', 'Manual Entry')],
                    default='mobile_camera',
                    help_text='Method used to scan QR code',
                    max_length=20
                )),
                ('notes', models.TextField(blank=True, help_text='Additional usage notes', null=True)),
                ('is_active', models.BooleanField(default=True, help_text='Whether this is an active usage session')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('equipment', models.ForeignKey(
                    help_text='Equipment being used',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='usage_logs',
                    to='schedule.equipment'
                )),
                ('user', models.ForeignKey(
                    help_text='User using the equipment',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='equipment_usage_logs',
                    to=settings.AUTH_USER_MODEL
                )),
                ('booking', models.ForeignKey(
                    blank=True,
                    help_text='Associated booking if any',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='usage_logs',
                    to='schedule.booking'
                )),
            ],
            options={
                'ordering': ['-check_in_time'],
                'indexes': [
                    models.Index(fields=['equipment', 'check_in_time'], name='schedule_eq_equip_check_in_idx'),
                    models.Index(fields=['user', 'check_in_time'], name='schedule_eq_user_check_in_idx'),
                    models.Index(fields=['is_active'], name='schedule_eq_is_active_idx'),
                    models.Index(fields=['check_in_time'], name='schedule_eq_check_in_time_idx'),
                ],
            },
        ),
        
        # Create WaitingQueueEntry model for enhanced waiting queue functionality
        migrations.CreateModel(
            name='WaitingQueueEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.PositiveIntegerField(help_text='Position in queue')),
                ('requested_start_time', models.DateTimeField(help_text='When user wants to start using equipment')),
                ('requested_end_time', models.DateTimeField(help_text='When user plans to finish using equipment')),
                ('status', models.CharField(
                    choices=[
                        ('waiting', 'Waiting'),
                        ('notified', 'Notified'),
                        ('converted_to_booking', 'Converted to Booking'),
                        ('cancelled', 'Cancelled'),
                        ('expired', 'Expired')
                    ],
                    default='waiting',
                    help_text='Status of queue entry',
                    max_length=20
                )),
                ('notification_sent_at', models.DateTimeField(
                    blank=True,
                    help_text='When notification was sent to user',
                    null=True
                )),
                ('expires_at', models.DateTimeField(help_text='When this queue entry expires')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('equipment', models.ForeignKey(
                    help_text='Equipment user is waiting for',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='waiting_queue',
                    to='schedule.equipment'
                )),
                ('user', models.ForeignKey(
                    help_text='User in waiting queue',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='waiting_queue_entries',
                    to=settings.AUTH_USER_MODEL
                )),
                ('time_slot', models.ForeignKey(
                    help_text='Time slot user is waiting for',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='waiting_queue',
                    to='schedule.booking'
                )),
            ],
            options={
                'ordering': ['equipment', 'position'],
                'unique_together': {('equipment', 'time_slot', 'user')},
                'indexes': [
                    models.Index(fields=['equipment', 'status'], name='schedule_wq_equip_status_idx'),
                    models.Index(fields=['user', 'status'], name='schedule_wq_user_status_idx'),
                    models.Index(fields=['expires_at'], name='schedule_wq_expires_at_idx'),
                ],
            },
        ),
    ]