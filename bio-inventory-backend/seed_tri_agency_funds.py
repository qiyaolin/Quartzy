#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

# Add the project directory to sys.path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from funding.models import Fund, Transaction
from decimal import Decimal
from datetime import date, datetime

def seed_tri_agency_funds():
    try:
        # Get or create a test user
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={'email': 'test@example.com', 'first_name': 'Test', 'last_name': 'User'}
        )
        print(f"User: {user}")
        
        # Create CIHR fund
        cihr_fund = Fund.objects.create(
            name='CIHR Operating Grant 2025',
            description='Canadian Institutes of Health Research Operating Grant',
            total_budget=Decimal('75000.00'),
            funding_source='Canadian Institutes of Health Research',
            funding_agency='cihr',
            grant_number='PJT-178934',
            principal_investigator='Dr. Sarah Chen',
            start_date=date(2025, 4, 1),
            end_date=date(2026, 3, 31),
            grant_duration_years=1,
            current_year=1,
            created_by=user
        )
        
        # Create NSERC fund
        nserc_fund = Fund.objects.create(
            name='NSERC Discovery Grant 2025',
            description='Natural Sciences and Engineering Research Council Discovery Grant',
            total_budget=Decimal('45000.00'),
            funding_source='Natural Sciences and Engineering Research Council',
            funding_agency='nserc',
            grant_number='RGPIN-2025-04567',
            principal_investigator='Dr. Michael Brown',
            start_date=date(2025, 4, 1),
            end_date=date(2026, 3, 31),
            grant_duration_years=1,
            current_year=1,
            created_by=user
        )
        
        # Create SSHRC fund
        sshrc_fund = Fund.objects.create(
            name='SSHRC Insight Grant 2025',
            description='Social Sciences and Humanities Research Council Insight Grant',
            total_budget=Decimal('35000.00'),
            funding_source='Social Sciences and Humanities Research Council',
            funding_agency='sshrc',
            grant_number='435-2025-0987',
            principal_investigator='Dr. Emily Wilson',
            start_date=date(2025, 4, 1),
            end_date=date(2026, 3, 31),
            grant_duration_years=1,
            current_year=1,
            created_by=user
        )
        
        # Create some sample transactions for each fund
        funds_with_transactions = [
            (cihr_fund, [
                ('Laboratory Equipment', Decimal('15000.00'), 'equipment', 'direct'),
                ('Research Supplies', Decimal('8500.00'), 'supplies', 'direct'),
                ('Conference Travel', Decimal('2500.00'), 'travel', 'direct'),
                ('Personnel Support', Decimal('12000.00'), 'personnel', 'direct'),
                ('Administrative Overhead', Decimal('3500.00'), 'facilities', 'indirect')
            ]),
            (nserc_fund, [
                ('Specialized Software License', Decimal('5000.00'), 'equipment', 'direct'),
                ('Research Materials', Decimal('4500.00'), 'supplies', 'direct'),
                ('Student Support', Decimal('8000.00'), 'personnel', 'direct'),
                ('Facility Usage', Decimal('2200.00'), 'facilities', 'indirect')
            ]),
            (sshrc_fund, [
                ('Data Collection Tools', Decimal('3500.00'), 'services', 'direct'),
                ('Transcription Services', Decimal('2000.00'), 'services', 'direct'),
                ('Research Participant Compensation', Decimal('1500.00'), 'other', 'direct'),
                ('Administrative Support', Decimal('1800.00'), 'facilities', 'indirect')
            ])
        ]
        
        for fund, transactions in funds_with_transactions:
            for item_name, amount, expense_category, cost_type in transactions:
                Transaction.objects.create(
                    fund=fund,
                    amount=amount,
                    transaction_type='purchase',
                    cost_type=cost_type,
                    expense_category=expense_category,
                    item_name=item_name,
                    description=f'{item_name} for {fund.name}',
                    created_by=user
                )
        
        print(f"Created 3 Tri-Agency funds:")
        print(f"  - CIHR Fund ID: {cihr_fund.id} (${cihr_fund.total_budget})")
        print(f"  - NSERC Fund ID: {nserc_fund.id} (${nserc_fund.total_budget})")
        print(f"  - SSHRC Fund ID: {sshrc_fund.id} (${sshrc_fund.total_budget})")
        
        # Show current spending for each fund
        for fund in [cihr_fund, nserc_fund, sshrc_fund]:
            fund.recalculate_spent_amount()
            fund.save()
            print(f"  - {fund.name}: Spent ${fund.spent_amount} of ${fund.total_budget} ({fund.utilization_percentage:.1f}%)")
            
        return [cihr_fund, nserc_fund, sshrc_fund]
        
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == '__main__':
    funds = seed_tri_agency_funds()
    print("Seeding completed.")