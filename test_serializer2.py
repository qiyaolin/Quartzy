import os
import sys
import django
from django.conf import settings

# Add the backend directory to the Python path
sys.path.append('/workspace/bio-inventory-backend')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bio_inventory.settings')
django.setup()

from funding.serializers import FundSerializer
from django.contrib.auth.models import User

# Test data
test_data = {
    'name': 'Serializer Test Fund',
    'funding_agency': 'cihr',
    'grant_duration_years': 3,
    'current_year': 2,
    'annual_budgets': {'2024': 30000.00, '2025': 30000.00, '2026': 30000.00},
    'total_budget': '90000.00'
}

# Create a mock request object
class MockRequest:
    def __init__(self):
        self.user = User.objects.get(id=2)  # Assuming user with id=2 exists

# Test the serializer
serializer = FundSerializer(data=test_data, context={'request': MockRequest()})
is_valid = serializer.is_valid()
print("Serializer is valid:", is_valid)
if not is_valid:
    print("Serializer errors:", serializer.errors)
else:
    print("Serialized data:", serializer.validated_data)
    # Try to save the data
    try:
        fund = serializer.save()
        print("Fund created successfully with ID:", fund.id)
        print("funding_agency:", fund.funding_agency)
        print("grant_duration_years:", fund.grant_duration_years)
        print("current_year:", fund.current_year)
        print("annual_budgets:", fund.annual_budgets)
    except Exception as e:
        print("Error saving fund:", str(e))