from rest_framework import serializers
from .models import Request, RequestHistory
from items.models import Vendor, ItemType
from django.contrib.auth.models import User
from items.serializers import VendorSerializer, UserSerializer, ItemTypeSerializer

class RequestSerializer(serializers.ModelSerializer):
    # Use nested serializers for read operations (GET) to show full details
    requested_by = UserSerializer(read_only=True)
    vendor = VendorSerializer(read_only=True)
    item_type = ItemTypeSerializer(read_only=True)

    # Use PrimaryKeyRelatedField for write operations (POST, PUT) to accept IDs
    # Note: requested_by_id is set programmatically in the view, not by the client
    vendor_id = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(), source='vendor', write_only=True, allow_null=True, required=False
    )
    item_type_id = serializers.PrimaryKeyRelatedField(
        queryset=ItemType.objects.all(), source='item_type', write_only=True, allow_null=True, required=False
    )

    class Meta:
        model = Request
        fields = [
            'id', 'item_name', 'item_type', 'financial_type', 'status', 'catalog_number', 'url', 'quantity', 
            'unit_size', 'unit_price', 'fund_id', 'notes', 'created_at', 'updated_at',
            'requested_by', 'vendor', 'vendor_id', 'item_type_id'
        ]
        read_only_fields = ('status', 'created_at', 'updated_at')


class RequestHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RequestHistory
        fields = ['id', 'user', 'old_status', 'new_status', 'timestamp', 'notes']
