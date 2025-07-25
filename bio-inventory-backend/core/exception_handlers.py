from rest_framework.views import exception_handler
from rest_framework.response import Response
from django.http import Http404
from django.core.exceptions import PermissionDenied
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF that ensures all errors return JSON
    instead of HTML error pages.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # If DRF handled it, return the JSON response
        return response
    
    # Handle exceptions that DRF doesn't handle by default
    if isinstance(exc, Http404):
        return Response({
            'error': 'Not found',
            'detail': 'The requested resource was not found.'
        }, status=404)
    
    if isinstance(exc, PermissionDenied):
        return Response({
            'error': 'Permission denied',
            'detail': 'You do not have permission to perform this action.'
        }, status=403)
    
    # For any other unhandled exception, log it and return a generic JSON error
    logger.error(f"Unhandled exception in API: {exc}", exc_info=True)
    
    return Response({
        'error': 'Internal server error',
        'detail': 'An unexpected error occurred. Please try again later.',
        'debug_info': str(exc) if hasattr(exc, '__str__') else 'Unknown error'
    }, status=500)