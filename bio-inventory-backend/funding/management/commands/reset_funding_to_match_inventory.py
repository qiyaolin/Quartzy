from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from decimal import Decimal
import random

from funding.models import Fund, Transaction
from requests.models import Request
from items.models import Item


class Command(BaseCommand):
    help = 'Reset funding data to match actual inventory and request values'

    def add_arguments(self, parser):
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Execute the reset (default is dry run)',
        )

    def handle(self, *args, **options):
        execute = options['execute']
        
        if not execute:
            self.stdout.write(self.style.WARNING('Running in DRY RUN mode. Use --execute to apply changes.'))
        
        # Step 1: Analyze current situation
        self.analyze_current_situation()
        
        # Step 2: Reset transaction amounts
        if execute:
            with transaction.atomic():
                self.reset_transactions()
                self.recalculate_all_fund_amounts()
        else:
            self.stdout.write('\nWould reset transactions and recalculate fund amounts.')
        
        # Step 3: Final verification
        self.verify_final_state()

    def analyze_current_situation(self):
        # Current totals
        inventory_total = Item.objects.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
        funding_spent = Fund.objects.aggregate(total=Sum('spent_amount'))['total'] or Decimal('0.00')
        transaction_total = Transaction.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Request analysis
        approved_requests = Request.objects.filter(
            status__in=['APPROVED', 'ORDERED', 'RECEIVED'],
            fund_id__isnull=False
        )
        approved_requests_value = sum(req.unit_price * req.quantity for req in approved_requests)
        
        self.stdout.write('=== CURRENT SITUATION ===')
        self.stdout.write(f'Inventory Total Value: ${inventory_total:,}')
        self.stdout.write(f'Current Funding Spent: ${funding_spent:,}')
        self.stdout.write(f'Current Transaction Total: ${transaction_total:,}')
        self.stdout.write(f'Approved Requests Value: ${approved_requests_value:,}')
        self.stdout.write(f'Discrepancy: ${funding_spent - inventory_total:,}')

    def reset_transactions(self):
        self.stdout.write('\n=== RESETTING TRANSACTIONS ===')
        
        # Delete all existing transactions
        transaction_count = Transaction.objects.count()
        Transaction.objects.all().delete()
        self.stdout.write(f'Deleted {transaction_count} existing transactions')
        
        # Create transactions only for approved/ordered/received requests with funding
        requests_with_funding = Request.objects.filter(
            fund_id__isnull=False,
            status__in=['APPROVED', 'ORDERED', 'RECEIVED']
        )
        
        created_count = 0
        for req in requests_with_funding:
            try:
                fund = Fund.objects.get(id=req.fund_id)
                total_cost = req.unit_price * req.quantity
                
                Transaction.objects.create(
                    fund=fund,
                    amount=total_cost,
                    transaction_type='purchase',
                    item_name=req.item_name,
                    description=f"Purchase of {req.item_name} (Request #{req.id})",
                    request_id=req.id,
                    created_by=req.requested_by
                )
                created_count += 1
                
            except Fund.DoesNotExist:
                self.stdout.write(f'Warning: Request {req.id} references non-existent fund {req.fund_id}')
        
        self.stdout.write(f'Created {created_count} new transactions based on actual requests')
        
        # Add some transactions for existing inventory items that don't have associated requests
        items_without_requests = Item.objects.filter(price__isnull=False)
        existing_item_names = set(Transaction.objects.values_list('item_name', flat=True))
        
        funds_list = list(Fund.objects.all())
        if funds_list:
            for item in items_without_requests:
                if item.name not in existing_item_names and item.price:
                    # Assign to a random fund
                    fund = random.choice(funds_list)
                    
                    Transaction.objects.create(
                        fund=fund,
                        amount=item.price,
                        transaction_type='purchase',
                        item_name=item.name,
                        description=f"Inventory item: {item.name} (Serial: {item.serial_number})",
                        created_by_id=1  # Assume admin user
                    )
                    created_count += 1
            
            self.stdout.write(f'Total transactions created: {created_count}')

    def recalculate_all_fund_amounts(self):
        self.stdout.write('\n=== RECALCULATING FUND AMOUNTS ===')
        
        for fund in Fund.objects.all():
            old_spent = fund.spent_amount
            fund.recalculate_spent_amount()
            fund.save()
            
            self.stdout.write(f'Fund {fund.name}:')
            self.stdout.write(f'  Old spent: ${old_spent:,}')
            self.stdout.write(f'  New spent: ${fund.spent_amount:,}')
            self.stdout.write(f'  Remaining: ${fund.remaining_budget:,}')

    def verify_final_state(self):
        self.stdout.write('\n=== FINAL VERIFICATION ===')
        
        inventory_total = Item.objects.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
        funding_spent = Fund.objects.aggregate(total=Sum('spent_amount'))['total'] or Decimal('0.00')
        transaction_total = Transaction.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        self.stdout.write(f'Final Inventory Value: ${inventory_total:,}')
        self.stdout.write(f'Final Funding Spent: ${funding_spent:,}')
        self.stdout.write(f'Final Transaction Total: ${transaction_total:,}')
        self.stdout.write(f'Final Discrepancy: ${funding_spent - inventory_total:,}')
        
        # Check fund consistency
        for fund in Fund.objects.all():
            transaction_sum = fund.transactions.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            if abs(fund.spent_amount - transaction_sum) > Decimal('0.01'):
                self.stdout.write(self.style.ERROR(
                    f'Inconsistency in {fund.name}: spent=${fund.spent_amount}, transactions=${transaction_sum}'
                ))
        
        # Check for over-budget funds
        over_budget_funds = []
        for fund in Fund.objects.all():
            if fund.spent_amount > fund.total_budget:
                over_budget_funds.append(fund)
        
        if over_budget_funds:
            self.stdout.write(self.style.WARNING('Funds over budget:'))
            for fund in over_budget_funds:
                self.stdout.write(f'  {fund.name}: ${fund.spent_amount:,} / ${fund.total_budget:,}')
        else:
            self.stdout.write(self.style.SUCCESS('All funds are within budget'))