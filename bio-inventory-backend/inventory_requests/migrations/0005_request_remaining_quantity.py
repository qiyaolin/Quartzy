from django.db import migrations, models


def backfill_remaining_quantity(apps, schema_editor):
    Request = apps.get_model('inventory_requests', 'Request')
    Request.objects.filter(remaining_quantity=0).update(remaining_quantity=models.F('quantity'))


class Migration(migrations.Migration):

    dependencies = [
        ('inventory_requests', '0004_remove_request_is_archived'),
    ]

    operations = [
        migrations.AddField(
            model_name='request',
            name='remaining_quantity',
            field=models.PositiveIntegerField(default=0, help_text='Remaining quantity to receive'),
        ),
        migrations.RunPython(backfill_remaining_quantity, migrations.RunPython.noop),
    ]
