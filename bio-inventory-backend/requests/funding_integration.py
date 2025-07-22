from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal
from .models import Request, RequestHistory


@receiver(post_save, sender=Request)
def create_transaction_on_approval(sender, instance, created, **kwargs):
    """Create a funding transaction when a request is approved or ordered"""
    if not created and instance.fund_id:  # Only for existing requests with funding
        # Check if status changed to APPROVED or ORDERED
        try:
            # Import here to avoid circular imports
            from funding.models import Fund, Transaction
            
            # Get the latest history entry to see if status just changed
            latest_history = RequestHistory.objects.filter(request=instance).first()
            
            if (latest_history and 
                latest_history.new_status in ['APPROVED', 'ORDERED'] and 
                latest_history.old_status not in ['APPROVED', 'ORDERED']):
                
                # Get the fund
                try:
                    fund = Fund.objects.get(id=instance.fund_id)
                except Fund.DoesNotExist:
                    return  # Fund doesn't exist, skip transaction creation
                
                # Calculate total cost
                total_cost = instance.unit_price * instance.quantity
                
                # Check if fund can afford this
                if not fund.can_afford(total_cost):
                    # Could add logging here or send notification
                    pass
                
                # Create transaction (signals will automatically update fund spent amount)
                Transaction.objects.create(
                    fund=fund,
                    amount=total_cost,
                    transaction_type='purchase',
                    item_name=instance.item_name,
                    description=f"Purchase of {instance.item_name} (Request #{instance.id})",
                    request_id=instance.id,
                    created_by=latest_history.user or instance.requested_by
                )
                
        except ImportError:
            # Funding app not installed
            pass
        except Exception as e:
            # Log error but don't break the request workflow
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create funding transaction for request {instance.id}: {e}")


def validate_fund_budget(request_instance, fund_id):
    """Validate that a fund has sufficient budget for a request"""
    try:
        from funding.models import Fund
        
        fund = Fund.objects.get(id=fund_id)
        total_cost = request_instance.unit_price * request_instance.quantity
        
        return {
            'valid': fund.can_afford(total_cost),
            'fund': fund,
            'total_cost': total_cost,
            'remaining_budget': fund.remaining_budget,
            'utilization_after': ((fund.spent_amount + total_cost) / fund.total_budget * 100) if fund.total_budget > 0 else 0
        }
        
    except Exception:
        return {
            'valid': False,
            'error': 'Fund validation failed'
        }