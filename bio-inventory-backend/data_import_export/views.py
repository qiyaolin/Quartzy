from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from items.views import ItemViewSet
from inventory_requests.views import RequestViewSet


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_data(request):
    """
    Unified import endpoint that routes to appropriate import handlers
    """
    data_type = request.data.get('data_type', '').lower()
    
    if data_type == 'inventory':
        # Route to items import
        item_viewset = ItemViewSet()
        item_viewset.request = request
        item_viewset.format_kwarg = None
        return item_viewset.import_data(request)
    
    elif data_type == 'requests':
        # Route to requests import
        request_viewset = RequestViewSet()
        request_viewset.request = request
        request_viewset.format_kwarg = None
        return request_viewset.import_data(request)
    
    else:
        return Response(
            {'error': f'Unsupported data type: {data_type}. Supported types: inventory, requests'}, 
            status=status.HTTP_400_BAD_REQUEST
        )