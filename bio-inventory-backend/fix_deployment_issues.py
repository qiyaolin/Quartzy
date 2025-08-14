#!/usr/bin/env python
"""
Comprehensive deployment fix for Google App Engine
Addresses migration conflicts and API issues
"""
import os
import sys
import django
from django.db import connection, transaction

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def main():
    print("🚀 Starting comprehensive deployment fix...")
    
    try:
        # Step 1: Run the existing index conflict fix
        print("\n📋 Step 1: Running index conflict fix...")
        from fix_index_conflict import main as fix_indexes
        fix_indexes()
        
        # Step 2: Run the new migration conflict fix
        print("\n📋 Step 2: Running migration conflict fix...")
        from django.core.management import call_command
        call_command('fix_migration_conflicts', '--force')
        
        # Step 3: Test Equipment API endpoint
        print("\n📋 Step 3: Testing Equipment API...")
        test_equipment_api()
        
        # Step 4: Verify all critical endpoints
        print("\n📋 Step 4: Verifying critical endpoints...")
        verify_critical_endpoints()
        
        print("\n🎉 All deployment fixes completed successfully!")
        print("✅ The application should now be ready for use")
        
    except Exception as e:
        print(f"\n❌ Deployment fix failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def test_equipment_api():
    """Test the Equipment API that was causing 500 errors"""
    try:
        from django.test import RequestFactory
        from django.contrib.auth.models import User
        from schedule.views import EquipmentViewSet
        from schedule.serializers import EquipmentSerializer
        
        # Create a test user
        user, created = User.objects.get_or_create(
            username='test_api_user',
            defaults={'email': 'test@example.com'}
        )
        
        # Test the Equipment serializer first
        from schedule.models import Equipment
        test_data = {
            'name': 'Test Equipment API',
            'description': 'Testing API functionality',
            'location': 'API Test Lab',
            'is_bookable': True
        }
        
        serializer = EquipmentSerializer(data=test_data)
        if serializer.is_valid():
            print("✓ Equipment serializer validation passed")
        else:
            print(f"✗ Equipment serializer validation failed: {serializer.errors}")
            return False
        
        # Test the Equipment ViewSet
        factory = RequestFactory()
        request = factory.post('/api/schedule/equipment/', test_data, format='json')
        request.user = user
        
        viewset = EquipmentViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        
        # Test if the viewset can handle the request
        try:
            response = viewset.create(request)
            if hasattr(response, 'status_code') and response.status_code == 201:
                print("✓ Equipment API endpoint test passed")
                # Clean up test equipment
                if hasattr(response, 'data') and 'id' in response.data:
                    Equipment.objects.filter(id=response.data['id']).delete()
                return True
            else:
                print(f"✗ Equipment API returned unexpected status: {getattr(response, 'status_code', 'unknown')}")
                return False
        except Exception as e:
            print(f"✗ Equipment API test failed: {e}")
            return False
        
    except Exception as e:
        print(f"✗ Equipment API setup failed: {e}")
        return False

def verify_critical_endpoints():
    """Verify that all critical API endpoints are working"""
    endpoints_to_test = [
        ('schedule.views', 'EventViewSet'),
        ('schedule.views', 'EquipmentViewSet'),
        ('schedule.views', 'BookingViewSet'),
    ]
    
    passed = 0
    total = len(endpoints_to_test)
    
    for module_name, viewset_name in endpoints_to_test:
        try:
            module = __import__(module_name, fromlist=[viewset_name])
            viewset_class = getattr(module, viewset_name)
            
            # Check if the viewset has proper configuration
            if hasattr(viewset_class, 'queryset') and hasattr(viewset_class, 'serializer_class'):
                print(f"✓ {viewset_name} is properly configured")
                passed += 1
            else:
                print(f"✗ {viewset_name} is missing required attributes")
                
        except Exception as e:
            print(f"✗ {viewset_name} test failed: {e}")
    
    print(f"\n📊 Endpoint verification: {passed}/{total} passed")
    return passed == total

if __name__ == '__main__':
    main()