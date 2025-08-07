#!/usr/bin/env python
"""
Fix dashboard migration issues for cloud deployment
"""
import os
import django
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def fix_booking_table_name():
    """Fix booking table name issue - cloud compatible version"""
    print("Fixing booking table name issue...")
    
    try:
        with connection.cursor() as cursor:
            # Check existing tables
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name IN ('schedule_booking', 'schedule_equipmentbooking') 
                    AND table_schema='public'
                """)
            else:
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name IN ('schedule_booking', 'schedule_equipmentbooking')
                """)
            
            existing_tables = [row[0] for row in cursor.fetchall()]
            
            if 'schedule_equipmentbooking' in existing_tables:
                if 'schedule_booking' not in existing_tables:
                    print("Renaming schedule_equipmentbooking to schedule_booking")
                    cursor.execute("ALTER TABLE schedule_equipmentbooking RENAME TO schedule_booking;")
                    print("Table renamed successfully")
                else:
                    print("Warning: Both tables exist")
            elif 'schedule_booking' in existing_tables:
                print("schedule_booking table already exists")
            else:
                print("No booking table found - will be created by migration")
                
    except Exception as e:
        print(f"Error fixing booking table name: {e}")

def check_missing_models():
    """Check for missing unified dashboard models"""
    print("Checking unified dashboard required models...")
    
    try:
        # Check if key models exist
        required_models = [
            'meetinginstance',
            'periodictaskinstance', 
            'presenter',
            'meetingconfiguration'
        ]
        
        with connection.cursor() as cursor:
            missing_models = []
            
            for model_name in required_models:
                table_name = f'schedule_{model_name}'
                
                if connection.vendor == 'postgresql':
                    cursor.execute("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_name=%s AND table_schema='public'
                    """, [table_name])
                else:
                    cursor.execute("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name=?
                    """, [table_name])
                
                if not cursor.fetchone():
                    missing_models.append(model_name)
            
            if missing_models:
                print(f"Missing models: {', '.join(missing_models)}")
                return True
            else:
                print("All unified dashboard models exist")
                return False
                
    except Exception as e:
        print(f"Error checking models: {e}")
        return False

if __name__ == '__main__':
    print("Starting dashboard migration fix...")
    
    # Fix booking table name
    fix_booking_table_name()
    
    # Check for missing models
    needs_migration = check_missing_models()
    
    if needs_migration:
        print("SOLUTION: Missing models detected")
        print("1. Run: python manage.py makemigrations schedule")
        print("2. Run: python manage.py migrate")
    else:
        print("Database structure looks good")
    
    print("Dashboard migration fix completed")