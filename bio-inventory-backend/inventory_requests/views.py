from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter # Import SearchFilter
from django_filters import rest_framework as filters # Import django_filters
from rest_framework.permissions import IsAdminUser # Import this
from django.db import IntegrityError, transaction
from .models import Request, RequestHistory
from .serializers import RequestSerializer, RequestHistorySerializer
from .filters import RequestFilter # Import our filter class
from items.models import Item, ItemType, Location
from notifications.email_service import EmailNotificationService
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

    def _normalize_receipts_payload(self, payload):
        """
        Normalize receive payload into a list of {'location_id': int}.
        Supports new payload:
          {'receipts': [{'location_id': 1}, ...]}
        and legacy payload:
          {'location_id': 1, 'quantity_received': 3}
        """
        receipts = payload.get('receipts')
        normalized = []

        if isinstance(receipts, list):
            for entry in receipts:
                if not isinstance(entry, dict):
                    return None, 'Each receipt must be an object.'
                location_id = entry.get('location_id')
                try:
                    location_id = int(location_id)
                except (TypeError, ValueError):
                    return None, 'Each receipt must include a valid location_id.'
                normalized.append({'location_id': location_id})
        else:
            location_id = payload.get('location_id')
            quantity_received_raw = payload.get('quantity_received', 0)
            try:
                location_id = int(location_id)
                quantity_received = int(quantity_received_raw)
            except (TypeError, ValueError):
                return None, 'Location and valid quantity are required.'

            if quantity_received <= 0:
                return None, 'Location and valid quantity are required.'

            normalized = [{'location_id': location_id} for _ in range(quantity_received)]

        if not normalized:
            return None, 'At least one receipt entry is required.'

        return normalized, None

    def _process_request_receipts(self, req_id, receipts, actor):
        try:
            with transaction.atomic():
                req_object = Request.objects.select_for_update().get(pk=req_id)

                if req_object.status != 'ORDERED':
                    return None, 'Only ordered items can be marked as received.'

                remaining = req_object.remaining_quantity or req_object.quantity
                if remaining <= 0:
                    remaining = req_object.quantity
                    req_object.remaining_quantity = remaining

                if len(receipts) > remaining:
                    return None, 'Received quantity cannot exceed remaining ordered quantity.'

                location_ids = list({entry['location_id'] for entry in receipts})
                locations = {
                    location.id: location
                    for location in Location.objects.filter(id__in=location_ids)
                }
                missing_location_ids = [location_id for location_id in location_ids if location_id not in locations]
                if missing_location_ids:
                    return None, 'Selected location does not exist.'

                item_type_id = req_object.item_type_id or ItemType.objects.get_or_create(name='General Supply')[0].id
                created_items = []
                for entry in receipts:
                    location = locations[entry['location_id']]
                    created_item = Item.objects.create(
                        name=req_object.item_name,
                        vendor=req_object.vendor,
                        catalog_number=req_object.catalog_number,
                        item_type_id=item_type_id,
                        owner=req_object.requested_by,
                        quantity=1,
                        unit=req_object.unit_size or 'unit',
                        location=location,
                        price=req_object.unit_price,
                        fund_id=req_object.fund_id,
                    )
                    created_items.append(created_item)

                old_status = req_object.status
                req_object.remaining_quantity = max(remaining - len(created_items), 0)
                req_object.status = 'RECEIVED' if req_object.remaining_quantity == 0 else 'ORDERED'
                req_object.save(update_fields=['remaining_quantity', 'status', 'updated_at'])

                RequestHistory.objects.create(
                    request=req_object,
                    user=actor,
                    old_status=old_status,
                    new_status=req_object.status,
                    notes=(
                        f"Marked as received - Quantity: {len(created_items)}, "
                        f"Remaining: {req_object.remaining_quantity}"
                    ),
                )
        except Request.DoesNotExist:
            return None, 'Request not found.'
        except IntegrityError as e:
            logger.warning(f"Failed to mark request {req_id} as received due to integrity error: {e}")
            return None, 'Could not create inventory item due to duplicate or invalid data.'

        created_items_payload = [
            {
                'id': item.id,
                'barcode': item.barcode,
                'location_id': item.location_id,
                'location_name': item.location.name if item.location else None,
                'tracking_mode': item.resolved_tracking_mode,
                'label_mode': item.resolved_label_mode,
                'tracking_summary': item.tracking_summary,
                'can_scan_consume': item.can_scan_consume,
            }
            for item in created_items
        ]

        return {
            'request_id': req_object.id,
            'request_status': req_object.status,
            'remaining_quantity': req_object.remaining_quantity,
            'created_items': created_items_payload,
            'request_item_name': req_object.item_name,
            'request_obj': req_object,
        }, None

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
        if req_object.remaining_quantity <= 0:
            req_object.remaining_quantity = req_object.quantity
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
        Mark ordered request items as received by piece.
        Creates one inventory Item(quantity=1) per receipt entry.
        """
        req_base = self.get_object()
        receipts, error = self._normalize_receipts_payload(request.data)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        result, error = self._process_request_receipts(req_base.id, receipts, request.user)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        
        # Send email notification to requester
        location_names = {item['location_name'] for item in result['created_items'] if item['location_name']}
        location_summary = next(iter(location_names)) if len(location_names) == 1 else 'Multiple locations'
        try:
            EmailNotificationService.send_item_received_notification(
                result['request_obj'],
                request.user, 
                len(result['created_items']),
                location_summary
            )
            logger.info(f"Email notification sent for item received: {result['request_id']}")
        except Exception as e:
            logger.error(f"Failed to send email notification for item received: {e}")

        first_created = result['created_items'][0] if result['created_items'] else {}
        return Response({
            'status': 'Items received and inventory records created.',
            'item_id': first_created.get('id'),
            'barcode': first_created.get('barcode'),
            'request_status': result['request_status'],
            'remaining_quantity': result['remaining_quantity'],
            'created_items': result['created_items'],
            'print_payload': {
                'request_id': result['request_id'],
                'item_name': result['request_item_name'],
                'items': result['created_items'],
            },
        })

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
                if req_object.remaining_quantity <= 0:
                    req_object.remaining_quantity = req_object.quantity
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
        """Batch mark received with per-request receipt entries."""
        payload_entries = request.data.get('receipts_by_request', [])

        # Legacy payload compatibility: request_ids + location_id
        if not payload_entries:
            request_ids = request.data.get('request_ids', [])
            location_id = request.data.get('location_id')
            if request_ids and location_id:
                try:
                    location_id = int(location_id)
                except (TypeError, ValueError):
                    return Response({'error': 'Selected location does not exist'}, status=status.HTTP_400_BAD_REQUEST)

                ordered_requests = Request.objects.filter(id__in=request_ids, status='ORDERED')
                payload_entries = []
                for req_object in ordered_requests:
                    remaining = req_object.remaining_quantity or req_object.quantity
                    payload_entries.append({
                        'request_id': req_object.id,
                        'receipts': [{'location_id': location_id} for _ in range(remaining)],
                    })

        if not payload_entries:
            return Response({'error': 'receipts_by_request is required'}, status=status.HTTP_400_BAD_REQUEST)

        success_results = []
        errors = []

        for entry in payload_entries:
            request_id = entry.get('request_id')
            receipts_raw = {'receipts': entry.get('receipts', [])}
            receipts, error = self._normalize_receipts_payload(receipts_raw)
            if error:
                errors.append({'request_id': request_id, 'error': error})
                continue

            result, error = self._process_request_receipts(request_id, receipts, request.user)
            if error:
                errors.append({'request_id': request_id, 'error': error})
                continue

            location_names = {item['location_name'] for item in result['created_items'] if item['location_name']}
            location_summary = next(iter(location_names)) if len(location_names) == 1 else 'Multiple locations'
            try:
                EmailNotificationService.send_item_received_notification(
                    result['request_obj'],
                    request.user,
                    len(result['created_items']),
                    location_summary,
                )
            except Exception as e:
                logger.error(f"Failed to send email notification for item received: {e}")

            success_results.append({
                'request_id': result['request_id'],
                'request_status': result['request_status'],
                'remaining_quantity': result['remaining_quantity'],
                'created_count': len(result['created_items']),
                'created_items': result['created_items'],
            })

        response_data = {
            'success_count': len(success_results),
            'failure_count': len(errors),
            'results': success_results,
            'errors': errors,
        }
        return Response(response_data, status=status.HTTP_200_OK)

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
