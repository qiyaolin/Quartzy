from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from decimal import Decimal
from .models import Transaction, BudgetAllocation


@receiver(post_save, sender=Transaction)
def update_fund_spent_amount(sender, instance, created, **kwargs):
    """Update fund spent amount when a transaction is created or updated"""
    if created:
        # Only update on creation, as editing might cause double counting
        fund = instance.fund
        
        # Calculate total spent amount from all transactions
        from django.db.models import Sum
        
        total_spent = Transaction.objects.filter(
            fund=fund,
            transaction_type__in=['purchase', 'adjustment']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Subtract refunds
        total_refunds = Transaction.objects.filter(
            fund=fund,
            transaction_type='refund'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        fund.spent_amount = max(total_spent - total_refunds, Decimal('0.00'))
        fund.save()


@receiver(post_delete, sender=Transaction)
def update_fund_spent_amount_on_delete(sender, instance, **kwargs):
    """Update fund spent amount when a transaction is deleted"""
    fund = instance.fund
    
    # Recalculate total spent amount
    from django.db.models import Sum
    
    total_spent = Transaction.objects.filter(
        fund=fund,
        transaction_type__in=['purchase', 'adjustment']
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    
    # Subtract refunds
    total_refunds = Transaction.objects.filter(
        fund=fund,
        transaction_type='refund'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    
    fund.spent_amount = max(total_spent - total_refunds, Decimal('0.00'))
    fund.save()


@receiver(post_save, sender=Transaction)
def update_budget_allocation_spent(sender, instance, created, **kwargs):
    """Update budget allocation spent amount when related transactions change"""
    if created and instance.transaction_type in ['purchase', 'adjustment']:
        from django.db.models import Sum
        
        fund = instance.fund
        allocations = BudgetAllocation.objects.filter(fund=fund)
        
        if not allocations.exists():
            return
        
        # Simple category matching based on item name keywords
        category_keywords = {
            'Equipment': ['equipment', 'instrument', 'machine', 'device', 'apparatus'],
            'Supplies': ['reagent', 'chemical', 'buffer', 'tube', 'tip', 'plate', 'consumable'],
            'Personnel': ['salary', 'wage', 'personnel', 'staff', 'labor'],
            'Travel': ['travel', 'conference', 'meeting', 'transportation'],
            'Other': []
        }
        
        # Try to match transaction to a specific category
        matched_category = 'Other'  # Default
        if instance.item_name:
            item_lower = instance.item_name.lower()
            for category, keywords in category_keywords.items():
                if any(keyword in item_lower for keyword in keywords):
                    matched_category = category
                    break
        
        # Update the matched allocation
        try:
            allocation = allocations.get(category=matched_category)
            
            # Recalculate spent amount for this category
            category_transactions = Transaction.objects.filter(
                fund=fund,
                transaction_type__in=['purchase', 'adjustment']
            )
            
            # Filter transactions that match this category
            category_spent = Decimal('0.00')
            for transaction in category_transactions:
                if transaction.item_name:
                    item_lower = transaction.item_name.lower()
                    transaction_category = 'Other'
                    for cat, keywords in category_keywords.items():
                        if any(keyword in item_lower for keyword in keywords):
                            transaction_category = cat
                            break
                    
                    if transaction_category == matched_category:
                        category_spent += transaction.amount
            
            allocation.spent_amount = category_spent
            allocation.save()
            
        except BudgetAllocation.DoesNotExist:
            # If no specific allocation exists, distribute proportionally
            total_spent = Transaction.objects.filter(
                fund=fund,
                transaction_type__in=['purchase', 'adjustment']
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            allocation_count = allocations.count()
            if allocation_count > 0:
                per_allocation = total_spent / allocation_count
                allocations.update(spent_amount=per_allocation)