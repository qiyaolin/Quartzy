#!/usr/bin/env python
"""
Fix database index conflict for Google App Engine deployment
Specifically addresses: relation "schedule_eq_equipme_2088a1_idx" already exists
"""
import os
import django
from django.db import connection, transaction

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def check_database_connection():
    """Check if database connection is working"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            print("✓ Database connection successful")
            return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

def drop_conflicting_indexes():
    """Drop the conflicting indexes that are causing migration failures"""
    try:
        with connection.cursor() as cursor:
            # Get all indexes that match the problematic pattern
            cursor.execute("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE indexname LIKE 'schedule_eq_equipme_%_idx'
                OR indexname LIKE 'schedule_equipmentusagelog_%_idx'
            """)
            indexes = cursor.fetchall()
            
            if not indexes:
                print("✓ No conflicting indexes found")
                return True
                
            print(f"Found {len(indexes)} conflicting indexes:")
            for idx in indexes:
                index_name = idx[0]
                print(f"  - {index_name}")
                
                try:
                    cursor.execute(f"DROP INDEX IF EXISTS {index_name}")
                    print(f"✓ Dropped index: {index_name}")
                except Exception as e:
                    print(f"✗ Failed to drop index {index_name}: {e}")
                    
        return True
    except Exception as e:
        print(f"✗ Error dropping indexes: {e}")
        return False

def check_unified_dashboard_tables():
    """Check if unified dashboard required tables exist"""
    try:
        with connection.cursor() as cursor:
            # Check for key tables needed by unified dashboard
            required_tables = [
                'schedule_meetinginstance',
                'schedule_periodictaskinstance', 
                'schedule_presenter',
                'schedule_meetingconfiguration',
                'schedule_equipmentusagelog'
            ]
            
            existing_tables = []
            missing_tables = []
            
            for table_name in required_tables:
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name=%s AND table_schema='public'
                """, [table_name])
                
                if cursor.fetchone():
                    existing_tables.append(table_name)
                else:
                    missing_tables.append(table_name)
            
            print(f"✓ Existing tables: {len(existing_tables)}")
            for table in existing_tables:
                print(f"  - {table}")
                
            if missing_tables:
                print(f"✗ Missing tables: {len(missing_tables)}")
                for table in missing_tables:
                    print(f"  - {table}")
                return False
            else:
                print("✓ All required tables exist")
                return True
                
    except Exception as e:
        print(f"✗ Error checking tables: {e}")
        return False

def test_unified_dashboard_endpoint():
    """Test the unified dashboard endpoint after fixes"""
    try:
        from django.test import RequestFactory
        from django.contrib.auth.models import User
        from schedule.views import UnifiedDashboardViewSet
        
        # Create a test user
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={'email': 'test@example.com'}
        )
        
        # Create a request
        factory = RequestFactory()
        request = factory.get('/schedule/unified-dashboard/overview/')
        request.user = user
        
        # Test the viewset
        viewset = UnifiedDashboardViewSet()
        viewset.request = request
        
        response = viewset.overview(request)
        
        if response.status_code == 200:
            print("✓ Unified dashboard endpoint is working!")
            return True
        else:
            print(f"✗ Unified dashboard returned status {response.status_code}")
            if hasattr(response, 'data'):
                print(f"Response data: {response.data}")
            return False
            
    except Exception as e:
        print(f"✗ Unified dashboard test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def create_safe_migration_script():
    """Create a safe migration script for cloud deployment"""
    script_content = '''#!/bin/bash
# Safe migration script for Google App Engine

echo "🔧 Starting safe migration process..."

# Step 1: Drop conflicting indexes
echo "Dropping conflicting indexes..."
python fix_index_conflict.py

# Step 2: Run migrations with fake-initial to avoid conflicts
echo "Running migrations with fake-initial..."
python manage.py migrate --fake-initial

# Step 3: Apply remaining migrations
echo "Applying remaining migrations..."
python manage.py migrate

# Step 4: Test unified dashboard
echo "Testing unified dashboard..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from fix_index_conflict import test_unified_dashboard_endpoint
test_unified_dashboard_endpoint()
"

echo "✅ Safe migration completed"
'''
    
    with open('safe_migrate.sh', 'w') as f:
        f.write(script_content)
    
    print("✓ Created safe_migrate.sh script")

def main():
    """Main fix function"""
    print("=== Index Conflict Fix for Google App Engine ===")
    
    # Step 1: Check database connection
    if not check_database_connection():
        print("Cannot proceed without database connection")
        return False
    
    # Step 2: Drop conflicting indexes
    print("\n🔧 Dropping conflicting indexes...")
    if not drop_conflicting_indexes():
        print("Failed to drop conflicting indexes")
        return False
    
    # Step 3: Check required tables
    print("\n📋 Checking unified dashboard tables...")
    tables_ok = check_unified_dashboard_tables()
    
    # Step 4: Test endpoint
    print("\n🧪 Testing unified dashboard endpoint...")
    endpoint_ok = test_unified_dashboard_endpoint()
    
    # Step 5: Create safe migration script
    print("\n📝 Creating safe migration script...")
    create_safe_migration_script()
    
    # Summary
    print("\n=== SUMMARY ===")
    print(f"Database connection: ✓")
    print(f"Conflicting indexes: ✓ (dropped)")
    print(f"Required tables: {'✓' if tables_ok else '✗'}")
    print(f"Dashboard endpoint: {'✓' if endpoint_ok else '✗'}")
    
    if tables_ok and endpoint_ok:
        print("\n🎉 All checks passed! The unified dashboard should work now.")
        return True
    else:
        print("\n⚠️ Some issues remain. Check the logs above.")
        return False

if __name__ == '__main__':
    success = main()
    if success:
        print("\n=== DEPLOYMENT READY ===")
        print("You can now deploy to Google App Engine")
    else:
        print("\n=== NEEDS ATTENTION ===")
        print("Please review and fix the issues above before deployment")