from rest_framework import viewsets, permissions, status
from rest_framework.filters import SearchFilter # Import SearchFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters import rest_framework as filters # Import django_filters
from django.db.models import Q, Count, Sum, F
from datetime import date, timedelta
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
    search_fields = ['name', 'catalog_number', 'vendor__name', 'barcode'] # Define fields that the SearchFilter will search across
    
    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """Get items that need attention (expired, expiring soon, low stock)"""
        today = date.today()
        
        # Get expired items
        expired_items = self.queryset.filter(
            expiration_date__lt=today
        ).exclude(expiration_date__isnull=True)
        
        # Get expiring soon items
        expiring_soon_items = self.queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=F('expiration_alert_days') + today
        ).exclude(expiration_date__isnull=True)
        
        # Get low stock items
        low_stock_items = self.queryset.filter(
            quantity__lte=F('low_stock_threshold')
        ).exclude(low_stock_threshold__isnull=True)
        
        return Response({
            'expired': {
                'count': expired_items.count(),
                'items': ItemSerializer(expired_items[:10], many=True, context={'request': request}).data
            },
            'expiring_soon': {
                'count': expiring_soon_items.count(),
                'items': ItemSerializer(expiring_soon_items[:10], many=True, context={'request': request}).data
            },
            'low_stock': {
                'count': low_stock_items.count(),
                'items': ItemSerializer(low_stock_items[:10], many=True, context={'request': request}).data
            }
        })
    
    @action(detail=False, methods=['get'])
    def reports(self, request):
        """Generate laboratory reports and statistics"""
        today = date.today()
        
        # Basic inventory stats
        total_items = self.queryset.count()
        total_value = self.queryset.aggregate(total=Sum('price'))['total'] or 0
        
        # Expiration stats
        expired_count = self.queryset.filter(expiration_date__lt=today).exclude(expiration_date__isnull=True).count()
        expiring_30_days = self.queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=today + timedelta(days=30)
        ).exclude(expiration_date__isnull=True).count()
        
        # Stock stats
        low_stock_count = self.queryset.filter(
            quantity__lte=F('low_stock_threshold')
        ).exclude(low_stock_threshold__isnull=True).count()
        
        # Items by type
        items_by_type = self.queryset.values('item_type__name').annotate(
            count=Count('id'),
            total_value=Sum('price')
        ).order_by('-count')
        
        # Items by location
        items_by_location = self.queryset.filter(location__isnull=False).values('location__name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Items by vendor
        items_by_vendor = self.queryset.filter(vendor__isnull=False).values('vendor__name').annotate(
            count=Count('id'),
            total_value=Sum('price')
        ).order_by('-count')
        
        return Response({
            'summary': {
                'total_items': total_items,
                'total_value': float(total_value),
                'expired_items': expired_count,
                'expiring_in_30_days': expiring_30_days,
                'low_stock_items': low_stock_count
            },
            'breakdown': {
                'by_type': list(items_by_type),
                'by_location': list(items_by_location),
                'by_vendor': list(items_by_vendor)
            }
        })
    
    @action(detail=False, methods=['get'])
    def expiring_this_month(self, request):
        """Get items expiring this month"""
        today = date.today()
        end_of_month = today.replace(day=1) + timedelta(days=32)
        end_of_month = end_of_month.replace(day=1) - timedelta(days=1)
        
        expiring_items = self.queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=end_of_month
        ).exclude(expiration_date__isnull=True).order_by('expiration_date')
        
        serializer = ItemSerializer(expiring_items, many=True, context={'request': request})
        return Response({
            'count': expiring_items.count(),
            'items': serializer.data
        })

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        """
        Custom action to checkout an item by marking it as archived.
        """
        item = self.get_object()
        
        if item.is_archived:
            return Response({'error': 'Item is already checked out.'}, status=status.HTTP_400_BAD_REQUEST)

        barcode = request.data.get('barcode')
        notes = request.data.get('notes', f'Checked out via barcode scan: {barcode}')

        # Mark item as archived (checked out)
        item.is_archived = True
        item.last_used_date = date.today()
        item.save()

        return Response({
            'status': 'Item checked out successfully',
            'item_id': item.id,
            'barcode': item.barcode,
            'checked_out_by': request.user.username,
            'checkout_date': date.today()
        })

    @action(detail=False, methods=['post'])
    def checkout_by_barcode(self, request):
        """
        Checkout an item by barcode without knowing the item ID.
        This searches for an active (non-archived) item with the given barcode.
        """
        barcode = request.data.get('barcode')
        notes = request.data.get('notes', f'Checked out via barcode scan: {barcode}')

        if not barcode:
            return Response({'error': 'Barcode is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find the item with this barcode that is not archived
        try:
            item = Item.objects.get(barcode=barcode, is_archived=False)
        except Item.DoesNotExist:
            return Response({'error': 'No available item found with this barcode.'}, status=status.HTTP_404_NOT_FOUND)
        except Item.MultipleObjectsReturned:
            return Response({'error': 'Multiple items found with this barcode.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark item as archived (checked out)
        item.is_archived = True
        item.last_used_date = date.today()
        item.save()

        # Return the item details
        serializer = self.get_serializer(item)
        return Response({
            'status': 'Item checked out successfully',
            'item': serializer.data,
            'checked_out_by': request.user.username,
            'checkout_date': date.today()
        })
