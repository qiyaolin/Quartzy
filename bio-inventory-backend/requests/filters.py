from django_filters import rest_framework as filters
from .models import Request

class RequestFilter(filters.FilterSet):
    item_name = filters.CharFilter(field_name='item_name', lookup_expr='icontains')

    class Meta:
        model = Request
        fields = ['status', 'vendor', 'requested_by'] 