# Manual migration to fix annual_budgets NULL constraint
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('funding', '0002_fund_annual_budgets_fund_current_year_and_more'),
    ]

    operations = [
        # First, update all existing NULL values to empty dict
        migrations.RunSQL(
            "UPDATE funding_fund SET annual_budgets = '{}' WHERE annual_budgets IS NULL;",
            reverse_sql="-- No reverse needed"
        ),
        # Then, add the NOT NULL constraint with default
        migrations.RunSQL(
            "ALTER TABLE funding_fund ALTER COLUMN annual_budgets SET DEFAULT '{}';",
            reverse_sql="ALTER TABLE funding_fund ALTER COLUMN annual_budgets DROP DEFAULT;"
        ),
    ]