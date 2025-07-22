from django.core.management.base import BaseCommand
from django.db.models import Sum
from decimal import Decimal

from funding.models import Fund, Transaction
from requests.models import Request
from items.models import Item


class Command(BaseCommand):
    help = 'Validate funding data integrity and consistency'

    def handle(self, *args, **options):
        self.stdout.write('=== FUNDING DATA INTEGRITY CHECK ===\n')
        
        # Check 1: Fund spent amounts match transaction totals
        self.check_fund_transaction_consistency()
        
        # Check 2: Overall data consistency  
        self.check_overall_data_consistency()
        
        # Check 3: Budget constraints
        self.check_budget_constraints()
        
        # Check 4: Transaction-Request consistency
        self.check_transaction_request_consistency()
        
        self.stdout.write('\n=== INTEGRITY CHECK COMPLETE ===')

    def check_fund_transaction_consistency(self):
        self.stdout.write('1. Checking fund spent amounts vs transaction totals...')
        
        inconsistent_funds = []
        for fund in Fund.objects.all():
            transaction_total = fund.transactions.aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00')
            
            if abs(fund.spent_amount - transaction_total) > Decimal('0.01'):
                inconsistent_funds.append((fund, fund.spent_amount, transaction_total))
        
        if inconsistent_funds:
            self.stdout.write(self.style.ERROR('   INCONSISTENCIES FOUND:'))
            for fund, spent, transaction_total in inconsistent_funds:
                diff = spent - transaction_total
                self.stdout.write(f'   - {fund.name}: Spent=${spent}, Transactions=${transaction_total}, Diff=${diff}')
        else:
            self.stdout.write(self.style.SUCCESS('   [OK] All funds consistent with transaction totals'))

    def check_overall_data_consistency(self):
        self.stdout.write('\n2. Checking overall data consistency...')
        
        inventory_total = Item.objects.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
        funding_spent = Fund.objects.aggregate(total=Sum('spent_amount'))['total'] or Decimal('0.00')
        transaction_total = Transaction.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        self.stdout.write(f'   Inventory Total: ${inventory_total:,}')
        self.stdout.write(f'   Funding Spent: ${funding_spent:,}')
        self.stdout.write(f'   Transaction Total: ${transaction_total:,}')
        
        if abs(funding_spent - transaction_total) > Decimal('0.01'):
            self.stdout.write(self.style.ERROR(f'   [ERROR] Funding vs Transaction mismatch: ${funding_spent - transaction_total:,}'))
        else:
            self.stdout.write(self.style.SUCCESS('   [OK] Funding and transaction totals match'))

    def check_budget_constraints(self):
        self.stdout.write('\n3. Checking budget constraints...')
        
        over_budget_funds = []
        for fund in Fund.objects.all():
            if fund.spent_amount > fund.total_budget:
                over_amount = fund.spent_amount - fund.total_budget
                over_budget_funds.append((fund, over_amount))
        
        if over_budget_funds:
            self.stdout.write(self.style.WARNING('   FUNDS OVER BUDGET:'))
            for fund, over_amount in over_budget_funds:
                self.stdout.write(f'   - {fund.name}: Over by ${over_amount:,}')
        else:
            self.stdout.write(self.style.SUCCESS('   [OK] All funds within budget constraints'))

    def check_transaction_request_consistency(self):
        self.stdout.write('\n4. Checking transaction-request consistency...')
        
        # Check transactions with request_id
        inconsistent_transactions = []
        transactions_with_requests = Transaction.objects.filter(request_id__isnull=False)
        
        for transaction in transactions_with_requests:
            try:
                request = Request.objects.get(id=transaction.request_id)
                expected_amount = request.unit_price * request.quantity
                
                if abs(transaction.amount - expected_amount) > Decimal('0.01'):
                    inconsistent_transactions.append((transaction, expected_amount))
                    
            except Request.DoesNotExist:
                inconsistent_transactions.append((transaction, 'Request not found'))
        
        if inconsistent_transactions:
            self.stdout.write(self.style.WARNING('   TRANSACTION-REQUEST INCONSISTENCIES:'))
            for transaction, issue in inconsistent_transactions:
                if isinstance(issue, str):
                    self.stdout.write(f'   - Transaction {transaction.id}: {issue}')
                else:
                    self.stdout.write(f'   - Transaction {transaction.id}: Amount=${transaction.amount}, Expected=${issue}')
        else:
            self.stdout.write(self.style.SUCCESS('   [OK] All transactions with request_id are consistent'))
        
        # Summary statistics
        total_transactions = Transaction.objects.count()
        transactions_with_requests_count = transactions_with_requests.count()
        orphan_transactions = total_transactions - transactions_with_requests_count
        
        self.stdout.write(f'   Total transactions: {total_transactions}')
        self.stdout.write(f'   Linked to requests: {transactions_with_requests_count}')
        self.stdout.write(f'   Orphan transactions: {orphan_transactions}')