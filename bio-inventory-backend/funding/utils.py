from decimal import Decimal
from datetime import datetime, timedelta
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from .models import Fund, Transaction, BudgetAllocation


def calculate_budget_health_score(fund):
    """Calculate a health score (0-100) for a fund based on utilization and time remaining"""
    utilization = fund.utilization_percentage
    
    # Time-based scoring
    time_score = 100
    if fund.end_date:
        total_duration = (fund.end_date - fund.start_date).days if fund.start_date else 365
        remaining_days = (fund.end_date - timezone.now().date()).days
        
        if total_duration > 0:
            time_progress = (total_duration - remaining_days) / total_duration * 100
            # Ideal spending should match time progress
            time_vs_spending_diff = abs(time_progress - utilization)
            time_score = max(0, 100 - time_vs_spending_diff)
    
    # Utilization scoring (penalize both under and over-utilization)
    if utilization < 50:
        util_score = utilization * 1.5  # Under-utilization penalty
    elif utilization > 90:
        util_score = max(0, 100 - (utilization - 90) * 10)  # Over-utilization penalty
    else:
        util_score = 100
    
    # Combined score
    health_score = (time_score * 0.6 + util_score * 0.4)
    return round(health_score, 1)


def get_spending_predictions(fund, months_ahead=6):
    """Predict future spending based on historical trends"""
    # Get recent transactions (last 90 days)
    recent_date = timezone.now() - timedelta(days=90)
    recent_transactions = Transaction.objects.filter(
        fund=fund,
        transaction_date__gte=recent_date,
        transaction_type__in=['purchase', 'adjustment']
    )
    
    if not recent_transactions.exists():
        return {
            'predicted_monthly_spend': Decimal('0.00'),
            'predicted_total': Decimal('0.00'),
            'budget_exhaustion_date': None,
            'risk_level': 'low'
        }
    
    # Calculate average monthly spending
    total_recent_spending = recent_transactions.aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')
    
    monthly_avg = total_recent_spending / 3  # Last 3 months
    predicted_total = monthly_avg * months_ahead
    
    # Predict when budget will be exhausted
    remaining_budget = fund.remaining_budget
    exhaustion_date = None
    if monthly_avg > 0:
        months_until_exhaustion = remaining_budget / monthly_avg
        exhaustion_date = timezone.now() + timedelta(days=30 * months_until_exhaustion)
    
    # Determine risk level
    risk_level = 'low'
    if fund.utilization_percentage > 90:
        risk_level = 'critical'
    elif fund.utilization_percentage > 75:
        risk_level = 'high'
    elif monthly_avg * 12 > remaining_budget:
        risk_level = 'medium'
    
    return {
        'predicted_monthly_spend': monthly_avg,
        'predicted_total': predicted_total,
        'budget_exhaustion_date': exhaustion_date,
        'risk_level': risk_level
    }


def generate_fund_recommendations(fund):
    """Generate actionable recommendations for fund management"""
    recommendations = []
    
    utilization = fund.utilization_percentage
    health_score = calculate_budget_health_score(fund)
    predictions = get_spending_predictions(fund)
    
    # Budget utilization recommendations
    if utilization < 30:
        recommendations.append({
            'type': 'utilization',
            'severity': 'medium',
            'title': 'Low Fund Utilization',
            'message': f'Fund is only {utilization:.1f}% utilized. Consider reallocating or planning additional purchases.',
            'action': 'Review spending plans and consider budget reallocation'
        })
    elif utilization > 95:
        recommendations.append({
            'type': 'utilization',
            'severity': 'critical',
            'title': 'Budget Nearly Exhausted',
            'message': f'Fund is {utilization:.1f}% utilized. Immediate attention required.',
            'action': 'Request budget extension or halt non-essential purchases'
        })
    elif utilization > 85:
        recommendations.append({
            'type': 'utilization',
            'severity': 'high',
            'title': 'High Budget Utilization',
            'message': f'Fund is {utilization:.1f}% utilized. Monitor spending closely.',
            'action': 'Review remaining purchases and prioritize essential items'
        })
    
    # Time-based recommendations
    if fund.end_date:
        days_remaining = (fund.end_date - timezone.now().date()).days
        if days_remaining < 30:
            recommendations.append({
                'type': 'timeline',
                'severity': 'high',
                'title': 'Fund Expiring Soon',
                'message': f'Fund expires in {days_remaining} days with ${fund.remaining_budget:.2f} remaining.',
                'action': 'Expedite pending purchases or request no-cost extension'
            })
        elif days_remaining < 90 and utilization < 50:
            recommendations.append({
                'type': 'timeline',
                'severity': 'medium',
                'title': 'Under-spending Risk',
                'message': f'Fund expires in {days_remaining} days but only {utilization:.1f}% utilized.',
                'action': 'Accelerate spending or plan equipment purchases'
            })
    
    # Health score recommendations
    if health_score < 40:
        recommendations.append({
            'type': 'health',
            'severity': 'high',
            'title': 'Poor Fund Health',
            'message': f'Fund health score is {health_score}/100. Review spending strategy.',
            'action': 'Consult with PI and finance team for spending optimization'
        })
    
    # Prediction-based recommendations
    if predictions['risk_level'] == 'critical':
        recommendations.append({
            'type': 'prediction',
            'severity': 'critical',
            'title': 'Critical Spending Risk',
            'message': 'Current spending rate will exhaust budget prematurely.',
            'action': 'Implement immediate spending controls'
        })
    
    return recommendations


def get_cross_fund_analysis():
    """Analyze spending patterns across all funds"""
    active_funds = Fund.objects.filter(is_archived=False)
    
    # Overall statistics
    total_budget = active_funds.aggregate(total=Sum('total_budget'))['total'] or Decimal('0.00')
    total_spent = active_funds.aggregate(total=Sum('spent_amount'))['total'] or Decimal('0.00')
    avg_utilization = sum(fund.utilization_percentage for fund in active_funds) / len(active_funds) if active_funds else 0
    
    # Risk categorization
    risk_categories = {
        'critical': active_funds.filter(spent_amount__gt=F('total_budget') * 0.95).count(),
        'high': active_funds.filter(
            spent_amount__gt=F('total_budget') * 0.85,
            spent_amount__lte=F('total_budget') * 0.95
        ).count(),
        'medium': active_funds.filter(
            spent_amount__gt=F('total_budget') * 0.65,
            spent_amount__lte=F('total_budget') * 0.85
        ).count(),
        'low': active_funds.filter(spent_amount__lte=F('total_budget') * 0.65).count()
    }
    
    # Spending velocity (last 30 days)
    thirty_days_ago = timezone.now() - timedelta(days=30)
    recent_spending = Transaction.objects.filter(
        fund__in=active_funds,
        transaction_date__gte=thirty_days_ago,
        transaction_type__in=['purchase', 'adjustment']
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    
    # Top spending categories
    category_spending = BudgetAllocation.objects.filter(
        fund__in=active_funds
    ).values('category').annotate(
        total_allocated=Sum('allocated_amount'),
        total_spent=Sum('spent_amount')
    ).order_by('-total_spent')
    
    return {
        'total_budget': total_budget,
        'total_spent': total_spent,
        'total_remaining': total_budget - total_spent,
        'overall_utilization': (total_spent / total_budget * 100) if total_budget > 0 else 0,
        'average_utilization': avg_utilization,
        'fund_count': active_funds.count(),
        'risk_distribution': risk_categories,
        'monthly_spending_rate': recent_spending,
        'category_breakdown': list(category_spending)
    }