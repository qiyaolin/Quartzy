from django.core.management.base import BaseCommand
from settings.models import SystemSetting


class Command(BaseCommand):
    help = 'Initialize default system settings'

    def handle(self, *args, **options):
        default_settings = [
            {
                'key': 'system_name',
                'value': 'Hayer Lab Bio Inventory System',
                'setting_type': 'TEXT',
                'description': 'The name of the inventory system',
                'is_admin_only': True
            },
            {
                'key': 'max_items_per_page',
                'value': '50',
                'setting_type': 'NUMBER',
                'description': 'Maximum items per page in lists',
                'is_admin_only': True
            },
            {
                'key': 'low_stock_threshold',
                'value': '5',
                'setting_type': 'NUMBER',
                'description': 'Default threshold for low stock alerts',
                'is_admin_only': True
            },
            {
                'key': 'expiration_alert_days',
                'value': '30',
                'setting_type': 'NUMBER',
                'description': 'Days before expiration to show alerts',
                'is_admin_only': True
            },
            {
                'key': 'auto_backup_enabled',
                'value': 'true',
                'setting_type': 'BOOLEAN',
                'description': 'Enable automatic database backups',
                'is_admin_only': True
            },
            {
                'key': 'backup_frequency_hours',
                'value': '24',
                'setting_type': 'NUMBER',
                'description': 'Hours between automatic backups',
                'is_admin_only': True
            },
            {
                'key': 'email_notifications_enabled',
                'value': 'true',
                'setting_type': 'BOOLEAN',
                'description': 'Enable email notifications system-wide',
                'is_admin_only': True
            },
            {
                'key': 'admin_email',
                'value': 'admin@hayerlab.example.com',
                'setting_type': 'EMAIL',
                'description': 'Administrator email for system notifications',
                'is_admin_only': True
            },
            {
                'key': 'maintenance_mode',
                'value': 'false',
                'setting_type': 'BOOLEAN',
                'description': 'Enable maintenance mode',
                'is_admin_only': True
            },
            {
                'key': 'session_timeout_minutes',
                'value': '120',
                'setting_type': 'NUMBER',
                'description': 'User session timeout in minutes',
                'is_admin_only': True
            },
            {
                'key': 'default_currency',
                'value': 'USD',
                'setting_type': 'TEXT',
                'description': 'Default currency for funding calculations',
                'is_admin_only': False
            },
            {
                'key': 'lab_contact_info',
                'value': 'Hayer Lab - McGill University',
                'setting_type': 'TEXT',
                'description': 'Lab contact information displayed to users',
                'is_admin_only': False
            },
        ]

        created_count = 0
        updated_count = 0

        for setting_data in default_settings:
            setting, created = SystemSetting.objects.get_or_create(
                key=setting_data['key'],
                defaults=setting_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created setting: {setting.key}')
                )
            else:
                # Update description and other fields if they've changed
                if setting.description != setting_data['description']:
                    setting.description = setting_data['description']
                    setting.setting_type = setting_data['setting_type']
                    setting.is_admin_only = setting_data['is_admin_only']
                    setting.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'Updated setting: {setting.key}')
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully initialized settings: {created_count} created, {updated_count} updated'
            )
        )