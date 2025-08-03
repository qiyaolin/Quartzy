# Generated manually for schedule app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Event',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(help_text='事件标题', max_length=255)),
                ('start_time', models.DateTimeField(help_text='开始时间')),
                ('end_time', models.DateTimeField(help_text='结束时间')),
                ('event_type', models.CharField(choices=[('meeting', 'Meeting'), ('booking', 'Booking'), ('task', 'Task')], help_text='事件类型', max_length=20)),
                ('description', models.TextField(blank=True, help_text='事件描述', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(help_text='创建者', on_delete=django.db.models.deletion.CASCADE, related_name='created_events', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['start_time'],
            },
        ),
        migrations.CreateModel(
            name='Equipment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='设备名称，如显微镜、BSC', max_length=255)),
                ('description', models.TextField(blank=True, help_text='设备描述', null=True)),
                ('is_bookable', models.BooleanField(default=True, help_text='是否可预约')),
                ('requires_qr_checkin', models.BooleanField(default=False, help_text='是否需要二维码签到')),
                ('location', models.CharField(blank=True, help_text='设备位置', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='MeetingPresenterRotation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='轮值列表名称', max_length=255)),
                ('next_presenter_index', models.PositiveIntegerField(default=0, help_text='下一个报告人索引')),
                ('is_active', models.BooleanField(default=True, help_text='是否激活')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user_list', models.ManyToManyField(help_text='轮值用户列表', related_name='rotation_lists', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='RecurringTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(help_text='任务标题', max_length=255)),
                ('description', models.TextField(blank=True, help_text='任务描述', null=True)),
                ('cron_schedule', models.CharField(help_text="Cron格式的调度规则，如 'last friday of month'", max_length=100)),
                ('is_active', models.BooleanField(default=True, help_text='是否激活')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assignee_group', models.ManyToManyField(help_text='任务分配组', related_name='recurring_tasks', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(help_text='创建者', on_delete=django.db.models.deletion.CASCADE, related_name='created_recurring_tasks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['title'],
            },
        ),
        migrations.CreateModel(
            name='TaskInstance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], default='pending', help_text='任务状态', max_length=20)),
                ('completion_notes', models.TextField(blank=True, help_text='完成备注', null=True)),
                ('completed_at', models.DateTimeField(blank=True, help_text='完成时间', null=True)),
                ('assigned_to', models.ManyToManyField(help_text='分配给的用户', related_name='assigned_tasks', to=settings.AUTH_USER_MODEL)),
                ('event', models.OneToOneField(help_text='关联的事件', on_delete=django.db.models.deletion.CASCADE, related_name='task_instance', to='schedule.event')),
                ('recurring_task', models.ForeignKey(blank=True, help_text='关联的周期性任务', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='instances', to='schedule.recurringtask')),
            ],
            options={
                'ordering': ['event__start_time'],
            },
        ),
        migrations.CreateModel(
            name='GroupMeeting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('topic', models.CharField(help_text='组会主题', max_length=255)),
                ('materials_url', models.URLField(blank=True, help_text='资料链接', null=True)),
                ('materials_file', models.FileField(blank=True, help_text='资料文件', null=True, upload_to='meeting_materials/')),
                ('event', models.OneToOneField(help_text='关联的事件', on_delete=django.db.models.deletion.CASCADE, related_name='group_meeting', to='schedule.event')),
                ('presenter', models.ForeignKey(blank=True, help_text='报告人', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='presented_meetings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['event__start_time'],
            },
        ),
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('cancelled', 'Cancelled'), ('completed', 'Completed')], default='pending', help_text='预约状态', max_length=20)),
                ('notes', models.TextField(blank=True, help_text='预约备注', null=True)),
                ('equipment', models.ForeignKey(help_text='预约设备', on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to='schedule.equipment')),
                ('event', models.OneToOneField(help_text='关联的事件', on_delete=django.db.models.deletion.CASCADE, related_name='booking', to='schedule.event')),
                ('user', models.ForeignKey(help_text='预约用户', on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to=settings.AUTH_USER_MODEL)),
                ('waiting_list', models.ManyToManyField(blank=True, help_text='等待列表中的用户', related_name='waiting_bookings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['event__start_time'],
            },
        ),
    ]