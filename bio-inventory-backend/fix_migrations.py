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
            else:
                print("📝 未发现schedule表，需要创建")
                
    except Exception as e:
        print(f"❌ 检查schedule迁移时出错: {e}")

if __name__ == '__main__':
    print("🚀 开始智能迁移修复...")
    fix_barcode_migration()
    check_schedule_migrations()
    print("✅ 迁移修复完成")