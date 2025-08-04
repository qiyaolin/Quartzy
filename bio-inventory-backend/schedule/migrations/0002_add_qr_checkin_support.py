# Generated migration for QR code check-in/out support

from django.db import migrations, models
import uuid


def generate_unique_qr_code():
    """Generate a unique QR code for equipment"""
    return f"BSC-{uuid.uuid4().hex[:8].upper()}"


def add_qr_codes_to_existing_equipment(apps, schema_editor):
    """Add QR codes to existing equipment that requires QR check-in"""
    Equipment = apps.get_model('schedule', 'Equipment')
    
    # Add QR codes to equipment that requires QR check-in
    for equipment in Equipment.objects.filter(requires_qr_checkin=True, qr_code__isnull=True):
        equipment.qr_code = generate_unique_qr_code()
        equipment.save()


def reverse_qr_codes(apps, schema_editor):
    """Remove QR codes from equipment (reverse operation)"""
    Equipment = apps.get_model('schedule', 'Equipment')
    Equipment.objects.all().update(qr_code=None)


class Migration(migrations.Migration):

    dependencies = [
        ('schedule', '0001_initial'),
    ]

    operations = [
        # Add QR code field to Equipment
        migrations.AddField(
            model_name='equipment',
            name='qr_code',
            field=models.CharField(
                max_length=50, 
                unique=True, 
                null=True, 
                blank=True, 
                help_text="Unique QR code for check-in/out"
            ),
        ),
        
        # Add current usage tracking fields to Equipment
        migrations.AddField(
            model_name='equipment',
            name='current_user',
            field=models.ForeignKey(
                'auth.User',
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name='currently_using_equipment',
                help_text="User currently using this equipment"
            ),
        ),
        
        migrations.AddField(
            model_name='equipment',
            name='current_checkin_time',
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text="When current user checked in"
            ),
        ),
        
        migrations.AddField(
            model_name='equipment',
            name='is_in_use',
            field=models.BooleanField(
                default=False,
                help_text="Whether equipment is currently in use"
            ),
        ),
        
        # Add early finish notification field to Booking
        migrations.AddField(
            model_name='booking',
            name='actual_end_time',
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text="Actual time when equipment usage ended"
            ),
        ),
        
        migrations.AddField(
            model_name='booking',
            name='early_finish_notified',
            field=models.BooleanField(
                default=False,
                help_text="Whether early finish notification was sent"
            ),
        ),
        
        # Run data migration to add QR codes to existing equipment
        migrations.RunPython(
            add_qr_codes_to_existing_equipment,
            reverse_qr_codes
        ),
    ]