# Generated manually to add barcode field to Item model
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('items', '0005_remove_financial_type_if_exists'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='barcode',
            field=models.CharField(blank=True, help_text='Unique barcode for this item', max_length=50, null=True, unique=True),
        ),
    ]