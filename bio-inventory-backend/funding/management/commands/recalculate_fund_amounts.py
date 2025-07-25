from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from funding.models import Fund
from decimal import Decimal


class Command(BaseCommand):
    help = 'Recalculate fund spent amounts from actual inventory and personnel data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fund-id',
            type=int,
            help='Recalculate only for specific fund ID',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        fund_id = options.get('fund_id')
        dry_run = options.get('dry_run')
        
        if fund_id:
            funds = Fund.objects.filter(id=fund_id)
            if not funds.exists():
                self.stdout.write(
                    self.style.ERROR(f'Fund with ID {fund_id} not found')
                )
                return
        else:
            funds = Fund.objects.all()

        self.stdout.write(f'Processing {funds.count()} fund(s)...')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        updated_count = 0
        total_old_amount = Decimal('0.00')
        total_new_amount = Decimal('0.00')

        for fund in funds:
            old_spent = fund.spent_amount
            new_spent = fund.recalculate_spent_amount()
            
            total_old_amount += old_spent
            total_new_amount += new_spent
            
            if old_spent != new_spent:
                self.stdout.write(
                    f'Fund "{fund.name}" (ID: {fund.id}): '
                    f'${old_spent} -> ${new_spent} '
                    f'(diff: ${new_spent - old_spent})'
                )
                
                if not dry_run:
                    fund.save()
                    updated_count += 1
            else:
                self.stdout.write(
                    f'Fund "{fund.name}" (ID: {fund.id}): No change needed (${old_spent})'
                )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'DRY RUN COMPLETE: {updated_count} funds would be updated'
                )
            )
        else:
            with transaction.atomic():
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully recalculated {updated_count} fund(s)'
                    )
                )

        self.stdout.write(
            f'Total spending changed from ${total_old_amount} to ${total_new_amount} '
            f'(diff: ${total_new_amount - total_old_amount})'
        )

        # Summary breakdown
        self.stdout.write('\n=== BREAKDOWN BY SOURCE ===')
        
        for fund in funds:
            from items.models import Item
            
            inventory_total = Item.objects.filter(
                fund_id=fund.id
            ).exclude(price__isnull=True).aggregate(
                total=Sum('price')
            )['total'] or Decimal('0.00')
            
            personnel_total = fund.personnel_expenses.filter(
                is_approved=True
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            transaction_total = fund.transactions.filter(
                transaction_type__in=['purchase', 'adjustment']
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            self.stdout.write(
                f'{fund.name}: Inventory=${inventory_total}, '
                f'Personnel=${personnel_total}, Transactions=${transaction_total}'
            )