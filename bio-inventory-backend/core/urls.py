"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from users.views import CustomAuthToken # Import our new view
from .health import health_check, readiness_check
from .emergency_migrate_view import emergency_migrate_barcode, check_barcode_status

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health_check'),
    path('ready/', readiness_check, name='readiness_check'),
    path('api/login/', CustomAuthToken.as_view(), name='api_token_auth'), # Use the new view
    path('api/', include('items.urls')),
    path('api/', include('inventory_requests.urls')),
    path('api/', include('users.urls')),
    path('api/', include('funding.urls')),
    path('api/', include('notifications.urls')),
    path('api/printing/', include('printing.urls')),
    path('api/', include('data_import_export.urls')),
    # 紧急迁移端点
    path('admin/emergency-migrate-barcode/', emergency_migrate_barcode, name='emergency_migrate_barcode'),
    path('admin/check-barcode-status/', check_barcode_status, name='check_barcode_status'),
]
