from django.db import models
from django.contrib.auth.models import User
from datetime import date
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
    TYPE_AREA = 'area'
    TYPE_STORAGE_GROUP = 'storage_group'
    TYPE_CONTAINER = 'container'
    TYPE_SLOT = 'slot'
    TYPE_CHOICES = (
        (TYPE_AREA, 'Area'),
        (TYPE_STORAGE_GROUP, 'Storage Group'),
        (TYPE_CONTAINER, 'Container'),
        (TYPE_SLOT, 'Slot'),
    )

    name = models.CharField(max_length=255, help_text="Name of the location (e.g., -80°C Freezer, Shelf A, Chemical Cabinet)")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', help_text="Parent location for creating a hierarchy (e.g., a specific shelf inside a freezer)")
    description = models.TextField(blank=True, null=True)
    code = models.CharField(max_length=50, blank=True, help_text="Optional stable code for imports and integrations.")
    location_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_SLOT)
    is_leaf = models.BooleanField(default=True, help_text="Whether this location is a final storable slot.")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    aliases = models.JSONField(default=list, blank=True, help_text="Alternative names used for this location.")
    notes = models.TextField(blank=True, help_text="Optional operational notes for this location.")

    def __str__(self):
        return self.full_path

    @property
    def full_path_labels(self):
        path = [self.name]
        p = self.parent
        while p is not None:
            path.insert(0, p.name)
            p = p.parent
        return path

    @property
    def full_path(self):
        return ' > '.join(self.full_path_labels)

    @property
    def has_children(self):
        return self.children.exists()

    def get_descendant_ids(self):
        descendant_ids = []
        for child in self.children.all():
            descendant_ids.append(child.id)
            descendant_ids.extend(child.get_descendant_ids())
        return descendant_ids

    class Meta:
        ordering = ['parent__id', 'sort_order', 'name', 'id']
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='items_location_unique_name_per_parent'),
        ]

class ItemType(models.Model):
    """Represents the category of an item (e.g., Antibody, Plasmid, Chemical)."""
    class TrackingMode(models.TextChoices):
        PACK_MANAGED = 'pack_managed', 'Pack-managed'
        INSTANCE_TRACKED = 'instance_tracked', 'Instance-tracked'

    class LabelMode(models.TextChoices):
        NONE = 'none', 'No physical barcode'
        ITEM_BARCODE = 'item_barcode', 'Barcode on item'

    name = models.CharField(max_length=100, unique=True)
    # This field will define the specific custom fields for this type.
    # For example: {'Clonality': 'text', 'Resistance Marker': 'text'}
    custom_fields_schema = models.JSONField(default=dict, blank=True, help_text="Schema for type-specific custom fields.")
    tracking_mode = models.CharField(
        max_length=32,
        choices=TrackingMode.choices,
        default=TrackingMode.INSTANCE_TRACKED,
        help_text="Controls whether this type is managed as pack counts or as discrete trackable instances.",
    )
    label_mode = models.CharField(
        max_length=32,
        choices=LabelMode.choices,
        default=LabelMode.ITEM_BARCODE,
        help_text="Defines whether physical barcode labels should be generated for this type.",
    )

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
    tracking_mode = models.CharField(
        max_length=32,
        choices=ItemType.TrackingMode.choices,
        blank=True,
        help_text="Optional per-item override for how this stock is tracked.",
    )
    label_mode = models.CharField(
        max_length=32,
        choices=ItemType.LabelMode.choices,
        blank=True,
        help_text="Optional per-item override for barcode label handling.",
    )
    
    # Financial & Ownership
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_items")
    fund_id = models.IntegerField(null=True, blank=True, help_text="ID of the fund used to purchase this item")
    
    # Expiration & Storage Management
    expiration_date = models.DateField(null=True, blank=True, help_text="Expiration date of the item")
    lot_number = models.CharField(max_length=100, blank=True, help_text="Batch/lot number for tracking")
    received_date = models.DateField(null=True, blank=True, help_text="Date when the item was received/opened")
    expiration_alert_days = models.PositiveIntegerField(default=30, help_text="Days before expiration to trigger alert")
    storage_temperature = models.CharField(max_length=50, blank=True, help_text="Required storage temperature (e.g., -80°C, 4°C, RT)")
    storage_conditions = models.TextField(blank=True, help_text="Additional storage requirements")
    last_used_date = models.DateField(null=True, blank=True, help_text="Last time this item was used")
    
    # Metadata
    url = models.URLField(blank=True, help_text="Link to the product page.")
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True, help_text="Threshold to trigger a low stock warning.")
    barcode = models.CharField(max_length=50, unique=True, null=True, blank=True, help_text="Unique barcode for this item")
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Custom Fields - The flexible part!
    # This will store type-specific data as a JSON object.
    # e.g., for a Plasmid: {"Backbone": "pUC19", "Resistance": "Ampicillin"}
    properties = models.JSONField(default=dict, blank=True, help_text="Type-specific custom fields and values.")

    @property
    def days_until_expiration(self):
        """Calculate days until expiration. Returns None if no expiration date."""
        if not self.expiration_date:
            return None
        return (self.expiration_date - date.today()).days
    
    @property
    def expiration_status(self):
        """Get expiration status: GOOD, EXPIRING_SOON, EXPIRED"""
        if not self.expiration_date:
            return 'NO_DATE'
        
        days_left = self.days_until_expiration
        if days_left < 0:
            return 'EXPIRED'
        elif days_left <= self.expiration_alert_days:
            return 'EXPIRING_SOON'
        else:
            return 'GOOD'
    
    @property
    def is_low_stock(self):
        """Check if item is below low stock threshold"""
        if not self.low_stock_threshold:
            return False
        return self.quantity <= self.low_stock_threshold

    @property
    def resolved_tracking_mode(self):
        if self.tracking_mode:
            return self.tracking_mode
        if self.item_type_id and self.item_type:
            return self.item_type.tracking_mode
        return ItemType.TrackingMode.INSTANCE_TRACKED

    @property
    def resolved_label_mode(self):
        if self.label_mode:
            return self.label_mode
        if self.barcode:
            return ItemType.LabelMode.ITEM_BARCODE
        if self.item_type_id and self.item_type:
            return self.item_type.label_mode
        return ItemType.LabelMode.ITEM_BARCODE

    @property
    def open_unit_count(self):
        raw_value = (self.properties or {}).get('open_unit_count', 0)
        try:
            count = int(raw_value)
        except (TypeError, ValueError):
            return 0
        return max(count, 0)

    @property
    def can_scan_consume(self):
        return self.resolved_label_mode == ItemType.LabelMode.ITEM_BARCODE and bool(self.barcode)

    @property
    def tracking_summary(self):
        if self.resolved_tracking_mode == ItemType.TrackingMode.PACK_MANAGED:
            if self.open_unit_count > 0:
                return f"Pack-managed ({self.open_unit_count} open)"
            return "Pack-managed"
        if self.can_scan_consume:
            return "Labeled instance"
        return "Instance tracked"

    @property
    def needs_attention(self):
        """Check if item needs attention (expired, expiring soon, or low stock)"""
        return self.expiration_status in ['EXPIRED', 'EXPIRING_SOON'] or self.is_low_stock

    def save(self, *args, **kwargs):
        if not self.tracking_mode and self.item_type_id and self.item_type:
            self.tracking_mode = self.item_type.tracking_mode
        if not self.label_mode:
            if self.barcode:
                self.label_mode = ItemType.LabelMode.ITEM_BARCODE
            elif self.item_type_id and self.item_type:
                self.label_mode = self.item_type.label_mode

        if self.resolved_label_mode == ItemType.LabelMode.ITEM_BARCODE and not self.barcode:
            self.barcode = f"ITM-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.serial_number})"

    class Meta:
        ordering = ['-created_at']


class ItemLocationAllocation(models.Model):
    """Tracks how a single item quantity is distributed across storage slots."""
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='location_allocations')
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name='item_allocations')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.item.name} @ {self.location.full_path} ({self.quantity})"

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['item', 'location'], name='items_itemallocation_unique_item_location'),
            models.CheckConstraint(check=models.Q(quantity__gt=0), name='items_itemallocation_quantity_positive'),
        ]
