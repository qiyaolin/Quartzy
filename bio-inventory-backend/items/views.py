from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter # Import SearchFilter
from django_filters import rest_framework as filters # Import django_filters
from .models import Vendor, Location, ItemType, Item
from .serializers import VendorSerializer, LocationSerializer, ItemTypeSerializer, ItemSerializer
from .filters import ItemFilter # Import our filter class

class VendorViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows vendors to be viewed or edited.
    """
    queryset = Vendor.objects.all().order_by('name')
    serializer_class = VendorSerializer

class LocationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows locations to be viewed or edited.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

class ItemTypeViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows item types to be viewed or edited.
    """
    queryset = ItemType.objects.all().order_by('name')
    serializer_class = ItemTypeSerializer

class ItemViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows items to be viewed or edited.
    """
    queryset = Item.objects.filter(is_archived=False)
    serializer_class = ItemSerializer
    filterset_class = ItemFilter # Connect the filter class
    filter_backends = [SearchFilter, filters.DjangoFilterBackend] # Add SearchFilter
    search_fields = ['name', 'catalog_number', 'vendor__name'] # Define fields that the SearchFilter will search across
