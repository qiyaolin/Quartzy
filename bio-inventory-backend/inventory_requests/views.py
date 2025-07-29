from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter # Import SearchFilter
from django_filters import rest_framework as filters # Import django_filters
from rest_framework.permissions import IsAdminUser # Import this
from django.db import transaction
import pandas as pd
import io
from .models import Request, RequestHistory
from .serializers import RequestSerializer, RequestHistorySerializer
from .filters import RequestFilter # Import our filter class
from items.models import Item, Location, Vendor
from notifications.email_service import EmailNotificationService
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)

class RequestViewSet(viewsets.ModelViewSet):
    queryset = Request.objects.all()
    serializer_class = RequestSerializer
    filterset_class = RequestFilter # Connect the filter class
    filter_backends = [SearchFilter, filters.DjangoFilterBackend] # Add SearchFilter
    search_fields = ['item_name', 'catalog_number', 'vendor__name', 'barcode'] # Define fields that the SearchFilter will search across
    
    def create(self, request, *args, **kwargs):
        """Override create to set requested_by to current user and send email notification"""
        # Get serializer and validate data
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Set the requested_by field to the current user before saving
        serializer.save(requested_by=request.user)
        
        # Send email notification to admins for new requests
        try:
            EmailNotificationService.send_new_request_notification(serializer.instance)
            logger.info(f"Email notification sent for new request: {serializer.instance.id}")
        except Exception as e:
            logger.error(f"Failed to send email notification for new request: {e}")
            # Don't fail the request creation if email fails
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser]) # Add this decorator
    def approve(self, request, pk=None):
        from .funding_integration import validate_fund_budget
        
        req_object = self.get_object()
        if req_object.status != 'NEW':
            return Response({'error': 'Request cannot be approved.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get fund_id from request data
        fund_id = request.data.get('fund_id')
        if fund_id:
            # Validate budget if fund is specified
            validation = validate_fund_budget(req_object, fund_id)
            if not validation['valid']:
                return Response({
                    'error': 'Insufficient budget in selected fund',
                    'details': validation
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Set the fund_id on the request
            req_object.fund_id = fund_id
        
        # Create history record
        RequestHistory.objects.create(
            request=req_object,
            user=request.user,
            old_status=req_object.status,
            new_status='APPROVED',
            notes=request.data.get('notes', '')
        )
        
        req_object.status = 'APPROVED'
        req_object.save()
        
        return Response({
            'status': 'Request approved',
            'fund_id': req_object.fund_id,
            'budget_validation': validation if fund_id else None
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def place_order(self, request, pk=None):
        """Custom action to mark an approved request as ordered."""
        req_object = self.get_object()
        if req_object.status != 'APPROVED':
            return Response({'error': 'Only approved requests can be ordered.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get fund_id from request data if not already set
        fund_id = request.data.get('fund_id') or req_object.fund_id
        if fund_id and not req_object.fund_id:
            from .funding_integration import validate_fund_budget
            validation = validate_fund_budget(req_object, fund_id)
            if not validation['valid']:
                return Response({
                    'error': 'Insufficient budget in selected fund',
                    'details': validation
                }, status=status.HTTP_400_BAD_REQUEST)
            req_object.fund_id = fund_id
        
        # Create history record
        RequestHistory.objects.create(
            request=req_object,
            user=request.user,
            old_status=req_object.status,
            new_status='ORDERED',
            notes=request.data.get('notes', '')
        )
        
        req_object.status = 'ORDERED'
        req_object.save()
        
        # Send email notification to requester
        try:
            EmailNotificationService.send_order_placed_notification(req_object, request.user)
            logger.info(f"Email notification sent for order placed: {req_object.id}")
        except Exception as e:
            logger.error(f"Failed to send email notification for order placed: {e}")
        
        return Response({
            'status': 'Request marked as ordered',
            'fund_id': req_object.fund_id
        })

    @action(detail=True, methods=['post'])
    def mark_received(self, request, pk=None):
        """
        Custom action to mark a request as received.
        This action ALWAYS creates a new Item record.
        """
        req_object = self.get_object()
        if req_object.status != 'ORDERED':
            return Response({'error': 'Only ordered items can be marked as received.'}, status=status.HTTP_400_BAD_REQUEST)

        location_id = request.data.get('location_id')
        quantity_received = int(request.data.get('quantity_received', 0))

        if not location_id or quantity_received <= 0:
            return Response({'error': 'Location and valid quantity are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # **MODIFIED LOGIC**: Always create a new inventory item for each reception.
        Item.objects.create(
            name=req_object.item_name,
            vendor=req_object.vendor,
            catalog_number=req_object.catalog_number,
            item_type_id=1, # Default to a generic type, can be improved
            owner=req_object.requested_by,
            quantity=quantity_received,
            unit=req_object.unit_size,
            location_id=location_id,
            price=req_object.unit_price,
            fund_id=req_object.fund_id,  # Include fund_id from the request
            barcode=req_object.barcode,  # Include barcode from the request
        )

        # Handle partial delivery
        if quantity_received < req_object.quantity:
            remaining_qty = req_object.quantity - quantity_received
            Request.objects.create(
                item_name=f"{req_object.item_name} (Back-ordered)",
                requested_by=req_object.requested_by,
                vendor=req_object.vendor,
                catalog_number=req_object.catalog_number,
                quantity=remaining_qty,
                unit_price=req_object.unit_price,
                status='ORDERED', # It's still on order
                fund_id=req_object.fund_id  # Keep the same fund for back-orders
            )

        # Create history record
        RequestHistory.objects.create(
            request=req_object,
            user=request.user,
            old_status=req_object.status,
            new_status='RECEIVED',
            notes=f"Marked as received - Quantity: {quantity_received}"
        )
        
        req_object.status = 'RECEIVED'
        req_object.save()
        
        # Send email notification to requester
        try:
            location = Location.objects.get(id=location_id) if location_id else None
            EmailNotificationService.send_item_received_notification(
                req_object, 
                request.user, 
                quantity_received,
                location.name if location else None
            )
            logger.info(f"Email notification sent for item received: {req_object.id}")
        except Exception as e:
            logger.error(f"Failed to send email notification for item received: {e}")

        return Response({'status': 'Item received and new inventory record created.'})

    @action(detail=True, methods=['post'])
    def reorder(self, request, pk=None):
        original_request = self.get_object()
        new_request = Request.objects.create(
            item_name=original_request.item_name,
            requested_by=request.user,
            vendor=original_request.vendor,
            catalog_number=original_request.catalog_number,
            url=original_request.url,
            quantity=original_request.quantity,
            unit_size=original_request.unit_size,
            unit_price=original_request.unit_price,
            status='NEW'
        )
        
        # Send email notification to admins for new reorder request
        try:
            EmailNotificationService.send_new_request_notification(new_request)
            logger.info(f"Email notification sent for reorder request: {new_request.id}")
        except Exception as e:
            logger.error(f"Failed to send email notification for reorder request: {e}")
        
        serializer = self.get_serializer(new_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        req_object = self.get_object()
        history_qs = RequestHistory.objects.filter(request=req_object)
        serializer = RequestHistorySerializer(history_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def batch_place_order(self, request):
        """Batch place order for multiple approved requests."""
        request_ids = request.data.get('request_ids', [])
        fund_id = request.data.get('fund_id')
        
        if not request_ids:
            return Response({'error': 'No request IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        requests_to_update = Request.objects.filter(id__in=request_ids, status='APPROVED')
        updated_count = 0
        errors = []
        
        for req_object in requests_to_update:
            try:
                # Validate budget if fund is specified
                if fund_id and not req_object.fund_id:
                    from .funding_integration import validate_fund_budget
                    validation = validate_fund_budget(req_object, fund_id)
                    if not validation['valid']:
                        errors.append(f"Request {req_object.id}: Insufficient budget in selected fund")
                        continue
                    req_object.fund_id = fund_id
                
                # Create history record
                RequestHistory.objects.create(
                    request=req_object,
                    user=request.user,
                    old_status=req_object.status,
                    new_status='ORDERED',
                    notes=f"Batch place order operation"
                )
                
                req_object.status = 'ORDERED'
                req_object.save()
                updated_count += 1
                
            except Exception as e:
                errors.append(f"Request {req_object.id}: {str(e)}")
        
        response_data = {
            'updated_count': updated_count,
            'total_requested': len(request_ids),
            'fund_id': fund_id
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def batch_approve(self, request):
        """Batch approve multiple pending requests."""
        request_ids = request.data.get('request_ids', [])
        
        if not request_ids:
            return Response({'error': 'No request IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        requests_to_update = Request.objects.filter(id__in=request_ids, status='NEW')
        updated_count = 0
        errors = []
        
        for req_object in requests_to_update:
            try:
                # Create history record
                RequestHistory.objects.create(
                    request=req_object,
                    user=request.user,
                    old_status=req_object.status,
                    new_status='APPROVED',
                    notes=f"Batch approve operation"
                )
                
                req_object.status = 'APPROVED'
                req_object.save()
                updated_count += 1
                
            except Exception as e:
                errors.append(f"Request {req_object.id}: {str(e)}")
        
        response_data = {
            'updated_count': updated_count,
            'total_requested': len(request_ids)
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def batch_reject(self, request):
        """Batch reject multiple pending requests."""
        request_ids = request.data.get('request_ids', [])
        
        if not request_ids:
            return Response({'error': 'No request IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        requests_to_update = Request.objects.filter(id__in=request_ids, status='NEW')
        updated_count = 0
        errors = []
        
        for req_object in requests_to_update:
            try:
                # Create history record
                RequestHistory.objects.create(
                    request=req_object,
                    user=request.user,
                    old_status=req_object.status,
                    new_status='REJECTED',
                    notes=f"Batch reject operation"
                )
                
                req_object.status = 'REJECTED'
                req_object.save()
                updated_count += 1
                
            except Exception as e:
                errors.append(f"Request {req_object.id}: {str(e)}")
        
        response_data = {
            'updated_count': updated_count,
            'total_requested': len(request_ids)
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data)

    @action(detail=False, methods=['post'])
    def batch_mark_received(self, request):
        """Batch mark received for multiple ordered requests."""
        request_ids = request.data.get('request_ids', [])
        location_id = request.data.get('location_id')
        
        if not request_ids or not location_id:
            return Response({'error': 'Request IDs and location are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        requests_to_update = Request.objects.filter(id__in=request_ids, status='ORDERED')
        updated_count = 0
        errors = []
        
        for req_object in requests_to_update:
            try:
                # Create inventory item
                Item.objects.create(
                    name=req_object.item_name,
                    vendor=req_object.vendor,
                    catalog_number=req_object.catalog_number,
                    item_type_id=1,
                    owner=req_object.requested_by,
                    quantity=req_object.quantity,
                    unit=req_object.unit_size,
                    location_id=location_id,
                    price=req_object.unit_price,
                    fund_id=req_object.fund_id,
                    barcode=req_object.barcode  # Include barcode from the request
                )
                
                # Create history record
                RequestHistory.objects.create(
                    request=req_object,
                    user=request.user,
                    old_status=req_object.status,
                    new_status='RECEIVED',
                    notes=f"Batch mark received operation"
                )
                
                req_object.status = 'RECEIVED'
                req_object.save()
                updated_count += 1
                
            except Exception as e:
                errors.append(f"Request {req_object.id}: {str(e)}")
        
        response_data = {
            'updated_count': updated_count,
            'total_requested': len(request_ids)
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data)

    @action(detail=False, methods=['post'])
    def batch_reorder(self, request):
        """Batch reorder for multiple received requests."""
        request_ids = request.data.get('request_ids', [])
        
        if not request_ids:
            return Response({'error': 'No request IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        original_requests = Request.objects.filter(id__in=request_ids, status='RECEIVED')
        created_count = 0
        errors = []
        new_request_ids = []
        
        for original_request in original_requests:
            try:
                new_request = Request.objects.create(
                    item_name=original_request.item_name,
                    requested_by=request.user,
                    vendor=original_request.vendor,
                    catalog_number=original_request.catalog_number,
                    url=original_request.url,
                    quantity=original_request.quantity,
                    unit_size=original_request.unit_size,
                    unit_price=original_request.unit_price,
                    status='NEW'
                )
                new_request_ids.append(new_request.id)
                created_count += 1
                
            except Exception as e:
                errors.append(f"Request {original_request.id}: {str(e)}")
        
        response_data = {
            'created_count': created_count,
            'total_requested': len(request_ids),
            'new_request_ids': new_request_ids
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data)

    @action(detail=False, methods=['post'])
    def import_data(self, request):
        """
        Import requests data from Excel/CSV file
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
                        
                        # Parse requested_by user
                        requested_by = request.user  # Default to current user
                        requested_by_name = str(row.get('Requested By', '')).strip()
                        if requested_by_name and requested_by_name != 'nan':
                            try:
                                requested_by = User.objects.get(username=requested_by_name)
                            except User.DoesNotExist:
                                # If user doesn't exist, keep default
                                pass
                        
                        # Parse numeric fields
                        quantity = 1
                        try:
                            if pd.notna(row.get('Quantity')):
                                quantity = float(row['Quantity'])
                        except:
                            quantity = 1
                        
                        unit_price = None
                        try:
                            if pd.notna(row.get('Unit Price')):
                                price_str = str(row['Unit Price']).replace('$', '').strip()
                                if price_str and price_str != 'nan':
                                    unit_price = float(price_str)
                        except:
                            pass
                        
                        # Parse status
                        status_value = str(row.get('Status', 'NEW')).strip().upper()
                        if status_value not in ['NEW', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED']:
                            status_value = 'NEW'
                        
                        # Create request
                        request_data = {
                            'item_name': str(row.get('Item Name', '')).strip(),
                            'catalog_number': str(row.get('Catalog Number', '')).strip() or None,
                            'quantity': quantity,
                            'unit_size': str(row.get('Unit Size', '')).strip() or None,
                            'unit_price': unit_price,
                            'vendor': vendor,
                            'requested_by': requested_by,
                            'status': status_value,
                            'url': str(row.get('URL', '')).strip() or None,
                            'barcode': str(row.get('Barcode', '')).strip() or None,
                            'fund_id': str(row.get('Fund', '')).strip() or None,
                            'notes': str(row.get('Notes', '')).strip() or None,
                        }
                        
                        # Remove None values
                        request_data = {k: v for k, v in request_data.items() if v is not None}
                        
                        Request.objects.create(**request_data)
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