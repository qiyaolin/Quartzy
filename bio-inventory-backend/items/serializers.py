from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from .models import Item, ItemLocationAllocation, ItemType, Location, Vendor


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ['id', 'name', 'website']


class LocationSerializer(serializers.ModelSerializer):
    full_path = serializers.ReadOnlyField()
    full_path_labels = serializers.ReadOnlyField()
    has_children = serializers.ReadOnlyField()

    class Meta:
        model = Location
        fields = [
            'id',
            'name',
            'parent',
            'description',
            'code',
            'location_type',
            'is_leaf',
            'is_active',
            'sort_order',
            'aliases',
            'notes',
            'full_path',
            'full_path_labels',
            'has_children',
        ]


class ItemTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemType
        fields = ['id', 'name', 'custom_fields_schema', 'tracking_mode', 'label_mode']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class NullableDateField(serializers.DateField):
    def to_internal_value(self, value):
        if value in ('', None):
            return None
        return super().to_internal_value(value)


class ItemLocationAllocationSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)
    location_id = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_active=True), source='location', write_only=True)
    full_path = serializers.SerializerMethodField()

    class Meta:
        model = ItemLocationAllocation
        fields = ['id', 'location', 'location_id', 'quantity', 'note', 'sort_order', 'full_path']
        read_only_fields = ['id', 'location', 'full_path']

    def get_full_path(self, obj):
        return obj.location.full_path

    def validate(self, attrs):
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if location and not location.is_leaf:
            raise serializers.ValidationError({'location_id': 'Location must be a leaf slot.'})
        return attrs


class ItemSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    vendor = VendorSerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    item_type = ItemTypeSerializer(read_only=True)
    expiration_date = NullableDateField(required=False, allow_null=True)
    received_date = NullableDateField(required=False, allow_null=True)
    last_used_date = NullableDateField(required=False, allow_null=True)
    location_allocations = ItemLocationAllocationSerializer(many=True, required=False)
    primary_location = serializers.SerializerMethodField()
    location_summary = serializers.SerializerMethodField()
    fund_name = serializers.SerializerMethodField()
    resolved_tracking_mode = serializers.ReadOnlyField()
    resolved_label_mode = serializers.ReadOnlyField()
    open_unit_count = serializers.ReadOnlyField()
    tracking_summary = serializers.ReadOnlyField()
    can_scan_consume = serializers.ReadOnlyField()
    request_state = serializers.SerializerMethodField()
    request_state_label = serializers.SerializerMethodField()
    request_state_count = serializers.SerializerMethodField()

    owner_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='owner', write_only=True)
    vendor_id = serializers.PrimaryKeyRelatedField(queryset=Vendor.objects.all(), source='vendor', write_only=True, allow_null=True, required=False)
    location_id = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_active=True), source='location', write_only=True, allow_null=True, required=False)
    item_type_id = serializers.PrimaryKeyRelatedField(queryset=ItemType.objects.all(), source='item_type', write_only=True)

    days_until_expiration = serializers.ReadOnlyField()
    expiration_status = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    needs_attention = serializers.ReadOnlyField()

    REQUEST_STATE_PRIORITY = ('ORDERED', 'APPROVED', 'NEW')

    @staticmethod
    def _build_request_lookup_key(name, catalog_number, vendor_id):
        return (
            (name or '').strip().lower(),
            (catalog_number or '').strip().lower(),
            str(vendor_id or ''),
        )

    def _get_request_state_cache(self):
        cache = self.context.get('_request_state_cache')
        if cache is not None:
            return cache

        lookup = {}
        try:
            from inventory_requests.models import Request

            active_requests = Request.objects.filter(
                status__in=self.REQUEST_STATE_PRIORITY
            ).select_related('vendor')
            for request in active_requests:
                key = self._build_request_lookup_key(
                    request.item_name,
                    request.catalog_number,
                    request.vendor_id,
                )
                entry = lookup.setdefault(key, {'states': set(), 'count': 0})
                entry['states'].add(request.status)
                entry['count'] += 1
        except Exception:
            lookup = {}

        self.context['_request_state_cache'] = lookup
        return lookup

    def get_fund_name(self, obj):
        if obj.fund_id:
            try:
                from funding.models import Fund

                fund = Fund.objects.get(id=obj.fund_id)
                return fund.name
            except Fund.DoesNotExist:
                return f"Fund #{obj.fund_id} (Not Found)"
        return None

    def get_primary_location(self, obj):
        allocation = obj.location_allocations.select_related('location').order_by('sort_order', 'id').first()
        if allocation:
            return LocationSerializer(allocation.location).data
        if obj.location:
            return LocationSerializer(obj.location).data
        return None

    def get_location_summary(self, obj):
        allocations = list(obj.location_allocations.select_related('location').order_by('sort_order', 'id'))
        if allocations:
            return [
                {
                    'location_id': allocation.location_id,
                    'location_name': allocation.location.name,
                    'full_path': allocation.location.full_path,
                    'quantity': allocation.quantity,
                    'note': allocation.note,
                }
                for allocation in allocations
            ]
        if obj.location:
            return [
                {
                    'location_id': obj.location_id,
                    'location_name': obj.location.name,
                    'full_path': obj.location.full_path,
                    'quantity': obj.quantity,
                    'note': '',
                }
            ]
        return []

    def get_request_state(self, obj):
        cache = self._get_request_state_cache()
        key = self._build_request_lookup_key(obj.name, obj.catalog_number, obj.vendor_id)
        entry = cache.get(key)
        if not entry:
            if obj.is_low_stock:
                return 'LOW_STOCK'
            return 'NONE'

        for status in self.REQUEST_STATE_PRIORITY:
            if status in entry['states']:
                return status
        return 'NONE'

    def get_request_state_label(self, obj):
        labels = {
            'NONE': 'No action',
            'LOW_STOCK': 'Low stock',
            'NEW': 'Request submitted',
            'APPROVED': 'Approved',
            'ORDERED': 'Ordered',
        }
        return labels.get(self.get_request_state(obj), 'No action')

    def get_request_state_count(self, obj):
        cache = self._get_request_state_cache()
        key = self._build_request_lookup_key(obj.name, obj.catalog_number, obj.vendor_id)
        entry = cache.get(key)
        return entry['count'] if entry else 0

    def validate(self, attrs):
        attrs = super().validate(attrs)
        raw_allocations = self.initial_data.get('location_allocations', serializers.empty)
        location = attrs.get('location', getattr(self.instance, 'location', None))
        quantity = attrs.get('quantity', getattr(self.instance, 'quantity', None))

        if raw_allocations is serializers.empty:
            if location is None:
                raise serializers.ValidationError({'location_allocations': 'At least one location allocation is required.'})
            if location and not location.is_leaf:
                raise serializers.ValidationError({'location_id': 'Location must be a leaf slot.'})
            return attrs

        if not isinstance(raw_allocations, list) or not raw_allocations:
            raise serializers.ValidationError({'location_allocations': 'At least one location allocation is required.'})

        seen_location_ids = set()
        total_quantity = Decimal('0')
        allocation_errors = []
        active_locations = {
            location_obj.id: location_obj
            for location_obj in Location.objects.filter(id__in=[allocation.get('location_id') for allocation in raw_allocations if allocation.get('location_id')])
        }

        for index, allocation in enumerate(raw_allocations):
            location_id = allocation.get('location_id')
            quantity_value = allocation.get('quantity')
            error_prefix = f'location_allocations[{index}]'

            if not location_id:
                allocation_errors.append({error_prefix: 'location_id is required.'})
                continue

            location_obj = active_locations.get(int(location_id))
            if location_obj is None or not location_obj.is_active:
                allocation_errors.append({error_prefix: 'Location is invalid or inactive.'})
                continue
            if not location_obj.is_leaf:
                allocation_errors.append({error_prefix: 'Location must be a leaf slot.'})
                continue
            if location_id in seen_location_ids:
                allocation_errors.append({error_prefix: 'Duplicate locations are not allowed.'})
                continue
            seen_location_ids.add(location_id)

            try:
                quantity_decimal = Decimal(str(quantity_value))
            except Exception:
                allocation_errors.append({error_prefix: 'Quantity must be numeric.'})
                continue

            if quantity_decimal <= 0:
                allocation_errors.append({error_prefix: 'Quantity must be greater than zero.'})
                continue

            total_quantity += quantity_decimal

        if allocation_errors:
            raise serializers.ValidationError({'location_allocations': allocation_errors})

        if quantity is None:
            raise serializers.ValidationError({'quantity': 'Quantity is required when allocations are provided.'})

        if total_quantity != Decimal(str(quantity)):
            raise serializers.ValidationError(
                {'location_allocations': f'Allocated quantity total ({total_quantity}) must equal item quantity ({quantity}).'}
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        allocations_data = self.initial_data.get('location_allocations', serializers.empty)
        validated_data.pop('location_allocations', None)
        item = Item.objects.create(**validated_data)
        self._sync_allocations(item, allocations_data)
        return item

    @transaction.atomic
    def update(self, instance, validated_data):
        allocations_data = self.initial_data.get('location_allocations', serializers.empty)
        validated_data.pop('location_allocations', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._sync_allocations(instance, allocations_data)
        return instance

    def _sync_allocations(self, item, allocations_data):
        if allocations_data is serializers.empty:
            if item.location_id is None:
                return

            item.location_allocations.all().delete()
            ItemLocationAllocation.objects.create(
                item=item,
                location=item.location,
                quantity=item.quantity,
                note='',
                sort_order=0,
            )
            return

        item.location_allocations.all().delete()
        locations_by_id = {
            location.id: location
            for location in Location.objects.filter(id__in=[allocation.get('location_id') for allocation in allocations_data if allocation.get('location_id')])
        }

        created_allocations = []
        for index, allocation in enumerate(allocations_data):
            location_id = int(allocation['location_id'])
            created_allocations.append(
                ItemLocationAllocation(
                    item=item,
                    location=locations_by_id[location_id],
                    quantity=allocation['quantity'],
                    note=allocation.get('note', ''),
                    sort_order=allocation.get('sort_order', index),
                )
            )
        ItemLocationAllocation.objects.bulk_create(created_allocations)

        primary_allocation = item.location_allocations.select_related('location').order_by('sort_order', 'id').first()
        item.location = primary_allocation.location if primary_allocation else None
        item.save(update_fields=['location', 'updated_at'])

    class Meta:
        model = Item
        fields = [
            'id',
            'serial_number',
            'name',
            'item_type',
            'item_type_id',
            'vendor',
            'vendor_id',
            'catalog_number',
            'quantity',
            'unit',
            'location',
            'location_id',
            'tracking_mode',
            'label_mode',
            'location_allocations',
            'primary_location',
            'location_summary',
            'price',
            'owner',
            'owner_id',
            'url',
            'low_stock_threshold',
            'is_archived',
            'created_at',
            'updated_at',
            'properties',
            'expiration_date',
            'lot_number',
            'received_date',
            'expiration_alert_days',
            'storage_temperature',
            'storage_conditions',
            'last_used_date',
            'days_until_expiration',
            'expiration_status',
            'is_low_stock',
            'needs_attention',
            'resolved_tracking_mode',
            'resolved_label_mode',
            'open_unit_count',
            'tracking_summary',
            'can_scan_consume',
            'request_state',
            'request_state_label',
            'request_state_count',
            'fund_id',
            'fund_name',
            'barcode',
        ]
        read_only_fields = [
            'serial_number',
            'created_at',
            'updated_at',
            'days_until_expiration',
            'expiration_status',
            'is_low_stock',
            'needs_attention',
            'fund_name',
            'primary_location',
            'location_summary',
            'resolved_tracking_mode',
            'resolved_label_mode',
            'open_unit_count',
            'tracking_summary',
            'can_scan_consume',
            'request_state',
            'request_state_label',
            'request_state_count',
        ]
