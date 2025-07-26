from django.contrib import admin
from .models import Request, RequestHistory

@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'status', 'requested_by', 'vendor', 'unit_price', 'quantity', 'updated_at')
    list_filter = ('status', 'vendor', 'requested_by')
    search_fields = ('item_name', 'catalog_number')

@admin.register(RequestHistory)
class RequestHistoryAdmin(admin.ModelAdmin):
    list_display = ('request', 'user', 'old_status', 'new_status', 'timestamp')