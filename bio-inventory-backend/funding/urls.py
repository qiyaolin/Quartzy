from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FundViewSet, TransactionViewSet, BudgetAllocationViewSet, 
    FundingReportViewSet
)

router = DefaultRouter()
router.register(r'funds', FundViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'budget-allocations', BudgetAllocationViewSet)
router.register(r'reports', FundingReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Alias for budget summary endpoint
    path('budget-summary/', FundingReportViewSet.as_view({'get': 'budget_summary'}), name='budget-summary'),
]