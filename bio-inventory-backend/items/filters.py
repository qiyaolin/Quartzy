from django_filters import rest_framework as filters
from .models import Item
from django.db import models
from datetime import date, timedelta

class ItemFilter(filters.FilterSet):
    # Allows filtering by making case-insensitive partial matches on the name.
    name = filters.CharFilter(field_name='name', lookup_expr='icontains')
    catalog_number = filters.CharFilter(field_name='catalog_number', lookup_expr='icontains')
    lot_number = filters.CharFilter(field_name='lot_number', lookup_expr='icontains')
    
    # Expiration status filters
    expired = filters.BooleanFilter(method='filter_expired')
    expiring_soon = filters.BooleanFilter(method='filter_expiring_soon')
    expires_within_days = filters.NumberFilter(method='filter_expires_within_days')
    
    # Stock status filters
    low_stock = filters.BooleanFilter(method='filter_low_stock')
    needs_attention = filters.BooleanFilter(method='filter_needs_attention')
    
    # Storage condition filters
    storage_temperature = filters.CharFilter(field_name='storage_temperature', lookup_expr='icontains')
    
    # Date range filters
    expiration_date_from = filters.DateFilter(field_name='expiration_date', lookup_expr='gte')
    expiration_date_to = filters.DateFilter(field_name='expiration_date', lookup_expr='lte')
    received_date_from = filters.DateFilter(field_name='received_date', lookup_expr='gte')
    received_date_to = filters.DateFilter(field_name='received_date', lookup_expr='lte')

    def filter_expired(self, queryset, name, value):
        if value:
            return queryset.filter(expiration_date__lt=date.today()).exclude(expiration_date__isnull=True)
        return queryset
    
    def filter_expiring_soon(self, queryset, name, value):
        if value:
            # Items expiring within their alert period but not yet expired
            today = date.today()
            return queryset.filter(
                expiration_date__gte=today,
                expiration_date__lte=models.F('expiration_alert_days') + today
            ).exclude(expiration_date__isnull=True)
        return queryset
    
    def filter_expires_within_days(self, queryset, name, value):
        if value is not None:
            target_date = date.today() + timedelta(days=value)
            return queryset.filter(
                expiration_date__gte=date.today(),
                expiration_date__lte=target_date
            ).exclude(expiration_date__isnull=True)
        return queryset
    
    def filter_low_stock(self, queryset, name, value):
        if value:
            return queryset.filter(
                quantity__lte=models.F('low_stock_threshold')
            ).exclude(low_stock_threshold__isnull=True)
        return queryset
    
    def filter_needs_attention(self, queryset, name, value):
        if value:
            today = date.today()
            return queryset.filter(
                models.Q(expiration_date__lt=today) |  # Expired
                models.Q(expiration_date__gte=today, expiration_date__lte=models.F('expiration_alert_days') + today) |  # Expiring soon
                models.Q(quantity__lte=models.F('low_stock_threshold'), low_stock_threshold__isnull=False)  # Low stock
            )
        return queryset

    class Meta:
        model = Item
        # Define the fields that can be filtered with an exact match.
        fields = ['location', 'item_type', 'vendor', 'owner', 'is_archived'] 