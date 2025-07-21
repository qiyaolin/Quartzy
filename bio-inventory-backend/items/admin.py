from django.contrib import admin
from .models import Vendor, Location, ItemType, Item

@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('name', 'website', 'created_at')
    search_fields = ('name',)

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'parent', 'description')
    search_fields = ('name',)
    list_filter = ('parent',)

@admin.register(ItemType)
class ItemTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'custom_fields_schema')
    search_fields = ('name',)

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'serial_number', 'item_type', 'vendor', 'quantity', 'unit', 'location', 'owner', 'updated_at')
    list_filter = ('item_type', 'vendor', 'location', 'owner', 'is_archived')
    search_fields = ('name', 'serial_number', 'catalog_number', 'properties__icontains')

    # Use raw_id_fields for better performance with large numbers of foreign keys
    raw_id_fields = ('item_type', 'vendor', 'location', 'owner')

    # Customize the field layout in the add/edit form
    fieldsets = (
        ('Core Information', {
            'fields': ('name', 'item_type', 'owner', 'is_archived')
        }),
        ('Supplier & Catalog', {
            'fields': ('vendor', 'catalog_number', 'price', 'url')
        }),
        ('Stock & Location', {
            'fields': ('quantity', 'unit', 'location', 'low_stock_threshold')
        }),
        ('Custom Properties (JSON)', {
            'fields': ('properties',),
            'classes': ('collapse',) # Make this section collapsible
        }),
    )
    readonly_fields = ('serial_number', 'created_at', 'updated_at')
