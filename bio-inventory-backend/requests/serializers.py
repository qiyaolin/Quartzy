from rest_framework import serializers
from .models import Request, RequestHistory
from items.models import Vendor
from django.contrib.auth.models import User
from items.serializers import VendorSerializer, UserSerializer

class RequestSerializer(serializers.ModelSerializer):
    # Use nested serializers for read operations (GET) to show full details
    requested_by = UserSerializer(read_only=True)
    vendor = VendorSerializer(read_only=True)

    # Use PrimaryKeyRelatedField for write operations (POST, PUT) to accept IDs
    requested_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='requested_by', write_only=True
    )
    vendor_id = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(), source='vendor', write_only=True, allow_null=True, required=False
    )

    class Meta:
        model = Request
        fields = [
            'id', 'item_name', 'status', 'catalog_number', 'url', 'quantity', 
            'unit_size', 'unit_price', 'fund_id', 'notes', 'created_at', 'updated_at',
            'requested_by', 'vendor', 'requested_by_id', 'vendor_id'
        ]
        read_only_fields = ('status', 'created_at', 'updated_at')


class RequestHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RequestHistory
        fields = ['id', 'user', 'old_status', 'new_status', 'timestamp', 'notes']
