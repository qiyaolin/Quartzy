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
from funding.models import Fund
from decimal import Decimal
from datetime import date

def test_fund_creation():
    try:
        # Create a test user if it doesn't exist
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={'email': 'test@example.com', 'first_name': 'Test', 'last_name': 'User'}
        )
        print(f"User created: {created}, User: {user}")
        
        # Test fund creation
        fund_data = {
            'name': 'Test Fund 2025',
            'description': 'Test fund for debugging',
            'total_budget': Decimal('100000.00'),
            'funding_source': 'Test Source',
            'funding_agency': 'nserc',
            'grant_number': 'TEST-2025-001',
            'principal_investigator': 'Dr. Test PI',
            'start_date': date(2025, 1, 1),
            'end_date': date(2025, 12, 31),
            'grant_duration_years': 1,
            'current_year': 1,
            'created_by': user
        }
        
        # Create the fund
        fund = Fund.objects.create(**fund_data)
        print(f"Fund created successfully: {fund.id} - {fund.name}")
        print(f"Total budget: {fund.total_budget}")
        print(f"Remaining budget: {fund.remaining_budget}")
        
        # Test fiscal year calculations
        print(f"Current fiscal year: {fund.get_current_fiscal_year()}")
        print(f"Annual budget: {fund.get_annual_budget()}")
        
        return fund
        
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    fund = test_fund_creation()
    print("Test completed.")