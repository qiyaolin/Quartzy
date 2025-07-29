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
    
    # Additional computed fields
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()

    # Use PrimaryKeyRelatedField for write operations (POST, PUT) to accept IDs
    # Note: requested_by_id is set programmatically in the view, not by the client
    vendor_id = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(), source='vendor', write_only=True, allow_null=True, required=False
    )
    item_type_id = serializers.PrimaryKeyRelatedField(
        queryset=ItemType.objects.all(), source='item_type', write_only=True, allow_null=True, required=False
    )
    
    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() or obj.requested_by.username if obj.requested_by else None
    
    def get_approved_by_name(self, obj):
        # Get the user who approved this request from history
        approved_history = obj.history.filter(new_status='APPROVED').first()
        if approved_history and approved_history.user:
            return approved_history.user.get_full_name() or approved_history.user.username
        return None
    
    def get_received_by_name(self, obj):
        # Get the user who marked this request as received from history
        received_history = obj.history.filter(new_status='RECEIVED').first()
        if received_history and received_history.user:
            return received_history.user.get_full_name() or received_history.user.username
        return None

    class Meta:
        model = Request
        fields = [
            'id', 'item_name', 'item_type', 'status', 'catalog_number', 'url', 'quantity',
            'unit_size', 'unit_price', 'fund_id', 'barcode', 'notes', 'created_at', 'updated_at',
            'requested_by', 'vendor', 'vendor_id', 'item_type_id', 'requested_by_name', 
            'approved_by_name', 'received_by_name'
        ]
        read_only_fields = ('status', 'created_at', 'updated_at', 'requested_by_name', 
                          'approved_by_name', 'received_by_name')


class RequestHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RequestHistory
        fields = ['id', 'user', 'old_status', 'new_status', 'timestamp', 'notes']
