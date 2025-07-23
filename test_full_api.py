#!/usr/bin/env python
import os
import sys
import django
import json

# Add the backend directory to path
sys.path.append(r'C:\Users\qiyao\Documents\GitHub\Quartzy\bio-inventory-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

django.setup()

from funding.models import Fund
from funding.serializers import FundSerializer

# Get a sample fund
fund = Fund.objects.first()
if fund:
    print(f"Testing API response for fund: {fund.name}")
    print("=" * 50)
    
    # Serialize the fund
    serializer = FundSerializer(fund)
    data = serializer.data
    
    # Pretty print the full API response
    print("Complete API Response:")
    print(json.dumps(data, indent=2, default=str))
    
    print("\n" + "=" * 50)
    print("Key fields verification:")
    print(f"funding_agency: {data.get('funding_agency', 'MISSING')}")
    print(f"grant_duration_years: {data.get('grant_duration_years', 'MISSING')}")
    
    # Show available funding agency choices
    print(f"\nAvailable funding agency choices:")
    for choice in Fund.FUNDING_AGENCY_CHOICES:
        print(f"  {choice[0]}: {choice[1]}")
        
else:
    print("No funds found in database")