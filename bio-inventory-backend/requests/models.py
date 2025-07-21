from django.db import models
from django.contrib.auth.models import User
from items.models import Vendor # We can link to models from other apps

class Request(models.Model):
    # Enum for request status
    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        APPROVED = 'APPROVED', 'Approved'
        ORDERED = 'ORDERED', 'Ordered'
        RECEIVED = 'RECEIVED', 'Received'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'

    # Core Details
    item_name = models.CharField(max_length=255)
    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="requests")
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.NEW,
    )

    # Supplier Details
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True)
    catalog_number = models.CharField(max_length=100, blank=True)
    url = models.URLField(blank=True)

    # Quantity and Price
    quantity = models.PositiveIntegerField(default=1)
    unit_size = models.CharField(max_length=100, blank=True, help_text="e.g., 100 uL, 500 g")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    # Notes and Timestamps
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Request for {self.item_name} by {self.requested_by.username} ({self.status})"

    class Meta:
        ordering = ['-created_at']

class RequestHistory(models.Model):
    """Stores the history of status changes for a Request."""
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="history")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, help_text="User who made the change")
    old_status = models.CharField(max_length=10, choices=Request.Status.choices)
    new_status = models.CharField(max_length=10, choices=Request.Status.choices)
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True, help_text="Optional notes about the status change")

    def __str__(self):
        return f"{self.request.item_name}: {self.old_status} -> {self.new_status}"

    class Meta:
        ordering = ['-timestamp']