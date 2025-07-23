# Manual migration to fix remaining NULL constraints for new fields
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('funding', '0003_fix_annual_budgets_constraint'),
    ]

    operations = [
        # Fix current_year field
        migrations.RunSQL(
            "UPDATE funding_fund SET current_year = 1 WHERE current_year IS NULL;",
            reverse_sql="-- No reverse needed"
        ),
        migrations.RunSQL(
            "ALTER TABLE funding_fund ALTER COLUMN current_year SET DEFAULT 1;",
            reverse_sql="ALTER TABLE funding_fund ALTER COLUMN current_year DROP DEFAULT;"
        ),
        
        # Fix grant_duration_years field  
        migrations.RunSQL(
            "UPDATE funding_fund SET grant_duration_years = 1 WHERE grant_duration_years IS NULL;",
            reverse_sql="-- No reverse needed"
        ),
        migrations.RunSQL(
            "ALTER TABLE funding_fund ALTER COLUMN grant_duration_years SET DEFAULT 1;",
            reverse_sql="ALTER TABLE funding_fund ALTER COLUMN grant_duration_years DROP DEFAULT;"
        ),
        
        # Fix funding_agency field
        migrations.RunSQL(
            "UPDATE funding_fund SET funding_agency = 'other' WHERE funding_agency IS NULL;",
            reverse_sql="-- No reverse needed"
        ),
        migrations.RunSQL(
            "ALTER TABLE funding_fund ALTER COLUMN funding_agency SET DEFAULT 'other';",
            reverse_sql="ALTER TABLE funding_fund ALTER COLUMN funding_agency DROP DEFAULT;"
        ),
    ]