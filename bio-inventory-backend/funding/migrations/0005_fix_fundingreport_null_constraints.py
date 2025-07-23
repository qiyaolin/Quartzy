# Manual migration to fix FundingReport NULL constraints
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('funding', '0004_fix_remaining_null_constraints'),
    ]

    operations = [
        # Fix is_tri_agency_compliant field
        migrations.RunSQL(
            "UPDATE funding_fundingreport SET is_tri_agency_compliant = FALSE WHERE is_tri_agency_compliant IS NULL;",
            reverse_sql="-- No reverse needed"
        ),
        migrations.RunSQL(
            "ALTER TABLE funding_fundingreport ALTER COLUMN is_tri_agency_compliant SET DEFAULT FALSE;",
            reverse_sql="ALTER TABLE funding_fundingreport ALTER COLUMN is_tri_agency_compliant DROP DEFAULT;"
        ),
        
        # Fix fiscal_year field if needed
        migrations.RunSQL(
            "UPDATE funding_fundingreport SET fiscal_year = EXTRACT(year from start_date) WHERE fiscal_year IS NULL AND start_date IS NOT NULL;",
            reverse_sql="-- No reverse needed"
        ),
    ]