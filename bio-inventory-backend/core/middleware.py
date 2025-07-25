from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

class APIErrorMiddleware(MiddlewareMixin):
    """
    Middleware to ensure API requests always get JSON error responses,
    even for 404s and other errors that bypass DRF.
    """
    
    def process_response(self, request, response):
        # Only handle API requests
        if not request.path.startswith('/api/'):
            return response
        
        # Handle 404 errors for API requests
        if response.status_code == 404:
            # Check if response is HTML (Django's default 404 page)
            content_type = response.get('Content-Type', '')
            if 'text/html' in content_type:
                return JsonResponse({
                    'error': 'Not found',
                    'detail': f'The endpoint {request.path} was not found.',
                    'status_code': 404
                }, status=404)
        
        # Handle 500 errors for API requests
        elif response.status_code == 500:
            content_type = response.get('Content-Type', '')
            if 'text/html' in content_type:
                return JsonResponse({
                    'error': 'Internal server error',
                    'detail': 'An unexpected error occurred on the server.',
                    'status_code': 500
                }, status=500)
        
        return response