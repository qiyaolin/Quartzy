from django_filters import rest_framework as filters
from .models import Item

class ItemFilter(filters.FilterSet):
    # Allows filtering by making case-insensitive partial matches on the name.
    name = filters.CharFilter(field_name='name', lookup_expr='icontains')

    class Meta:
        model = Item
        # Define the fields that can be filtered with an exact match.
        fields = ['location', 'item_type', 'vendor', 'owner'] 