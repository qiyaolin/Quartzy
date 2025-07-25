from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FundViewSet, TransactionViewSet, BudgetAllocationViewSet,
    FundingReportViewSet, PersonnelExpenseViewSet
)

router = DefaultRouter()
router.register(r'funds', FundViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'budget-allocations', BudgetAllocationViewSet)
router.register(r'personnel-expenses', PersonnelExpenseViewSet)
router.register(r'reports', FundingReportViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
]