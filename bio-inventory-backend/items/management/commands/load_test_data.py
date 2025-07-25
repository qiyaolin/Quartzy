"""
Django Management Command to Load Simulated Test Data
Usage: python manage.py load_test_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from items.models import Vendor, Location, ItemType, Item
from requests.models import Request, RequestHistory
from funding.models import Fund, Transaction as FundTransaction, BudgetAllocation, FundingReport
from datetime import date, datetime
from decimal import Decimal
import sys
import os

class Command(BaseCommand):
    help = 'Load simulated test data for bio-inventory system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before loading new data',
        )

    def handle(self, *args, **options):
        # Import data from the root directory
        sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
        
        try:
            from simulated_test_data import (
                VENDOR_DATA, LOCATION_DATA, ITEM_TYPE_DATA, ITEM_DATA,
                REQUEST_DATA, REQUEST_HISTORY_DATA, FUND_DATA, TRANSACTION_DATA,
                BUDGET_ALLOCATION_DATA, FUNDING_REPORT_DATA, USER_DATA
            )
        except ImportError:
            self.stdout.write(
                self.style.ERROR(
                    'Could not import simulated_test_data.py. '
                    'Make sure the file is in the project root directory.'
                )
            )
            return

        with transaction.atomic():
            if options['clear']:
                self.stdout.write("Clearing existing test data...")
                FundingReport.objects.all().delete()
                BudgetAllocation.objects.all().delete()
                FundTransaction.objects.all().delete()
                RequestHistory.objects.all().delete()
                Request.objects.all().delete()
                Item.objects.all().delete()
                Fund.objects.all().delete()
                ItemType.objects.all().delete()
                Location.objects.all().delete()
                Vendor.objects.all().delete()
                User.objects.filter(is_superuser=False).delete()

            # Create Users
            self.stdout.write("Creating users...")
            users = {}
            for i, user_data in enumerate(USER_DATA, 1):
                user, created = User.objects.get_or_create(
                    username=user_data['username'],
                    defaults={
                        'email': user_data['email'],
                        'first_name': user_data['first_name'],
                        'last_name': user_data['last_name'],
                        'is_staff': user_data['is_staff'],
                        'is_active': user_data['is_active'],
                        'is_superuser': user_data['is_superuser'],
                        'date_joined': user_data['date_joined'],
                        'last_login': user_data['last_login']
                    }
                )
                if created:
                    user.set_password('testpass123')
                    user.save()
                users[i] = user

            # Create Vendors
            self.stdout.write("Creating vendors...")
            vendors = {}
            for i, vendor_data in enumerate(VENDOR_DATA, 1):
                vendor, created = Vendor.objects.get_or_create(
                    name=vendor_data['name'],
                    defaults=vendor_data
                )
                vendors[i] = vendor

            # Create Locations
            self.stdout.write("Creating locations...")
            locations = {}
            for i, location_data in enumerate(LOCATION_DATA, 1):
                data = location_data.copy()
                if data['parent'] is not None:
                    data['parent'] = locations[data['parent']]
                location, created = Location.objects.get_or_create(
                    name=data['name'],
                    parent=data['parent'],
                    defaults=data
                )
                locations[i] = location

            # Create Item Types
            self.stdout.write("Creating item types...")
            item_types = {}
            for i, item_type_data in enumerate(ITEM_TYPE_DATA, 1):
                item_type, created = ItemType.objects.get_or_create(
                    name=item_type_data['name'],
                    defaults=item_type_data
                )
                item_types[i] = item_type

            # Create Funds
            self.stdout.write("Creating funds...")
            funds = {}
            for i, fund_data in enumerate(FUND_DATA, 1):
                data = fund_data.copy()
                data['created_by'] = users[data['created_by']]
                fund, created = Fund.objects.get_or_create(
                    name=data['name'],
                    defaults=data
                )
                funds[i] = fund

            # Create Items
            self.stdout.write("Creating items...")
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
                item, created = Item.objects.get_or_create(
                    serial_number=data['serial_number'],
                    defaults=data
                )
                items[i] = item

            # Create Requests
            self.stdout.write("Creating requests...")
            requests_objs = {}
            for i, request_data in enumerate(REQUEST_DATA, 1):
                data = request_data.copy()
                if data['item_type']:
                    data['item_type'] = item_types[data['item_type']]
                data['requested_by'] = users[data['requested_by']]
                if data['vendor']:
                    data['vendor'] = vendors[data['vendor']]
                request_obj = Request.objects.create(**data)
                requests_objs[i] = request_obj

            # Create Request History
            self.stdout.write("Creating request history...")
            for history_data in REQUEST_HISTORY_DATA:
                data = history_data.copy()
                data['request'] = requests_objs[data['request']]
                if data['user']:
                    data['user'] = users[data['user']]
                RequestHistory.objects.create(**data)

            # Create Transactions
            self.stdout.write("Creating transactions...")
            for transaction_data in TRANSACTION_DATA:
                data = transaction_data.copy()
                data['fund'] = funds[data['fund']]
                data['created_by'] = users[data['created_by']]
                FundTransaction.objects.create(**data)

            # Create Budget Allocations
            self.stdout.write("Creating budget allocations...")
            for allocation_data in BUDGET_ALLOCATION_DATA:
                data = allocation_data.copy()
                data['fund'] = funds[data['fund']]
                BudgetAllocation.objects.create(**data)

            # Create Funding Reports
            self.stdout.write("Creating funding reports...")
            for report_data in FUNDING_REPORT_DATA:
                data = report_data.copy()
                fund_ids = data.pop('funds')
                data['generated_by'] = users[data['generated_by']]
                report = FundingReport.objects.create(**data)
                for fund_id in fund_ids:
                    report.funds.add(funds[fund_id])

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Successfully loaded simulated test data!\n'
                f'\nCreated:\n'
                f'- {len(users)} Users\n'
                f'- {len(vendors)} Vendors\n'
                f'- {len(locations)} Locations\n'
                f'- {len(item_types)} Item Types\n'
                f'- {len(items)} Items\n'
                f'- {len(requests_objs)} Requests\n'
                f'- {len(REQUEST_HISTORY_DATA)} Request History entries\n'
                f'- {len(funds)} Funds\n'
                f'- {len(TRANSACTION_DATA)} Transactions\n'
                f'- {len(BUDGET_ALLOCATION_DATA)} Budget Allocations\n'
                f'- {len(FUNDING_REPORT_DATA)} Funding Reports\n\n'
                f'🔑 Test user credentials (password: testpass123):\n'
                f'- sarah.johnson (Superuser)\n'
                f'- michael.chen (Staff)\n'
                f'- emily.rodriguez (Regular)\n'
                f'- alex.thompson (Regular)\n'
                f'- lab.manager (Staff)\n\n'
                f'📝 Usage: python manage.py load_test_data --clear'
            )
        )