import django_filters
from django.db import models
from .models import Fund, Transaction, BudgetAllocation


class FundFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr='icontains')
    funding_source = django_filters.CharFilter(lookup_expr='icontains')
    principal_investigator = django_filters.CharFilter(lookup_expr='icontains')
    total_budget_min = django_filters.NumberFilter(field_name='total_budget', lookup_expr='gte')
    total_budget_max = django_filters.NumberFilter(field_name='total_budget', lookup_expr='lte')
    utilization_min = django_filters.NumberFilter(method='filter_utilization_min')
    utilization_max = django_filters.NumberFilter(method='filter_utilization_max')
    start_date_after = django_filters.DateFilter(field_name='start_date', lookup_expr='gte')
    start_date_before = django_filters.DateFilter(field_name='start_date', lookup_expr='lte')
    end_date_after = django_filters.DateFilter(field_name='end_date', lookup_expr='gte')
    end_date_before = django_filters.DateFilter(field_name='end_date', lookup_expr='lte')
    is_archived = django_filters.BooleanFilter()
    
    class Meta:
        model = Fund
        fields = [
            'name', 'funding_source', 'principal_investigator', 
            'is_archived', 'created_by'
        ]

    def filter_utilization_min(self, queryset, name, value):
        # Filter funds with utilization >= value
        return queryset.extra(
            where=["(spent_amount / total_budget * 100) >= %s"],
            params=[value]
        )

    def filter_utilization_max(self, queryset, name, value):
        # Filter funds with utilization <= value
        return queryset.extra(
            where=["(spent_amount / total_budget * 100) <= %s"],
            params=[value]
        )


class TransactionFilter(django_filters.FilterSet):
    fund_name = django_filters.CharFilter(field_name='fund__name', lookup_expr='icontains')
    amount_min = django_filters.NumberFilter(field_name='amount', lookup_expr='gte')
    amount_max = django_filters.NumberFilter(field_name='amount', lookup_expr='lte')
    date_after = django_filters.DateTimeFilter(field_name='transaction_date', lookup_expr='gte')
    date_before = django_filters.DateTimeFilter(field_name='transaction_date', lookup_expr='lte')
    item_name = django_filters.CharFilter(lookup_expr='icontains')
    description = django_filters.CharFilter(lookup_expr='icontains')
    
    class Meta:
        model = Transaction
        fields = [
            'fund', 'transaction_type', 'request_id', 'created_by'
        ]


class BudgetAllocationFilter(django_filters.FilterSet):
    fund_name = django_filters.CharFilter(field_name='fund__name', lookup_expr='icontains')
    category = django_filters.CharFilter(lookup_expr='icontains')
    allocated_amount_min = django_filters.NumberFilter(field_name='allocated_amount', lookup_expr='gte')
    allocated_amount_max = django_filters.NumberFilter(field_name='allocated_amount', lookup_expr='lte')
    utilization_min = django_filters.NumberFilter(method='filter_utilization_min')
    utilization_max = django_filters.NumberFilter(method='filter_utilization_max')
    
    class Meta:
        model = BudgetAllocation
        fields = ['fund', 'category']

    def filter_utilization_min(self, queryset, name, value):
        return queryset.extra(
            where=["(spent_amount / allocated_amount * 100) >= %s"],
            params=[value]
        )

    def filter_utilization_max(self, queryset, name, value):
        return queryset.extra(
            where=["(spent_amount / allocated_amount * 100) <= %s"],
            params=[value]
        )