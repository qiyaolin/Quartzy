#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to path
sys.path.append(r'C:\Users\qiyao\Documents\GitHub\Quartzy\bio-inventory-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

django.setup()

from funding.models import Fund
from funding.serializers import FundSerializer
from django.contrib.auth.models import User

# Check existing funds
print(f"Total funds in database: {Fund.objects.count()}")

if Fund.objects.exists():
    fund = Fund.objects.first()
    print(f"\nSample Fund:")
    print(f"  Name: {fund.name}")
    print(f"  Funding Agency: {fund.funding_agency}")
    print(f"  Grant Duration Years: {fund.grant_duration_years}")
    
    # Serialize the fund to see API response
    serializer = FundSerializer(fund)
    data = serializer.data
    
    print(f"\nAPI Response includes:")
    print(f"  funding_agency: {'YES' if 'funding_agency' in data else 'NO'}")
    print(f"  grant_duration_years: {'YES' if 'grant_duration_years' in data else 'NO'}")
    
    if 'funding_agency' in data:
        print(f"  funding_agency value: {data['funding_agency']}")
    if 'grant_duration_years' in data:
        print(f"  grant_duration_years value: {data['grant_duration_years']}")
else:
    print("No funds found in database. Creating a test fund...")
    
    # Get or create a test user
    user, created = User.objects.get_or_create(
        username='testuser',
        defaults={'email': 'test@example.com'}
    )
    
    # Create a test fund
    fund = Fund.objects.create(
        name="Test CIHR Grant",
        description="Test grant for API validation",
        total_budget=50000.00,
        funding_source="Canadian Institutes of Health Research",
        funding_agency="cihr",
        grant_number="CIHR-2024-001",
        principal_investigator="Dr. Test Researcher",
        grant_duration_years=3,
        current_year=1,
        created_by=user
    )
    
    print(f"Created test fund: {fund.name}")
    print(f"  Funding Agency: {fund.funding_agency}")
    print(f"  Grant Duration Years: {fund.grant_duration_years}")
    
    # Test serialization
    serializer = FundSerializer(fund)
    data = serializer.data
    
    print(f"\nAPI Response includes:")
    print(f"  funding_agency: {'YES' if 'funding_agency' in data else 'NO'}")
    print(f"  grant_duration_years: {'YES' if 'grant_duration_years' in data else 'NO'}")
    
    if 'funding_agency' in data:
        print(f"  funding_agency value: {data['funding_agency']}")
    if 'grant_duration_years' in data:
        print(f"  grant_duration_years value: {data['grant_duration_years']}")