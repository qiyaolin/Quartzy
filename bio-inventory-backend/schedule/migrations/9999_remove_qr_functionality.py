# Generated manually - Removes QR code functionality from Equipment model
# Run this migration after deploying the code changes

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('schedule', '0005_calendarsyncrecord_schedule_ca_content_49a524_idx_and_more'),
    ]

    operations = [
        # Remove QR-related fields from Equipment model
        migrations.RemoveField(
            model_name='equipment',
            name='requires_qr_checkin',
        ),
        migrations.RemoveField(
            model_name='equipment',
            name='qr_code',
        ),
        # Remove QR-related fields from EquipmentUsageLog model
        migrations.RemoveField(
            model_name='equipmentusagelog',
            name='qr_scan_method',
        ),
    ]