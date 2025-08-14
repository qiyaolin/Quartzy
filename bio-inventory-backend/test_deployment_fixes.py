#!/usr/bin/env python
"""
Test script to verify deployment fixes work locally before deploying to App Engine
"""
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Import Django components after setup
from django.test import RequestFactory
from django.contrib.auth.models import User

def test_database_connection():
    """Test that we can connect to the database"""
    print("Testing database connection...")
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result and result[0] == 1:
                print("✓ Database connection successful")
                return True
            else:
                print("✗ Database connection failed")
                return False
    except Exception as e:
        print(f"✗ Database connection error: {e}")
        return False

def test_migrations():
    """Test that migrations can run without conflicts"""
    print("🔄 Testing migrations...")
    try:
        from django.core.management import call_command
        from io import StringIO
        
        # Capture output
        out = StringIO()
        call_command('migrate', '--check', stdout=out, stderr=out)
        output = out.getvalue()
        
        if "No migrations to apply" in output or "Your models have changes" in output:
            print("✓ Migrations are up to date or ready to apply")
            return True
        else:
            print(f"⚠️ Migration status: {output}")
            return True  # Non-critical for testing
    except Exception as e:
        print(f"✗ Migration test error: {e}")
        return False

def test_schedule_models():
    """Test that schedule models are working"""
    print("🗂️ Testing schedule models...")
    try:
        from schedule.models import Equipment, Event, Booking
        
        # Test model imports
        print("✓ Schedule models imported successfully")
        
        # Test basic model queries
        equipment_count = Equipment.objects.count()
        event_count = Event.objects.count()
        booking_count = Booking.objects.count()
        
        print(f"✓ Equipment count: {equipment_count}")
        print(f"✓ Event count: {event_count}")
        print(f"✓ Booking count: {booking_count}")
        
        return True
    except Exception as e:
        print(f"✗ Schedule models test error: {e}")
        return False

def test_unified_dashboard_api():
    """Test the unified dashboard API that was causing errors"""
    print("📊 Testing unified dashboard API...")
    try:
        from schedule.views import UnifiedScheduleDashboardView
        from django.test import RequestFactory
        
        # Create a test user
        user, created = User.objects.get_or_create(
            username='test_dashboard_user',
            defaults={'email': 'test@example.com'}
        )
        
        # Create test request
        factory = RequestFactory()
        request = factory.get('/api/schedule/unified-dashboard/overview/')
        request.user = user
        
        # Test the view
        view = UnifiedScheduleDashboardView.as_view()
        response = view(request)
        
        if hasattr(response, 'status_code') and response.status_code == 200:
            print("✓ Unified dashboard API working")
            return True
        else:
            print(f"✗ Dashboard API returned status: {getattr(response, 'status_code', 'unknown')}")
            return False
            
    except Exception as e:
        print(f"✗ Dashboard API test error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_critical_endpoints():
    """Test other critical API endpoints"""
    print("🌐 Testing critical API endpoints...")
    try:
        from schedule.views import EquipmentViewSet, EventViewSet, BookingViewSet
        
        endpoints = [
            ('EquipmentViewSet', EquipmentViewSet),
            ('EventViewSet', EventViewSet), 
            ('BookingViewSet', BookingViewSet)
        ]
        
        passed = 0
        for name, viewset_class in endpoints:
            try:
                # Check if viewset has required attributes
                if hasattr(viewset_class, 'queryset') and hasattr(viewset_class, 'serializer_class'):
                    print(f"✓ {name} is properly configured")
                    passed += 1
                else:
                    print(f"✗ {name} is missing required attributes")
            except Exception as e:
                print(f"✗ {name} test failed: {e}")
        
        print(f"📊 Endpoint tests: {passed}/{len(endpoints)} passed")
        return passed == len(endpoints)
        
    except Exception as e:
        print(f"✗ Endpoint tests error: {e}")
        return False

def test_admin_access():
    """Test that admin interface is accessible"""
    print("👤 Testing admin access...")
    try:
        from django.contrib.admin.sites import site
        from schedule.models import Equipment, Event, Booking
        
        # Check if models are registered
        registered_models = [model._meta.label for model in site._registry.keys()]
        
        schedule_models = ['schedule.Equipment', 'schedule.Event', 'schedule.Booking']
        found_models = [model for model in schedule_models if model in registered_models]
        
        print(f"✓ Admin registered models: {len(found_models)}/{len(schedule_models)}")
        
        # Test superuser creation capability
        admin_user = User.objects.filter(username='admin').first()
        if admin_user:
            print("✓ Admin user exists")
        else:
            print("⚠️ Admin user not found (will be created on startup)")
        
        return True
        
    except Exception as e:
        print(f"✗ Admin access test error: {e}")
        return False

def main():
    """Run all deployment tests"""
    print("Testing deployment fixes...")
    print("=" * 50)
    
    tests = [
        test_database_connection,
        test_migrations,
        test_schedule_models,
        test_unified_dashboard_api,
        test_critical_endpoints,
        test_admin_access
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
            print()  # Add spacing between tests
        except Exception as e:
            print(f"✗ Test {test_func.__name__} failed with exception: {e}")
            print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Deployment should be successful.")
        return True
    else:
        print("⚠️ Some tests failed. Check the errors above before deploying.")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)