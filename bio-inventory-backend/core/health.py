from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def health_check(request):
    """简化的健康检查端点"""
    if request.method != 'GET':
        return HttpResponse(status=405)
    
    try:
        # 基本的数据库连接检查
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
        
        response_data = {
            'status': 'healthy',
            'database': 'connected',
            'result': result[0] if result else None
        }
        return JsonResponse(response_data)
    except Exception as e:
        response_data = {
            'status': 'unhealthy',
            'error': str(e)
        }
        return JsonResponse(response_data, status=500)

@csrf_exempt
def readiness_check(request):
    """简化的就绪检查端点"""
    if request.method != 'GET':
        return HttpResponse(status=405)
    
    return JsonResponse({'status': 'ready', 'timestamp': str(__import__('datetime').datetime.now())})
