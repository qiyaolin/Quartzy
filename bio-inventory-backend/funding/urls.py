from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FundViewSet, TransactionViewSet, BudgetAllocationViewSet, 
    FundingReportViewSet, FundCarryOverViewSet
)

router = DefaultRouter()
router.register(r'funds', FundViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'budget-allocations', BudgetAllocationViewSet)
router.register(r'reports', FundingReportViewSet)
router.register(r'carryovers', FundCarryOverViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Alias for budget summary endpoint
    path('budget-summary/', FundingReportViewSet.as_view({'get': 'budget_summary'}), name='budget-summary'),
    # Explicit paths for report generation endpoints
    path('reports/generate_form300/', FundingReportViewSet.as_view({'post': 'generate_form300'}), name='generate-form300'),
    path('reports/generate_multiyear_summary/', FundingReportViewSet.as_view({'post': 'generate_multiyear_summary'}), name='generate-multiyear-summary'),
]