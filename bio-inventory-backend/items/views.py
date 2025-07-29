from rest_framework import viewsets, permissions, status
from rest_framework.filters import SearchFilter # Import SearchFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters import rest_framework as filters # Import django_filters
from django.db.models import Q, Count, Sum, F
from django.db import transaction
from datetime import date, timedelta
import pandas as pd
import io
from .models import Vendor, Location, ItemType, Item
from .serializers import VendorSerializer, LocationSerializer, ItemTypeSerializer, ItemSerializer
from .filters import ItemFilter # Import our filter class

class VendorViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows vendors to be viewed or edited.
    """
    queryset = Vendor.objects.all().order_by('name')
    serializer_class = VendorSerializer

class LocationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows locations to be viewed or edited.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

class ItemTypeViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows item types to be viewed or edited.
    """
    queryset = ItemType.objects.all().order_by('name')
    serializer_class = ItemTypeSerializer

class ItemViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows items to be viewed or edited.
    """
    queryset = Item.objects.filter(is_archived=False)
    serializer_class = ItemSerializer
    filterset_class = ItemFilter # Connect the filter class
    filter_backends = [SearchFilter, filters.DjangoFilterBackend] # Add SearchFilter
    search_fields = ['name', 'catalog_number', 'vendor__name', 'barcode'] # Define fields that the SearchFilter will search across
    
    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """Get items that need attention (expired, expiring soon, low stock)"""
        today = date.today()
        
        # Get expired items
        expired_items = self.queryset.filter(
            expiration_date__lt=today
        ).exclude(expiration_date__isnull=True)
        
        # Get expiring soon items
        expiring_soon_items = self.queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=F('expiration_alert_days') + today
        ).exclude(expiration_date__isnull=True)
        
        # Get low stock items
        low_stock_items = self.queryset.filter(
            quantity__lte=F('low_stock_threshold')
        ).exclude(low_stock_threshold__isnull=True)
        
        return Response({
            'expired': {
                'count': expired_items.count(),
                'items': ItemSerializer(expired_items[:10], many=True, context={'request': request}).data
            },
            'expiring_soon': {
                'count': expiring_soon_items.count(),
                'items': ItemSerializer(expiring_soon_items[:10], many=True, context={'request': request}).data
            },
            'low_stock': {
                'count': low_stock_items.count(),
                'items': ItemSerializer(low_stock_items[:10], many=True, context={'request': request}).data
            }
        })
    
    @action(detail=False, methods=['get'])
    def reports(self, request):
        """Generate laboratory reports and statistics"""
        today = date.today()
        
        # Basic inventory stats
        total_items = self.queryset.count()
        total_value = self.queryset.aggregate(total=Sum('price'))['total'] or 0
        
        # Expiration stats
        expired_count = self.queryset.filter(expiration_date__lt=today).exclude(expiration_date__isnull=True).count()
        expiring_30_days = self.queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=today + timedelta(days=30)
        ).exclude(expiration_date__isnull=True).count()
        
        # Stock stats
        low_stock_count = self.queryset.filter(
            quantity__lte=F('low_stock_threshold')
        ).exclude(low_stock_threshold__isnull=True).count()
        
        # Items by type
        items_by_type = self.queryset.values('item_type__name').annotate(
            count=Count('id'),
            total_value=Sum('price')
        ).order_by('-count')
        
        # Items by location
        items_by_location = self.queryset.filter(location__isnull=False).values('location__name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Items by vendor
        items_by_vendor = self.queryset.filter(vendor__isnull=False).values('vendor__name').annotate(
            count=Count('id'),
            total_value=Sum('price')
        ).order_by('-count')
        
        return Response({
            'summary': {
                'total_items': total_items,
                'total_value': float(total_value),
                'expired_items': expired_count,
                'expiring_in_30_days': expiring_30_days,
                'low_stock_items': low_stock_count
            },
            'breakdown': {
                'by_type': list(items_by_type),
                'by_location': list(items_by_location),
                'by_vendor': list(items_by_vendor)
            }
        })
    
    @action(detail=False, methods=['get'])
    def expiring_this_month(self, request):
        """Get items expiring this month"""
        today = date.today()
        end_of_month = today.replace(day=1) + timedelta(days=32)
        end_of_month = end_of_month.replace(day=1) - timedelta(days=1)
        
        expiring_items = self.queryset.filter(
            expiration_date__gte=today,
            expiration_date__lte=end_of_month
        ).exclude(expiration_date__isnull=True).order_by('expiration_date')
        
        serializer = ItemSerializer(expiring_items, many=True, context={'request': request})
        return Response({
            'count': expiring_items.count(),
            'items': serializer.data
        })

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        """
        Custom action to checkout an item by reducing quantity and archiving if empty.
        """
        item = self.get_object()
        
        if item.is_archived:
            return Response({'error': 'Item is already checked out.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if item.quantity <= 0:
            return Response({'error': 'Item quantity is already zero.'}, status=status.HTTP_400_BAD_REQUEST)

        barcode = request.data.get('barcode')
        notes = request.data.get('notes', f'Checked out via barcode scan: {barcode}')

        # Reduce quantity by 1
        item.quantity -= 1
        item.last_used_date = date.today()
        
        # If quantity reaches zero, mark as archived
        if item.quantity == 0:
            item.is_archived = True
        
        item.save()

        return Response({
            'status': 'Item checked out successfully',
            'item_id': item.id,
            'barcode': item.barcode,
            'quantity_remaining': float(item.quantity),
            'is_archived': item.is_archived,
            'checked_out_by': request.user.username,
            'checkout_date': date.today()
        })

    @action(detail=False, methods=['post'])
    def checkout_by_barcode(self, request):
        """
        Checkout an item by barcode by reducing quantity and archiving if empty.
        This searches for an active (non-archived) item with the given barcode.
        Uses database transaction to prevent race conditions.
        """
        barcode = request.data.get('barcode')
        notes = request.data.get('notes', f'Checked out via barcode scan: {barcode}')

        if not barcode:
            return Response({'error': 'Barcode is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Find and lock the item for update to prevent race conditions
                try:
                    item = Item.objects.select_for_update().get(barcode=barcode, is_archived=False)
                except Item.DoesNotExist:
                    return Response({'error': 'No available item found with this barcode.'}, status=status.HTTP_404_NOT_FOUND)
                except Item.MultipleObjectsReturned:
                    return Response({'error': 'Multiple items found with this barcode.'}, status=status.HTTP_400_BAD_REQUEST)

                # Check if quantity is already zero
                if item.quantity <= 0:
                    return Response({'error': 'Item quantity is already zero.'}, status=status.HTTP_400_BAD_REQUEST)

                # Reduce quantity by 1
                item.quantity -= 1
                item.last_used_date = date.today()
                
                # If quantity reaches zero, mark as archived
                if item.quantity == 0:
                    item.is_archived = True
                
                item.save()

                # Return the item details
                serializer = self.get_serializer(item)
                return Response({
                    'status': 'Item checked out successfully',
                    'item': serializer.data,
                    'quantity_remaining': float(item.quantity),
                    'is_archived': item.is_archived,
                    'checked_out_by': request.user.username,
                    'checkout_date': date.today()
                })
        except Exception as e:
            return Response({'error': f'Checkout failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def import_data(self, request):
        """
        Import inventory data from Excel/CSV file
        """
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        
        try:
            # Read file based on extension
            if file.name.endswith('.xlsx') or file.name.endswith('.xls'):
                df = pd.read_excel(io.BytesIO(file.read()))
            elif file.name.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file.read()))
            else:
                return Response({'error': 'Unsupported file format. Please use Excel (.xlsx/.xls) or CSV (.csv)'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Skip summary rows (assuming data starts after summary section)
            # Look for the row containing "Item Name" header
            header_row = None
            for idx, row in df.iterrows():
                if pd.notna(row.iloc[0]) and 'Item Name' in str(row.iloc[0]):
                    header_row = idx
                    break
                # Also check if first column contains "Item Name"
                for col in df.columns:
                    if pd.notna(row[col]) and 'Item Name' in str(row[col]):
                        header_row = idx
                        break
                if header_row is not None:
                    break
            
            if header_row is not None:
                # Use the found row as header
                df.columns = df.iloc[header_row]
                df = df.iloc[header_row + 1:].reset_index(drop=True)
            
            # Clean column names
            df.columns = df.columns.astype(str).str.strip()
            
            imported_count = 0
            errors = []
            
            with transaction.atomic():
                for idx, row in df.iterrows():
                    try:
                        # Skip empty rows
                        if pd.isna(row.get('Item Name')) or str(row.get('Item Name')).strip() == '':
                            continue
                        
                        # Parse vendor
                        vendor = None
                        vendor_name = str(row.get('Vendor', '')).strip()
                        if vendor_name and vendor_name != 'nan':
                            vendor, _ = Vendor.objects.get_or_create(name=vendor_name)
                        
                        # Parse location
                        location = None
                        location_name = str(row.get('Location', '')).strip()
                        if location_name and location_name != 'nan':
                            location, _ = Location.objects.get_or_create(name=location_name)
                        
                        # Parse item type
                        item_type = None
                        item_type_name = str(row.get('Item Type', '')).strip()
                        if item_type_name and item_type_name != 'nan':
                            item_type, _ = ItemType.objects.get_or_create(name=item_type_name)
                        
                        # Parse dates
                        expiration_date = None
                        purchase_date = None
                        
                        if pd.notna(row.get('Expiration Date')):
                            try:
                                expiration_date = pd.to_datetime(row['Expiration Date']).date()
                            except:
                                pass
                        
                        if pd.notna(row.get('Purchase Date')):
                            try:
                                purchase_date = pd.to_datetime(row['Purchase Date']).date()
                            except:
                                pass
                        
                        # Parse numeric fields
                        quantity = 0
                        try:
                            if pd.notna(row.get('Quantity')):
                                quantity = float(row['Quantity'])
                        except:
                            quantity = 0
                        
                        unit_price = None
                        try:
                            if pd.notna(row.get('Unit Price')):
                                price_str = str(row['Unit Price']).replace('$', '').strip()
                                if price_str and price_str != 'nan':
                                    unit_price = float(price_str)
                        except:
                            pass
                        
                        minimum_quantity = None
                        try:
                            if pd.notna(row.get('Minimum Stock')):
                                minimum_quantity = float(row['Minimum Stock'])
                        except:
                            pass
                        
                        # Create item
                        item_data = {
                            'name': str(row.get('Item Name', '')).strip(),
                            'quantity': quantity,
                            'unit': str(row.get('Unit', '')).strip() or None,
                            'price': unit_price,
                            'vendor': vendor,
                            'catalog_number': str(row.get('Catalog Number', '')).strip() or None,
                            'location': location,
                            'item_type': item_type,
                            'expiration_date': expiration_date,
                            'low_stock_threshold': minimum_quantity,
                            'received_date': purchase_date,
                            'barcode': str(row.get('Barcode', '')).strip() or None,
                            'owner': request.user
                        }
                        
                        # Remove None values
                        item_data = {k: v for k, v in item_data.items() if v is not None}
                        
                        Item.objects.create(**item_data)
                        imported_count += 1
                        
                    except Exception as e:
                        errors.append(f'Row {idx + 1}: {str(e)}')
                        continue
            
            response_data = {
                'imported_count': imported_count,
                'total_rows': len(df),
                'success': True
            }
            
            if errors:
                response_data['errors'] = errors[:10]  # Limit to first 10 errors
                response_data['total_errors'] = len(errors)
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': f'Failed to process file: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
