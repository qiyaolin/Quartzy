#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from rest_framework.test import force_authenticate
from schedule.views import UnifiedDashboardViewSet
import traceback

def test_dashboard():
    factory = RequestFactory()
    User = get_user_model()
    
    # Get or create a test user
    user = User.objects.first()
    if not user:
        print("No users found in database. Creating a test user...")
        user = User.objects.create_user(username='testuser', password='testpass')
        print(f"Created user: {user.username}")
    else:
        print(f"Using user: {user.username}")
    
    # Create request
    request = factory.get('/test/')
    request.user = user  # Manually set the user
    force_authenticate(request, user=user)
    
    # Test the viewset
    viewset = UnifiedDashboardViewSet()
    try:
        response = viewset.overview(request)
        print("SUCCESS: Dashboard loaded successfully")
        print(f"Response status: {response.status_code}")
        print(f"Data keys: {list(response.data.keys()) if hasattr(response, 'data') else 'No data'}")
        if hasattr(response, 'data') and 'error' in response.data:
            print(f"Error message: {response.data['error']}")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        print("\nFull traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    test_dashboard()