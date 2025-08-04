# Create QR usage logging models

from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('schedule', '0002_add_qr_checkin_support'),
    ]

    operations = [
        migrations.CreateModel(
            name='EquipmentUsageLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('check_in_time', models.DateTimeField(help_text='When user checked in')),
                ('check_out_time', models.DateTimeField(blank=True, help_text='When user checked out', null=True)),
                ('usage_duration', models.DurationField(blank=True, help_text='Total time equipment was used', null=True)),
                ('qr_scan_method', models.CharField(choices=[('mobile_camera', 'Mobile Camera'), ('desktop_webcam', 'Desktop Webcam'), ('manual_entry', 'Manual Entry')], default='mobile_camera', help_text='Method used to scan QR code', max_length=20)),
                ('notes', models.TextField(blank=True, help_text='Additional notes about usage', null=True)),
                ('is_active', models.BooleanField(default=True, help_text='Whether this is the current active session')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('equipment', models.ForeignKey(help_text='Equipment that was used', on_delete=django.db.models.deletion.CASCADE, related_name='usage_logs', to='schedule.equipment')),
                ('user', models.ForeignKey(help_text='User who used the equipment', on_delete=django.db.models.deletion.CASCADE, related_name='equipment_usage_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-check_in_time'],
            },
        ),
        
        migrations.CreateModel(
            name='WaitingQueueEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.PositiveIntegerField(default=1, help_text='Position in queue (1 = first)')),
                ('requested_start_time', models.DateTimeField(help_text='When user wants to start using equipment')),
                ('requested_end_time', models.DateTimeField(help_text='When user expects to finish')),
                ('status', models.CharField(choices=[('waiting', 'Waiting'), ('notified', 'Notified'), ('expired', 'Expired'), ('converted', 'Converted to Booking')], default='waiting', help_text='Queue entry status', max_length=20)),
                ('notified_at', models.DateTimeField(blank=True, help_text='When user was notified of availability', null=True)),
                ('expires_at', models.DateTimeField(help_text='When this queue entry expires')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('equipment', models.ForeignKey(help_text='Equipment user is waiting for', on_delete=django.db.models.deletion.CASCADE, related_name='waiting_queue', to='schedule.equipment')),
                ('user', models.ForeignKey(help_text='User waiting in queue', on_delete=django.db.models.deletion.CASCADE, related_name='equipment_queue_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['equipment', 'position'],
            },
        ),
        
        # Create indexes for performance
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_eq_equipme_2088a1_idx ON schedule_equipmentusagelog (equipment_id, check_in_time);",
            reverse_sql="DROP INDEX IF EXISTS schedule_eq_equipme_2088a1_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_eq_user_id_e03600_idx ON schedule_equipmentusagelog (user_id, check_in_time);",
            reverse_sql="DROP INDEX IF EXISTS schedule_eq_user_id_e03600_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_eq_is_acti_880401_idx ON schedule_equipmentusagelog (is_active);",
            reverse_sql="DROP INDEX IF EXISTS schedule_eq_is_acti_880401_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_eq_check_i_811aa5_idx ON schedule_equipmentusagelog (check_in_time);",
            reverse_sql="DROP INDEX IF EXISTS schedule_eq_check_i_811aa5_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_wa_equipme_156a2c_idx ON schedule_waitingqueueentry (equipment_id, status);",
            reverse_sql="DROP INDEX IF EXISTS schedule_wa_equipme_156a2c_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_wa_user_id_5afd91_idx ON schedule_waitingqueueentry (user_id, status);",
            reverse_sql="DROP INDEX IF EXISTS schedule_wa_user_id_5afd91_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS schedule_wa_expires_e3a566_idx ON schedule_waitingqueueentry (expires_at);",
            reverse_sql="DROP INDEX IF EXISTS schedule_wa_expires_e3a566_idx;"
        ),
    ]