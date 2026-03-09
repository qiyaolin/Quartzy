from decimal import Decimal
from datetime import date, timedelta

from django.db.models import Count, F, Prefetch, Q, Sum
from django_filters import rest_framework as filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from .filters import ItemFilter
from .models import Item, ItemLocationAllocation, ItemType, Location, Vendor
from .serializers import ItemSerializer, ItemTypeSerializer, LocationSerializer, VendorSerializer

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
    queryset = Location.objects.select_related('parent').all()
    serializer_class = LocationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get('leaf_only', '').lower() == 'true':
            queryset = queryset.filter(is_leaf=True)
        if self.request.query_params.get('active_only', '').lower() != 'false':
            queryset = queryset.filter(is_active=True)
        if parent_id := self.request.query_params.get('parent'):
            queryset = queryset.filter(parent_id=parent_id)
        return queryset.order_by('parent_id', 'sort_order', 'name', 'id')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        if request.query_params.get('tree', '').lower() == 'true':
            return Response(self._build_tree(serializer.data))
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def descendants(self, request, pk=None):
        location = self.get_object()
        descendant_ids = location.get_descendant_ids()
        queryset = self.get_queryset().filter(id__in=descendant_ids)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def _build_tree(self, serialized_locations):
        node_map = {}
        roots = []
        for location in serialized_locations:
            node = {**location, 'children': []}
            node_map[location['id']] = node

        for location in node_map.values():
            parent_id = location['parent']
            if parent_id and parent_id in node_map:
                node_map[parent_id]['children'].append(location)
            else:
                roots.append(location)
        return roots

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
    queryset = Item.objects.filter(is_archived=False).select_related(
        'item_type',
        'vendor',
        'owner',
        'location',
        'location__parent',
    ).prefetch_related(
        Prefetch(
            'location_allocations',
            queryset=ItemLocationAllocation.objects.select_related('location', 'location__parent').order_by('sort_order', 'id'),
        )
    )
    serializer_class = ItemSerializer
    filterset_class = ItemFilter
    filter_backends = [SearchFilter, filters.DjangoFilterBackend]
    search_fields = ['name', 'catalog_number', 'vendor__name', 'barcode', 'lot_number', 'serial_number', 'location__name', 'location__parent__name']

    def _consume_item(self, item, request, barcode=None):
        if item.is_archived:
            return Response({'error': 'Item has already been consumed.'}, status=status.HTTP_400_BAD_REQUEST)

        item.is_archived = True
        item.last_used_date = date.today()
        item.save(update_fields=['is_archived', 'last_used_date', 'updated_at'])

        serializer = self.get_serializer(item)
        return Response({
            'status': 'Item consumed successfully',
            'item': serializer.data,
            'consumed_by': request.user.username,
            'consume_date': date.today(),
            'barcode': barcode or item.barcode,
        })
    
    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """Get items that need attention (expired, expiring soon, low stock)"""
        today = date.today()
        
        # Get expired items
        queryset = self.filter_queryset(self.get_queryset())

        expired_items = queryset.filter(
            expiration_date__lt=today
        ).exclude(expiration_date__isnull=True)
        
        # Get expiring soon items
        expiring_soon_items = queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=F('expiration_alert_days') + today
        ).exclude(expiration_date__isnull=True)
        
        # Get low stock items
        low_stock_items = queryset.filter(
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
        queryset = self.filter_queryset(self.get_queryset())
        total_items = queryset.count()
        total_value = queryset.aggregate(total=Sum('price'))['total'] or 0
        
        # Expiration stats
        expired_count = queryset.filter(expiration_date__lt=today).exclude(expiration_date__isnull=True).count()
        expiring_30_days = queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=today + timedelta(days=30)
        ).exclude(expiration_date__isnull=True).count()
        
        # Stock stats
        low_stock_count = queryset.filter(
            quantity__lte=F('low_stock_threshold')
        ).exclude(low_stock_threshold__isnull=True).count()
        
        # Items by type
        items_by_type = queryset.values('item_type__name').annotate(
            count=Count('id'),
            total_value=Sum('price')
        ).order_by('-count')
        
        # Items by location
        items_by_location = ItemLocationAllocation.objects.filter(
            item__in=queryset,
            item__is_archived=False,
        ).values(
            'location__name',
            'location__parent__name',
        ).annotate(
            count=Count('item_id', distinct=True),
            total_quantity=Sum('quantity'),
        ).order_by('-count', 'location__parent__name', 'location__name')
        
        # Items by vendor
        items_by_vendor = queryset.filter(vendor__isnull=False).values('vendor__name').annotate(
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
        
        queryset = self.filter_queryset(self.get_queryset())
        expiring_items = queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=end_of_month
        ).exclude(expiration_date__isnull=True).order_by('expiration_date')
        
        serializer = ItemSerializer(expiring_items, many=True, context={'request': request})
        return Response({
            'count': expiring_items.count(),
            'items': serializer.data
        })

    @action(detail=False, methods=['post'])
    def merge_group(self, request):
        item_ids = request.data.get('item_ids', [])
        if not isinstance(item_ids, list) or not item_ids:
            return Response({'item_ids': 'A non-empty item_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)

        items = list(
            Item.objects.filter(id__in=item_ids, is_archived=False).order_by('id')
        )
        if not items:
            return Response({'item_ids': 'No matching active items found.'}, status=status.HTTP_404_NOT_FOUND)

        primary_item = items[0]
        payload = request.data.copy()
        payload.pop('item_ids', None)
        payload.pop('group_item_ids', None)
        payload.pop('is_group_edit', None)

        serializer = self.get_serializer(primary_item, data=payload)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        for item in items[1:]:
            item.delete()

        return Response(self.get_serializer(primary_item).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        """
        Backward-compatible alias for consume.
        """
        return self.consume(request, pk=pk)

    @action(detail=True, methods=['post'])
    def consume(self, request, pk=None):
        """
        Consume a single inventory instance by archiving it from the active list.
        """
        item = self.get_object()
        if item.resolved_tracking_mode == ItemType.TrackingMode.PACK_MANAGED:
            return Response({'error': 'Pack-managed items should use pack actions instead of full instance consume.'}, status=status.HTTP_400_BAD_REQUEST)
        return self._consume_item(item, request)

    @action(detail=False, methods=['post'])
    def checkout_by_barcode(self, request):
        """
        Backward-compatible alias for consume_by_barcode.
        """
        return self.consume_by_barcode(request)

    @action(detail=False, methods=['post'])
    def consume_by_barcode(self, request):
        """
        Consume an item by scanning a lab-generated barcode for a labeled instance.
        """
        barcode = request.data.get('barcode')

        if not barcode:
            return Response({'error': 'Barcode is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find the item with this barcode that is not archived
        try:
            item = Item.objects.get(barcode=barcode, is_archived=False)
        except Item.DoesNotExist:
            return Response({'error': 'No available item found with this barcode.'}, status=status.HTTP_404_NOT_FOUND)
        except Item.MultipleObjectsReturned:
            return Response({'error': 'Multiple items found with this barcode.'}, status=status.HTTP_400_BAD_REQUEST)

        if not item.can_scan_consume:
            return Response(
                {'error': 'This inventory item is not configured for labeled barcode consume.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return self._consume_item(item, request, barcode=barcode)

    @action(detail=True, methods=['post'])
    def mark_open(self, request, pk=None):
        item = self.get_object()
        if item.resolved_tracking_mode != ItemType.TrackingMode.PACK_MANAGED:
            return Response({'error': 'Only pack-managed items can be marked open.'}, status=status.HTTP_400_BAD_REQUEST)

        total_units = int(Decimal(str(item.quantity or 0)))
        if total_units <= 0:
            return Response({'error': 'No remaining packs are available to mark as open.'}, status=status.HTTP_400_BAD_REQUEST)

        next_open_count = min(item.open_unit_count + 1, total_units)
        if next_open_count == item.open_unit_count:
            return Response({'error': 'All tracked packs are already marked as open.'}, status=status.HTTP_400_BAD_REQUEST)

        properties = dict(item.properties or {})
        properties['open_unit_count'] = next_open_count
        item.properties = properties
        item.save(update_fields=['properties', 'updated_at'])

        return Response({
            'status': 'Pack marked as open.',
            'item': self.get_serializer(item).data,
        })

    @action(detail=True, methods=['post'])
    def subtract_pack(self, request, pk=None):
        item = self.get_object()
        if item.resolved_tracking_mode != ItemType.TrackingMode.PACK_MANAGED:
            return Response({'error': 'Only pack-managed items support subtracting packs.'}, status=status.HTTP_400_BAD_REQUEST)

        current_quantity = Decimal(str(item.quantity or 0))
        if current_quantity < Decimal('1'):
            return Response({'error': 'No packs remain to subtract.'}, status=status.HTTP_400_BAD_REQUEST)

        item.quantity = current_quantity - Decimal('1')
        item.last_used_date = date.today()
        properties = dict(item.properties or {})
        properties['open_unit_count'] = min(item.open_unit_count, max(int(item.quantity), 0))
        item.properties = properties
        item.save(update_fields=['quantity', 'last_used_date', 'properties', 'updated_at'])

        return Response({
            'status': 'Pack quantity reduced by one.',
            'item': self.get_serializer(item).data,
        })

    @action(detail=False, methods=['post'])
    def batch_archive(self, request):
        item_ids = request.data.get('item_ids', [])
        if not isinstance(item_ids, list) or not item_ids:
            return Response({'error': 'A non-empty item_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = Item.objects.filter(id__in=item_ids, is_archived=False).update(is_archived=True)
        return Response({'updated_count': updated_count})

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        item_ids = request.data.get('item_ids', [])
        if not isinstance(item_ids, list) or not item_ids:
            return Response({'error': 'A non-empty item_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = Item.objects.filter(id__in=item_ids)
        deleted_count = queryset.count()
        queryset.delete()
        return Response({'deleted_count': deleted_count})
