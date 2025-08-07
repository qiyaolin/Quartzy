#!/usr/bin/env python
"""
Test unified dashboard API endpoint
"""
import os
import django

# Setup Django environment FIRST
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth.models import User
from schedule.views import UnifiedDashboardViewSet

def test_unified_dashboard():
    """Test the unified dashboard overview endpoint"""
    print("Testing unified dashboard endpoint...")
    
    try:
        # Create a test user
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={'email': 'test@example.com'}
        )
        
        # Create a request factory
        factory = RequestFactory()
        request = factory.get('/schedule/unified-dashboard/overview/')
        request.user = user
        
        # Initialize the viewset
        viewset = UnifiedDashboardViewSet()
        viewset.request = request
        
        # Call the overview method
        response = viewset.overview(request)
        
        print(f"Status code: {response.status_code}")
        if hasattr(response, 'data'):
            print("Response data keys:", list(response.data.keys()) if response.data else "No data")
        
        if response.status_code == 200:
            print("SUCCESS: Unified dashboard endpoint is working!")
            return True
        else:
            print("ERROR: Endpoint returned non-200 status")
            print("Response:", response.data if hasattr(response, 'data') else str(response))
            return False
            
    except Exception as e:
        print(f"ERROR: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_unified_dashboard()
    if success:
        print("\n=== SOLUTION SUMMARY ===")
        print("The unified dashboard API is now working correctly!")
        print("The 500 error was caused by missing database models.")
        print("After fixing table names and applying migrations, the endpoint is functional.")
    else:
        print("\n=== ADDITIONAL DEBUG NEEDED ===")
        print("The endpoint still has issues that need investigation.")