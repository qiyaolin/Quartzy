from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from decimal import Decimal
from .models import Transaction, BudgetAllocation


@receiver(post_save, sender=Transaction)
def recalculate_fund_on_transaction_save(sender, instance, **kwargs):
    """Automatically recalculate fund spent amount when a transaction is saved"""
    if instance.fund:
        instance.fund.recalculate_spent_amount()
        instance.fund.save(update_fields=['spent_amount'])


@receiver(post_delete, sender=Transaction)
def recalculate_fund_on_transaction_delete(sender, instance, **kwargs):
    """Automatically recalculate fund spent amount when a transaction is deleted"""
    if instance.fund:
        instance.fund.recalculate_spent_amount()
        instance.fund.save(update_fields=['spent_amount'])