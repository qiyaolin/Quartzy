"""
Django Management Command to Load Simulated Test Data
Usage: python manage.py load_test_data
"""

import os
import sys
import django
from datetime import date, datetime
from decimal import Decimal

# Add the project directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from items.models import Vendor, Location, ItemType, Item
from requests.models import Request, RequestHistory
from funding.models import Fund, Transaction, BudgetAllocation, FundingReport

def load_test_data():
    """Load all simulated test data into the database"""
    
    print("Loading simulated test data...")
    
    # Import data from simulated_test_data.py
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from simulated_test_data import (
        VENDOR_DATA, LOCATION_DATA, ITEM_TYPE_DATA, ITEM_DATA,
        REQUEST_DATA, REQUEST_HISTORY_DATA, FUND_DATA, TRANSACTION_DATA,
        BUDGET_ALLOCATION_DATA, FUNDING_REPORT_DATA, USER_DATA
    )
    
    # Clear existing data (optional - comment out if you want to preserve existing data)
    print("Clearing existing test data...")
    FundingReport.objects.all().delete()
    BudgetAllocation.objects.all().delete()
    Transaction.objects.all().delete()
    RequestHistory.objects.all().delete()
    Request.objects.all().delete()
    Item.objects.all().delete()
    Fund.objects.all().delete()
    ItemType.objects.all().delete()
    Location.objects.all().delete()
    Vendor.objects.all().delete()
    User.objects.filter(is_superuser=False).delete()  # Keep superuser accounts
    
    # Create Users first (required for foreign keys)
    print("Creating users...")
    users = {}
    for i, user_data in enumerate(USER_DATA, 1):
        user = User.objects.create_user(
            username=user_data['username'],
            email=user_data['email'],
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            password='testpass123'  # Default password for all test users
        )
        user.is_staff = user_data['is_staff']
        user.is_active = user_data['is_active']
        user.is_superuser = user_data['is_superuser']
        user.date_joined = user_data['date_joined']
        user.last_login = user_data['last_login']
        user.save()
        users[i] = user
    print(f"Created {len(users)} users")
    
    # Create Vendors
    print("Creating vendors...")
    vendors = {}
    for i, vendor_data in enumerate(VENDOR_DATA, 1):
        vendor = Vendor.objects.create(**vendor_data)
        vendors[i] = vendor
    print(f"Created {len(vendors)} vendors")
    
    # Create Locations (handle parent relationships)
    print("Creating locations...")
    locations = {}
    for i, location_data in enumerate(LOCATION_DATA, 1):
        data = location_data.copy()
        if data['parent'] is not None:
            data['parent'] = locations[data['parent']]
        location = Location.objects.create(**data)
        locations[i] = location
    print(f"Created {len(locations)} locations")
    
    # Create Item Types
    print("Creating item types...")
    item_types = {}
    for i, item_type_data in enumerate(ITEM_TYPE_DATA, 1):
        item_type = ItemType.objects.create(**item_type_data)
        item_types[i] = item_type
    print(f"Created {len(item_types)} item types")
    
    # Create Funds
    print("Creating funds...")
    funds = {}
    for i, fund_data in enumerate(FUND_DATA, 1):
        data = fund_data.copy()
        data['created_by'] = users[data['created_by']]
        fund = Fund.objects.create(**data)
        funds[i] = fund
    print(f"Created {len(funds)} funds")
    
    # Create Items
    print("Creating items...")
    items = {}
    for i, item_data in enumerate(ITEM_DATA, 1):
        data = item_data.copy()
        data['item_type'] = item_types[data['item_type']]
        if data['vendor']:
            data['vendor'] = vendors[data['vendor']]
        if data['location']:
            data['location'] = locations[data['location']]
        if data['owner']:
            data['owner'] = users[data['owner']]
        item = Item.objects.create(**data)
        items[i] = item
    print(f"Created {len(items)} items")
    
    # Create Requests
    print("Creating requests...")
    requests_objs = {}
    for i, request_data in enumerate(REQUEST_DATA, 1):
        data = request_data.copy()
        if data['item_type']:
            data['item_type'] = item_types[data['item_type']]
        data['requested_by'] = users[data['requested_by']]
        if data['vendor']:
            data['vendor'] = vendors[data['vendor']]
        request = Request.objects.create(**data)
        requests_objs[i] = request
    print(f"Created {len(requests_objs)} requests")
    
    # Create Request History
    print("Creating request history...")
    for history_data in REQUEST_HISTORY_DATA:
        data = history_data.copy()
        data['request'] = requests_objs[data['request']]
        if data['user']:
            data['user'] = users[data['user']]
        RequestHistory.objects.create(**data)
    print(f"Created {len(REQUEST_HISTORY_DATA)} request history entries")
    
    # Create Transactions
    print("Creating transactions...")
    for transaction_data in TRANSACTION_DATA:
        data = transaction_data.copy()
        data['fund'] = funds[data['fund']]
        data['created_by'] = users[data['created_by']]
        Transaction.objects.create(**data)
    print(f"Created {len(TRANSACTION_DATA)} transactions")
    
    # Create Budget Allocations
    print("Creating budget allocations...")
    for allocation_data in BUDGET_ALLOCATION_DATA:
        data = allocation_data.copy()
        data['fund'] = funds[data['fund']]
        BudgetAllocation.objects.create(**data)
    print(f"Created {len(BUDGET_ALLOCATION_DATA)} budget allocations")
    
    # Create Funding Reports
    print("Creating funding reports...")
    for report_data in FUNDING_REPORT_DATA:
        data = report_data.copy()
        fund_ids = data.pop('funds')
        data['generated_by'] = users[data['generated_by']]
        report = FundingReport.objects.create(**data)
        # Add many-to-many relationships
        for fund_id in fund_ids:
            report.funds.add(funds[fund_id])
    print(f"Created {len(FUNDING_REPORT_DATA)} funding reports")
    
    print("\n" + "="*50)
    print("✅ Successfully loaded all simulated test data!")
    print("="*50)
    print("\nTest user credentials:")
    print("Username: sarah.johnson | Password: testpass123 (Superuser)")
    print("Username: michael.chen | Password: testpass123 (Staff)")
    print("Username: emily.rodriguez | Password: testpass123 (Regular)")
    print("Username: alex.thompson | Password: testpass123 (Regular)")
    print("Username: lab.manager | Password: testpass123 (Staff)")
    print("\nData Summary:")
    print(f"- {len(users)} Users")
    print(f"- {len(vendors)} Vendors")
    print(f"- {len(locations)} Locations")
    print(f"- {len(item_types)} Item Types")
    print(f"- {len(items)} Items")
    print(f"- {len(requests_objs)} Requests")
    print(f"- {len(REQUEST_HISTORY_DATA)} Request History entries")
    print(f"- {len(funds)} Funds")
    print(f"- {len(TRANSACTION_DATA)} Transactions")
    print(f"- {len(BUDGET_ALLOCATION_DATA)} Budget Allocations")
    print(f"- {len(FUNDING_REPORT_DATA)} Funding Reports")

if __name__ == "__main__":
    load_test_data()