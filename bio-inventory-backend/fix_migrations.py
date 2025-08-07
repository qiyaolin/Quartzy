#!/usr/bin/env python
"""
智能迁移修复脚本 - 处理生产环境迁移冲突
"""
import os
import django
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def fix_barcode_migration():
    """修复barcode字段迁移冲突"""
    print("🔧 检查和修复barcode字段迁移...")
    
    try:
        recorder = MigrationRecorder(connection)
        
        with connection.cursor() as cursor:
            # 检查barcode字段是否已存在
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name='items_item' AND column_name='barcode'
                """)
            else:  # SQLite
                cursor.execute("PRAGMA table_info(items_item)")
                columns = cursor.fetchall()
                barcode_exists = any(col[1] == 'barcode' for col in columns)
                cursor.execute("SELECT 1") if barcode_exists else cursor.execute("SELECT 0")
            
            barcode_exists = cursor.fetchone()
            
            if barcode_exists:
                print("✅ barcode字段已存在于数据库中")
                
                # 检查迁移记录是否存在
                if recorder.migration_qs.filter(app='items', name='0007_add_barcode_field_final').exists():
                    print("✅ barcode迁移记录已存在")
                else:
                    print("📝 添加barcode迁移记录...")
                    recorder.record_applied('items', '0007_add_barcode_field_final')
                    print("✅ barcode迁移记录已添加")
            else:
                print("⚠️ barcode字段不存在，需要正常迁移")
                
    except Exception as e:
        print(f"❌ 修复barcode迁移时出错: {e}")

def check_schedule_migrations():
    """检查schedule模块迁移状态"""
    print("📅 检查schedule模块迁移状态...")
    
    try:
        with connection.cursor() as cursor:
            # 检查schedule相关表是否存在
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name LIKE 'schedule_%' AND table_schema='public'
                """)
            else:  # SQLite
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name LIKE 'schedule_%'
                """)
            
            schedule_tables = cursor.fetchall()
            
            if schedule_tables:
                print(f"✅ 发现{len(schedule_tables)}个schedule表:")
                for table in schedule_tables:
                    print(f"  - {table[0]}")
                    
                # 检查Equipment表的QR字段
                check_equipment_qr_fields(cursor)
            else:
                print("📝 未发现schedule表，需要创建")
                
    except Exception as e:
        print(f"❌ 检查schedule迁移时出错: {e}")

def check_equipment_qr_fields(cursor):
    """检查Equipment表是否有QR相关字段"""
    print("🔍 检查Equipment表QR字段...")
    
    try:
        # 检查equipment表的QR相关字段
        if connection.vendor == 'postgresql':
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='schedule_equipment' 
                AND column_name IN ('qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use')
            """)
        else:  # SQLite
            cursor.execute("PRAGMA table_info(schedule_equipment)")
            all_columns = cursor.fetchall()
            qr_columns = [col[1] for col in all_columns 
                        if col[1] in ['qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use']]
            # 为了统一处理，重新设置cursor结果
            cursor.execute("SELECT 1")  # 重置
            
        if connection.vendor == 'postgresql':
            existing_qr_fields = [row[0] for row in cursor.fetchall()]
        else:
            existing_qr_fields = qr_columns
            
        required_qr_fields = ['qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use']
        missing_qr_fields = [field for field in required_qr_fields if field not in existing_qr_fields]
        
        if existing_qr_fields:
            print(f"✅ 发现QR字段: {', '.join(existing_qr_fields)}")
        
        if missing_qr_fields:
            print(f"📝 缺少QR字段: {', '.join(missing_qr_fields)}")
            print("💡 建议运行: python manage.py migrate_qr_system_safe --dry-run")
        else:
            print("✅ Equipment表QR字段完整")
            
        # 检查QR相关表
        qr_tables = ['schedule_equipmentusagelog', 'schedule_waitingqueueentry']
        for table_name in qr_tables:
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name=%s AND table_schema='public'
                """, [table_name])
            else:  # SQLite
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                """, [table_name])
            
            table_exists = cursor.fetchone()
            if table_exists:
                print(f"✅ QR表存在: {table_name}")
            else:
                print(f"📝 QR表缺失: {table_name}")
                
    except Exception as e:
        print(f"❌ 检查QR字段时出错: {e}")

def fix_qr_migration_records():
    """修复QR系统迁移记录"""
    print("🔧 检查QR系统迁移记录...")
    
    try:
        recorder = MigrationRecorder(connection)
        
        # 检查关键的QR迁移是否已记录
        qr_migrations = [
            ('schedule', '0002_add_qr_checkin_support'),
            ('schedule', '0003_create_usage_log'),
        ]
        
        for app, migration_name in qr_migrations:
            if recorder.migration_qs.filter(app=app, name=migration_name).exists():
                print(f"✅ QR迁移记录存在: {app}.{migration_name}")
            else:
                print(f"📝 QR迁移记录缺失: {app}.{migration_name}")
                
                # 检查相应的表/字段是否实际存在
                migration_exists_in_db = check_migration_exists_in_database(migration_name)
                
                if migration_exists_in_db:
                    print(f"💡 数据库结构已存在，可以安全记录迁移: {migration_name}")
                    # 可以选择自动记录，但为了安全起见，这里只提示
                    # recorder.record_applied(app, migration_name)
                    
    except Exception as e:
        print(f"❌ 检查QR迁移记录时出错: {e}")

def check_migration_exists_in_database(migration_name):
    """检查迁移对应的数据库结构是否存在"""
    try:
        with connection.cursor() as cursor:
            if migration_name == '0002_add_qr_checkin_support':
                # 检查Equipment表的QR字段
                if connection.vendor == 'postgresql':
                    cursor.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name='schedule_equipment' AND column_name='qr_code'
                    """)
                else:  # SQLite
                    cursor.execute("PRAGMA table_info(schedule_equipment)")
                    columns = cursor.fetchall()
                    return any(col[1] == 'qr_code' for col in columns)
                    
                return cursor.fetchone() is not None
                
            elif migration_name == '0003_create_usage_log':
                # 检查使用日志表
                if connection.vendor == 'postgresql':
                    cursor.execute("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_name='schedule_equipmentusagelog' AND table_schema='public'
                    """)
                else:  # SQLite
                    cursor.execute("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name='schedule_equipmentusagelog'
                    """)
                    
                return cursor.fetchone() is not None
                
    except Exception as e:
        print(f"❌ 检查数据库结构时出错: {e}")
        return False
        
    return False

def fix_booking_table_name():
    """Fix booking table name issue - cloud compatible version"""
    print("Fixing booking table name issue...")
    
    try:
        with connection.cursor() as cursor:
            # Check existing tables
            if connection.vendor == 'postgresql':
                # Production environment PostgreSQL
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name IN ('schedule_booking', 'schedule_equipmentbooking') 
                    AND table_schema='public'
                """)
            else:
                # Development environment SQLite
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name IN ('schedule_booking', 'schedule_equipmentbooking')
                """)
            
            existing_tables = [row[0] for row in cursor.fetchall()]
            
            if 'schedule_equipmentbooking' in existing_tables:
                if 'schedule_booking' not in existing_tables:
                    print("Renaming schedule_equipmentbooking to schedule_booking")
                    # Rename table
                    if connection.vendor == 'postgresql':
                        cursor.execute("ALTER TABLE schedule_equipmentbooking RENAME TO schedule_booking;")
                    else:
                        cursor.execute("ALTER TABLE schedule_equipmentbooking RENAME TO schedule_booking;")
                    print("Table renamed successfully")
                else:
                    print("Warning: Both tables exist, need manual data merge")
            elif 'schedule_booking' in existing_tables:
                print("schedule_booking table already exists")
            else:
                print("booking table does not exist, needs normal migration")
                
    except Exception as e:
        print(f"Error fixing booking table name: {e}")

def fix_missing_unified_dashboard_models():
    """Fix missing unified dashboard models"""
    print("Checking unified dashboard required models...")
    
    try:
        recorder = MigrationRecorder(connection)
        
        # Check if key models exist
        required_models = [
            'MeetingInstance',
            'PeriodicTaskInstance', 
            'Presenter',
            'MeetingConfiguration'
        ]
        
        with connection.cursor() as cursor:
            missing_models = []
            
            for model_name in required_models:
                table_name = f'schedule_{model_name.lower()}'
                
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
                print("Need to create new migration files")
                
                # Mark that migration regeneration is needed
                return True
            else:
                print("All unified dashboard models exist")
                return False
                
    except Exception as e:
        print(f"Error checking unified dashboard models: {e}")
        return False

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

def check_missing_unified_dashboard_models():
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
    print("Starting intelligent migration fix...")
    fix_barcode_migration()
    check_schedule_migrations() 
    fix_qr_migration_records()
    fix_booking_table_name()
    needs_migration = check_missing_unified_dashboard_models()
    
    if needs_migration:
        print("Dashboard models missing - migrations will be applied")
    
    print("Migration fix completed")