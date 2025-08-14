#!/usr/bin/env python
"""
Simple test to verify core functionality works
"""
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def test_basic_functionality():
    """Test basic Django functionality"""
    print("Testing basic functionality...")
    
    try:
        # Test database connection
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result and result[0] == 1:
                print("OK: Database connection works")
            else:
                print("ERROR: Database connection failed")
                return False
                
        # Test schedule models
        from schedule.models import Equipment, Event
        print("OK: Schedule models imported successfully")
        
        # Test unified dashboard
        from schedule.views import UnifiedDashboardViewSet
        print("OK: Unified dashboard view imported successfully")
        
        # Test basic admin
        from django.contrib.auth.models import User
        print("OK: User model imported successfully")
        
        print("SUCCESS: All basic tests passed!")
        return True
        
    except Exception as e:
        print(f"ERROR: Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_basic_functionality()
    if success:
        print("Ready for deployment!")
    else:
        print("Fix issues before deploying")
    sys.exit(0 if success else 1)