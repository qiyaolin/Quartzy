from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from decimal import Decimal
from datetime import date, timedelta
import random

from funding.models import Fund, Transaction, BudgetAllocation, FundingReport


class Command(BaseCommand):
    help = 'Creates sample funding data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing funding data before creating new data',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing funding data...')
            Transaction.objects.all().delete()
            BudgetAllocation.objects.all().delete()
            FundingReport.objects.all().delete()
            Fund.objects.all().delete()

        # Get or create a user for the samples
        user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@lab.com',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            user.set_password('admin123')
            user.save()

        # Create sample funds
        funds_data = [
            {
                'name': 'NIH Grant R01-2024',
                'description': 'National Institutes of Health research grant for molecular biology studies',
                'total_budget': Decimal('150000.00'),
                'funding_source': 'National Institutes of Health',
                'grant_number': 'R01-GM123456',
                'principal_investigator': 'Dr. Sarah Johnson',
                'start_date': date.today() - timedelta(days=180),
                'end_date': date.today() + timedelta(days=545),
            },
            {
                'name': 'NSF Equipment Fund',
                'description': 'National Science Foundation equipment acquisition fund',
                'total_budget': Decimal('75000.00'),
                'funding_source': 'National Science Foundation',
                'grant_number': 'NSF-1234567',
                'principal_investigator': 'Dr. Michael Chen',
                'start_date': date.today() - timedelta(days=90),
                'end_date': date.today() + timedelta(days=275),
            },
            {
                'name': 'University Startup Fund',
                'description': 'Institutional startup funding for new faculty',
                'total_budget': Decimal('50000.00'),
                'funding_source': 'University Research Office',
                'principal_investigator': 'Dr. Emily Rodriguez',
                'start_date': date.today() - timedelta(days=365),
                'end_date': date.today() + timedelta(days=365),
            },
            {
                'name': 'Industry Collaboration - BioTech Corp',
                'description': 'Collaborative research agreement with biotechnology company',
                'total_budget': Decimal('100000.00'),
                'funding_source': 'BioTech Corporation',
                'grant_number': 'BTC-2024-001',
                'principal_investigator': 'Dr. Sarah Johnson',
                'start_date': date.today() - timedelta(days=60),
                'end_date': date.today() + timedelta(days=700),
            }
        ]

        funds = []
        for fund_data in funds_data:
            fund = Fund.objects.create(created_by=user, **fund_data)
            funds.append(fund)
            self.stdout.write(f'Created fund: {fund.name}')

        # Create budget allocations for each fund
        allocation_categories = [
            ('Equipment', 0.4),  # 40% of budget
            ('Supplies', 0.35),  # 35% of budget
            ('Personnel', 0.20), # 20% of budget
            ('Travel', 0.05)     # 5% of budget
        ]

        for fund in funds:
            for category, percentage in allocation_categories:
                allocated_amount = fund.total_budget * Decimal(str(percentage))
                allocation = BudgetAllocation.objects.create(
                    fund=fund,
                    category=category,
                    allocated_amount=allocated_amount,
                    description=f'{category} allocation for {fund.name}'
                )
                self.stdout.write(f'Created allocation: {category} - ${allocated_amount} for {fund.name}')

        # Create sample transactions
        sample_transactions = [
            # NIH Grant transactions
            {
                'fund': funds[0],
                'amount': Decimal('15000.00'),
                'transaction_type': 'purchase',
                'item_name': 'PCR Thermal Cycler',
                'description': 'High-precision thermal cycler for DNA amplification',
            },
            {
                'fund': funds[0],
                'amount': Decimal('2500.00'),
                'transaction_type': 'purchase',
                'item_name': 'Reagent Kit - DNA Extraction',
                'description': 'Commercial DNA extraction kit (100 preps)',
            },
            {
                'fund': funds[0],
                'amount': Decimal('800.00'),
                'transaction_type': 'purchase',
                'item_name': 'Disposable Tips',
                'description': 'Sterile pipette tips, various sizes',
            },
            
            # NSF Equipment Fund transactions
            {
                'fund': funds[1],
                'amount': Decimal('25000.00'),
                'transaction_type': 'purchase',
                'item_name': 'Confocal Microscope Upgrade',
                'description': 'Laser module upgrade for existing confocal system',
            },
            {
                'fund': funds[1],
                'amount': Decimal('3500.00'),
                'transaction_type': 'purchase',
                'item_name': 'Imaging Software License',
                'description': 'Annual license for microscopy analysis software',
            },
            
            # University Startup Fund transactions
            {
                'fund': funds[2],
                'amount': Decimal('8000.00'),
                'transaction_type': 'purchase',
                'item_name': 'Laboratory Bench Setup',
                'description': 'Modular lab bench with storage and utilities',
            },
            {
                'fund': funds[2],
                'amount': Decimal('1200.00'),
                'transaction_type': 'purchase',
                'item_name': 'Basic Lab Supplies Starter Kit',
                'description': 'Essential consumables for new lab setup',
            },
            
            # Industry Collaboration transactions
            {
                'fund': funds[3],
                'amount': Decimal('5000.00'),
                'transaction_type': 'purchase',
                'item_name': 'Specialized Cell Culture Medium',
                'description': 'Custom medium for collaborative cell line studies',
            },
            {
                'fund': funds[3],
                'amount': Decimal('1500.00'),
                'transaction_type': 'purchase',
                'item_name': 'Conference Travel',
                'description': 'Travel expenses for project presentation',
            },
        ]

        for transaction_data in sample_transactions:
            transaction = Transaction.objects.create(
                created_by=user,
                **transaction_data
            )
            self.stdout.write(f'Created transaction: {transaction.item_name} - ${transaction.amount}')

        # Add some random smaller transactions
        supply_items = [
            'Petri Dishes', 'Culture Flasks', 'Microcentrifuge Tubes', 'Latex Gloves',
            'Safety Goggles', 'pH Buffer Solutions', 'Ethanol', 'Parafilm',
            'Kimwipes', 'Falcon Tubes', 'Glass Beakers', 'Magnetic Stir Bars'
        ]

        for _ in range(15):
            fund = random.choice(funds)
            item = random.choice(supply_items)
            amount = Decimal(str(round(random.uniform(50, 500), 2)))
            
            Transaction.objects.create(
                fund=fund,
                amount=amount,
                transaction_type='purchase',
                item_name=item,
                description=f'Laboratory supplies purchase',
                created_by=user
            )

        self.stdout.write(self.style.SUCCESS('Successfully created sample funding data!'))
        
        # Display summary
        self.stdout.write('\n--- Summary ---')
        self.stdout.write(f'Total Funds Created: {Fund.objects.count()}')
        self.stdout.write(f'Total Budget Allocations: {BudgetAllocation.objects.count()}')
        self.stdout.write(f'Total Transactions: {Transaction.objects.count()}')
        
        total_budget = sum(fund.total_budget for fund in Fund.objects.all())
        total_spent = sum(fund.spent_amount for fund in Fund.objects.all())
        self.stdout.write(f'Total Budget: ${total_budget:,}')
        self.stdout.write(f'Total Spent: ${total_spent:,}')
        self.stdout.write(f'Total Remaining: ${total_budget - total_spent:,}')