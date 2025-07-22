from rest_framework import serializers
from .models import Vendor, Location, ItemType, Item
from django.contrib.auth.models import User

class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ['id', 'name', 'website']

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'name', 'parent', 'description']

class ItemTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemType
        fields = ['id', 'name', 'custom_fields_schema']

# We'll show the username for the owner for better readability
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']

class ItemSerializer(serializers.ModelSerializer):
    # To make the API more readable, we can show string representations
    # or nested serializers for foreign keys.
    owner = UserSerializer(read_only=True)
    vendor = VendorSerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    item_type = ItemTypeSerializer(read_only=True)
    
    # Fund information
    fund_name = serializers.SerializerMethodField()

    # We also need fields that can accept a simple ID for writing (creating/updating)
    owner_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='owner', write_only=True)
    vendor_id = serializers.PrimaryKeyRelatedField(queryset=Vendor.objects.all(), source='vendor', write_only=True, allow_null=True)
    location_id = serializers.PrimaryKeyRelatedField(queryset=Location.objects.all(), source='location', write_only=True, allow_null=True)
    item_type_id = serializers.PrimaryKeyRelatedField(queryset=ItemType.objects.all(), source='item_type', write_only=True)
    
    # Computed fields for expiration and stock status
    days_until_expiration = serializers.ReadOnlyField()
    expiration_status = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    needs_attention = serializers.ReadOnlyField()
    
    def get_fund_name(self, obj):
        if obj.fund_id:
            try:
                from funding.models import Fund
                fund = Fund.objects.get(id=obj.fund_id)
                return fund.name
            except Fund.DoesNotExist:
                return f"Fund #{obj.fund_id} (Not Found)"
        return None

    class Meta:
        model = Item
        fields = [
            'id', 'serial_number', 'name', 'item_type', 'item_type_id',
            'vendor', 'vendor_id', 'catalog_number', 'quantity', 'unit',
            'location', 'location_id', 'price', 'owner', 'owner_id', 'url',
            'low_stock_threshold', 'is_archived', 'created_at', 'updated_at',
            'properties', 'expiration_date', 'lot_number', 'received_date',
            'expiration_alert_days', 'storage_temperature', 'storage_conditions',
            'last_used_date', 'days_until_expiration', 'expiration_status',
            'is_low_stock', 'needs_attention', 'fund_id', 'fund_name'
        ]
        read_only_fields = ['serial_number', 'created_at', 'updated_at', 'days_until_expiration', 'expiration_status', 'is_low_stock', 'needs_attention', 'fund_name'] 