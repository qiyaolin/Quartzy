from django.db import models
from django.contrib.auth.models import User
import uuid

# A helper function to generate a unique serial number for items.
def generate_serial_number():
    # Example: ITM-550e8400
    return f"ITM-{uuid.uuid4().hex[:8]}"

class Vendor(models.Model):
    """Represents a supplier or manufacturer."""
    name = models.CharField(max_length=255, unique=True, help_text="Name of the vendor (e.g., Sigma-Aldrich, NEB)")
    website = models.URLField(blank=True, null=True, help_text="Vendor's website")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Location(models.Model):
    """Represents a physical location in the lab, supports hierarchy."""
    name = models.CharField(max_length=255, help_text="Name of the location (e.g., -80°C Freezer, Shelf A, Chemical Cabinet)")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', help_text="Parent location for creating a hierarchy (e.g., a specific shelf inside a freezer)")
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        path = [self.name]
        p = self.parent
        while p is not None:
            path.insert(0, p.name)
            p = p.parent
        return ' > '.join(path)

class ItemType(models.Model):
    """Represents the category of an item (e.g., Antibody, Plasmid, Chemical)."""
    name = models.CharField(max_length=100, unique=True)
    # This field will define the specific custom fields for this type.
    # For example: {'Clonality': 'text', 'Resistance Marker': 'text'}
    custom_fields_schema = models.JSONField(default=dict, blank=True, help_text="Schema for type-specific custom fields.")

    def __str__(self):
        return self.name

class Item(models.Model):
    """The core model representing a single inventory item."""
    # Core Information
    serial_number = models.CharField(max_length=20, unique=True, default=generate_serial_number, editable=False)
    name = models.CharField(max_length=255, help_text="The common name of the item.")
    item_type = models.ForeignKey(ItemType, on_delete=models.PROTECT, related_name="items")
    
    # Supplier Information
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name="items")
    catalog_number = models.CharField(max_length=100, blank=True)
    
    # Stock & Location
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.0)
    unit = models.CharField(max_length=50, help_text="e.g., 'units', 'boxes', 'kg', 'mL'")
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="items")
    
    # Financial & Ownership
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_items")
    
    # Metadata
    url = models.URLField(blank=True, help_text="Link to the product page.")
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True, help_text="Threshold to trigger a low stock warning.")
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Custom Fields - The flexible part!
    # This will store type-specific data as a JSON object.
    # e.g., for a Plasmid: {"Backbone": "pUC19", "Resistance": "Ampicillin"}
    properties = models.JSONField(default=dict, blank=True, help_text="Type-specific custom fields and values.")

    def __str__(self):
        return f"{self.name} ({self.serial_number})"

    class Meta:
        ordering = ['-created_at']
