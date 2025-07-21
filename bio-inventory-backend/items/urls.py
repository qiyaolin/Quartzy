from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VendorViewSet, LocationViewSet, ItemTypeViewSet, ItemViewSet

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'vendors', VendorViewSet)
router.register(r'locations', LocationViewSet)
router.register(r'item-types', ItemTypeViewSet)
router.register(r'items', ItemViewSet)

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
] 