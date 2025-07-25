from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def custom_404(request, exception=None):
    """Custom 404 handler that returns JSON for API requests"""
    
    # Check if this is an API request
    if request.path.startswith('/api/'):
        return JsonResponse({
            'error': 'Not found',
            'detail': f'The endpoint {request.path} was not found.',
            'status_code': 404
        }, status=404)
    
    # For non-API requests, let Django handle it normally
    from django.shortcuts import render
    return render(request, '404.html', status=404)

@csrf_exempt  
def custom_500(request):
    """Custom 500 handler that returns JSON for API requests"""
    
    # Check if this is an API request
    if request.path.startswith('/api/'):
        return JsonResponse({
            'error': 'Internal server error',
            'detail': 'An unexpected error occurred on the server.',
            'status_code': 500
        }, status=500)
    
    # For non-API requests, let Django handle it normally
    from django.shortcuts import render
    return render(request, '500.html', status=500)