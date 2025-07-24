from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from decimal import Decimal
import sys

from funding.models import Fund, Transaction
from requests.models import Request
from items.models import Item


class Command(BaseCommand):
    help = 'Fix funding data inconsistencies - synchronize with actual inventory values'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making actual changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('Running in DRY RUN mode - no changes will be made'))
        
        # Step 1: Analyze current data
        self.stdout.write('\n=== ANALYZING CURRENT DATA ===')
        self.analyze_data_discrepancies()
        
        # Step 2: Fix transaction amounts
        self.stdout.write('\n=== FIXING TRANSACTION AMOUNTS ===')
        self.fix_transaction_amounts(dry_run)
        
        # Step 3: Recalculate fund spent amounts
        self.stdout.write('\n=== RECALCULATING FUND SPENT AMOUNTS ===')
        self.recalculate_fund_spent_amounts(dry_run)
        
        # Step 4: Final verification
        self.stdout.write('\n=== VERIFICATION ===')
        self.verify_data_integrity()
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN completed. Use without --dry-run to apply changes.'))
        else:
            self.stdout.write(self.style.SUCCESS('\nData correction completed successfully!'))

    def analyze_data_discrepancies(self):
        # Get total inventory value
        inventory_total = Item.objects.aggregate(
            total=Sum('price')
        )['total'] or Decimal('0.00')
        
        # Get total funding spent
        funding_spent = Fund.objects.aggregate(
            total=Sum('spent_amount')
        )['total'] or Decimal('0.00')
        
        # Get transaction totals
        transaction_total = Transaction.objects.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        
        # Get request values
        approved_requests_value = Decimal('0.00')
        requests_with_funding = Request.objects.filter(
            fund_id__isnull=False,
            status__in=['APPROVED', 'ORDERED', 'RECEIVED']
        )
        for req in requests_with_funding:
            approved_requests_value += req.unit_price * req.quantity
        
        self.stdout.write(f'Total Inventory Value: ${inventory_total:,}')
        self.stdout.write(f'Total Funding Spent (Funds): ${funding_spent:,}')
        self.stdout.write(f'Total Transaction Amounts: ${transaction_total:,}')
        self.stdout.write(f'Total Approved Requests Value: ${approved_requests_value:,}')
        
        # Identify discrepancies
        funding_vs_inventory_diff = funding_spent - inventory_total
        funding_vs_transactions_diff = funding_spent - transaction_total
        
        if abs(funding_vs_inventory_diff) > 1:
            self.stdout.write(self.style.ERROR(
                f'DISCREPANCY: Funding spent exceeds inventory value by ${funding_vs_inventory_diff:,}'
            ))
        
        if abs(funding_vs_transactions_diff) > 1:
            self.stdout.write(self.style.ERROR(
                f'DISCREPANCY: Fund spent amounts don\'t match transaction totals by ${funding_vs_transactions_diff:,}'
            ))

    def fix_transaction_amounts(self, dry_run=False):
        """Fix transactions that are linked to requests but have incorrect amounts"""
        corrections_made = 0
        
        # Fix transactions linked to requests
        transactions_with_requests = Transaction.objects.filter(request_id__isnull=False)
        
        for trans in transactions_with_requests:
            try:
                request = Request.objects.get(id=trans.request_id)
                correct_amount = request.unit_price * request.quantity
                
                if abs(trans.amount - correct_amount) > Decimal('0.01'):
                    self.stdout.write(f'Transaction {trans.id}: {trans.item_name}')
                    self.stdout.write(f'  Current amount: ${trans.amount}')
                    self.stdout.write(f'  Correct amount: ${correct_amount}')
                    self.stdout.write(f'  Difference: ${trans.amount - correct_amount}')
                    
                    if not dry_run:
                        trans.amount = correct_amount
                        trans.save()
                    
                    corrections_made += 1
                    
            except Request.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'Transaction {trans.id} references non-existent request {trans.request_id}'
                ))
                # Consider removing this transaction or marking it
                if not dry_run:
                    self.stdout.write(f'  Removing orphaned transaction')
                    trans.delete()
                    corrections_made += 1
        
        # Fix transactions not linked to requests - validate against reasonable ranges
        orphaned_transactions = Transaction.objects.filter(request_id__isnull=True)
        
        for trans in orphaned_transactions:
            # Check if amount is unreasonably high
            if trans.amount > Decimal('100000.00'):  # More than $100k seems suspicious
                self.stdout.write(self.style.WARNING(
                    f'Suspicious high amount transaction {trans.id}: ${trans.amount} for {trans.item_name}'
                ))
                # Consider capping or reviewing these
                if not dry_run:
                    # Cap at reasonable amount based on item name
                    if 'equipment' in trans.item_name.lower() or 'microscope' in trans.item_name.lower():
                        trans.amount = min(trans.amount, Decimal('50000.00'))
                    else:
                        trans.amount = min(trans.amount, Decimal('5000.00'))
                    trans.save()
                    corrections_made += 1
        
        self.stdout.write(f'Corrected {corrections_made} transaction amounts')

    def recalculate_fund_spent_amounts(self, dry_run=False):
        """Recalculate spent amounts for all funds based on their transactions"""
        
        for fund in Fund.objects.all():
            # Calculate actual spent amount from transactions
            actual_spent = Transaction.objects.filter(fund=fund).aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00')
            
            # Subtract refunds
            refunds = Transaction.objects.filter(
                fund=fund, 
                transaction_type='refund'
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            actual_spent = actual_spent - refunds
            
            if abs(fund.spent_amount - actual_spent) > Decimal('0.01'):
                self.stdout.write(f'Fund {fund.name}:')
                self.stdout.write(f'  Current spent: ${fund.spent_amount}')
                self.stdout.write(f'  Actual spent: ${actual_spent}')
                self.stdout.write(f'  Difference: ${fund.spent_amount - actual_spent}')
                
                if not dry_run:
                    fund.spent_amount = actual_spent
                    fund.save()

    def verify_data_integrity(self):
        """Verify data integrity after corrections"""
        
        # Check that all funds have reasonable utilization
        problematic_funds = []
        for fund in Fund.objects.all():
            if fund.spent_amount > fund.total_budget:
                over_amount = fund.spent_amount - fund.total_budget
                problematic_funds.append((fund, over_amount))
        
        if problematic_funds:
            self.stdout.write(self.style.ERROR('Funds over budget:'))
            for fund, over_amount in problematic_funds:
                self.stdout.write(f'  {fund.name}: Over by ${over_amount}')
        
        # Check transaction-fund consistency
        for fund in Fund.objects.all():
            transaction_sum = Transaction.objects.filter(fund=fund).aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00')
            
            if abs(fund.spent_amount - transaction_sum) > Decimal('0.01'):
                self.stdout.write(self.style.ERROR(
                    f'Fund {fund.name}: spent_amount (${fund.spent_amount}) != transaction sum (${transaction_sum})'
                ))
        
        # Summary
        total_inventory = Item.objects.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
        total_funding = Fund.objects.aggregate(total=Sum('spent_amount'))['total'] or Decimal('0.00')
        
        self.stdout.write(f'Final totals:')
        self.stdout.write(f'  Inventory value: ${total_inventory:,}')
        self.stdout.write(f'  Funding spent: ${total_funding:,}')
        self.stdout.write(f'  Difference: ${total_funding - total_inventory:,}')