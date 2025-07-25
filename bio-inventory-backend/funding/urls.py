from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FundViewSet, TransactionViewSet, BudgetAllocationViewSet,
    FundingReportViewSet, PersonnelExpenseViewSet
)
from .enhanced_views import (
    EnhancedFundViewSet, FinancialTransactionViewSet,
    BudgetForecastViewSet, FinancialAlertViewSet
)

router = DefaultRouter()
router.register(r'funds', FundViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'budget-allocations', BudgetAllocationViewSet)
router.register(r'personnel-expenses', PersonnelExpenseViewSet)
router.register(r'reports', FundingReportViewSet)
# Enhanced views
router.register(r'enhanced-funds', EnhancedFundViewSet)
router.register(r'enhanced-transactions', FinancialTransactionViewSet)
router.register(r'budget-forecasts', BudgetForecastViewSet)
router.register(r'financial-alerts', FinancialAlertViewSet)

from django.http import JsonResponse
from django.db.models import Sum
from .models import Fund

def budget_summary_view(request):
    """Budget summary endpoint for compatibility"""
    try:
        funds = Fund.objects.filter(status='active')
        total_budget = funds.aggregate(total=Sum('total_budget'))['total'] or 0
        total_spent = funds.aggregate(total=Sum('spent_amount'))['total'] or 0
        
        return JsonResponse({
            'total_budget': float(total_budget),
            'total_spent': float(total_spent),
            'available_budget': float(total_budget - total_spent),
            'utilization_rate': float((total_spent / total_budget * 100) if total_budget > 0 else 0)
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

urlpatterns = [
    path('', include(router.urls)),
    path('budget-summary/', budget_summary_view, name='budget-summary'),
]